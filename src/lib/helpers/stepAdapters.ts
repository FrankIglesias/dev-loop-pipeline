import { getRepoStructure, readFiles } from '@/lib/helpers/repoUtils';
import type { CodeSummary, FrozenSpec, ImplMap, QaReport } from '@/lib/pipeline/context';

// ── Step adapters ─────────────────────────────────────────────────────────────
// One adapter per step handoff. Each is the single place to audit what a step
// receives vs. what gets dropped before the next step runs.

export function specToImplScoutContext(spec: FrozenSpec, repoPath: string) {
  const { _raw_ticket_summary: _, _raw_description: __, ...cleanSpec } = spec;
  const repoLines = getRepoStructure(repoPath).split('\n');
  const repo_structure =
    repoLines.length > 200
      ? `${repoLines.slice(0, 200).join('\n')}\n… (truncated)`
      : repoLines.join('\n');
  return { ...cleanSpec, repo_structure };
}

export function implMapToCodeWriteContext(map: ImplMap, repoPath: string) {
  return {
    ticket_id: map.ticket_id,
    files_to_change: map.files_to_change,
    patterns_to_follow: map.patterns_to_follow,
    risks: map.risks,
    approach_summary: map.approach_summary,
    acceptance_criteria: map.acceptance_criteria,
    existing_file_contents: readFiles(repoPath, map.files_to_change.map((f) => f.path)),
  };
}

export function codeSummaryToQaGateContext(summary: CodeSummary, repoPath: string) {
  return {
    ticket_id: summary.ticket_id,
    files_changed: summary.files_changed,
    changes_made: summary.changes_made,
    what_not_done: summary.what_not_done,
    acceptance_criteria: summary.acceptance_criteria,
    written_file_contents: readFiles(repoPath, summary.files_changed),
  };
}

export function qaReportToPrPackageContext(qa: QaReport, specTitle: string) {
  const { acceptance_criteria, files_changed, ...qaCore } = qa;
  return { spec_title: specTitle, acceptance_criteria, files_changed, qa_report: qaCore };
}
