import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  codeSummaryToQaGateContext,
  implMapToCodeWriteContext,
  qaReportToPrPackageContext,
  specToImplScoutContext,
} from '@/lib/helpers/stepAdapters';
import { writeFiles } from '@/lib/helpers/repoUtils';
import type {
  CodeSummary,
  FrozenSpec,
  ImplMap,
  PipelineInput,
  PrPackage,
  QaReport,
} from './context';
import type { OnEvent, StepName } from './events';
import { noopOnEvent } from './events';
import type { ProviderFactory } from './provider';
import { runSkill } from './runner';

const SKILLS_DIR = path.join(process.cwd(), 'skills');

function loadStep<T>(file: string): T {
  return JSON.parse(fs.readFileSync(file, 'utf-8')) as T;
}

export async function runPipeline(
  input: PipelineInput,
  providerFactory?: ProviderFactory,
  onEvent: OnEvent = noopOnEvent
): Promise<void> {
  const runDir = path.join(process.cwd(), '.pipeline-runs', input.runId);
  const fromStep = input.fromStep ?? 1;
  const out = (file: string) => path.join(runDir, file);
  const skill = (file: string) => path.join(SKILLS_DIR, file);

  onEvent({
    type: 'run:start',
    runId: input.runId,
    ticketId: input.ticketId,
    repoPath: input.repoPath,
    provider: input.provider.name,
  });

  const runOpts = (n: number, skillFile: string, context: unknown, outputFile: string) => ({
    skillFile,
    context,
    repoPath: input.repoPath,
    outputFile,
    providerFactory,
    provider: providerFactory ? undefined : input.provider,
    onEvent,
    step: n,
  });

  // Runs a step or loads its saved output from disk, depending on fromStep.
  async function step<T>(
    n: number,
    name: StepName,
    skillFile: string,
    context: unknown,
    outputFile: string
  ): Promise<T> {
    if (fromStep <= n) {
      onEvent({ type: 'step:start', step: n, name });
      return (await runSkill(runOpts(n, skillFile, context, outputFile))) as T;
    }
    onEvent({ type: 'step:skipped', step: n, name });
    return loadStep<T>(outputFile);
  }

  const spec = await step<FrozenSpec>(
    1,
    'spec-freeze',
    skill('01-spec-freeze.md'),
    { ticket_id: input.ticketId, ticket_text: input.ticketText ?? `Ticket: ${input.ticketId}` },
    out('01-spec.json')
  );

  const implMap = await step<ImplMap>(
    2,
    'impl-scout',
    skill('02-impl-scout.md'),
    specToImplScoutContext(spec, input.repoPath),
    out('02-impl-map.json')
  );

  const codeSummary = await step<CodeSummary>(
    3,
    'code-write',
    skill('03-code-write.md'),
    implMapToCodeWriteContext(implMap, input.repoPath),
    out('03-code-summary.json')
  );
  if (codeSummary.file_contents && Object.keys(codeSummary.file_contents).length > 0) {
    writeFiles(input.repoPath, codeSummary.file_contents, onEvent);
  }

  const qaReport = await step<QaReport>(
    4,
    'qa-gate',
    skill('04-qa-gate.md'),
    codeSummaryToQaGateContext(codeSummary, input.repoPath),
    out('04-qa-report.json')
  );

  const prPackage = await step<PrPackage>(
    5,
    'pr-package',
    skill('05-pr-package.md'),
    qaReportToPrPackageContext(qaReport, spec.title),
    out('05-pr-package.json')
  );

  onEvent({
    type: 'run:done',
    prTitle: prPackage.pr_title,
    qaPassed: qaReport.passed,
    followUps: prPackage.follow_ups?.length ?? 0,
    runDir,
  });
}
