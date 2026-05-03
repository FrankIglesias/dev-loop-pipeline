import * as fs from 'fs';
import * as path from 'path';
import { jsonrepair } from 'jsonrepair';
import type { OnEvent } from './events';
import type { LLMProvider, ProviderFactory } from './provider';

interface SkillFrontmatter {
  name: string;
  provider?: string;
  model?: string;
}

function parseFrontmatter(raw: string): { meta: SkillFrontmatter; body: string } {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return { meta: { name: 'unknown' }, body: raw };

  const meta: SkillFrontmatter = { name: 'unknown' };
  for (const line of match[1].split('\n')) {
    const colon = line.indexOf(':');
    if (colon === -1) continue;
    const key = line.slice(0, colon).trim();
    const value = line.slice(colon + 1).trim();
    if (key === 'name') meta.name = value;
    if (key === 'provider') meta.provider = value;
    if (key === 'model') meta.model = value;
  }

  return { meta, body: match[2] };
}

function stripJsonFences(text: string): string {
  return text
    .replace(/^```(?:json)?\s*\n?/, '')
    .replace(/\n?```\s*$/, '')
    .trim();
}

export interface RunnerOptions {
  skillFile: string;
  context: unknown;
  repoPath: string;
  outputFile: string;
  // Factory resolves request > frontmatter > default; pass undefined to use provider directly
  providerFactory?: ProviderFactory;
  provider?: LLMProvider;
  onEvent?: OnEvent;
  step?: number;
}

export async function runSkill(opts: RunnerOptions): Promise<unknown> {
  const emit = opts.onEvent ?? (() => {});
  const raw = fs.readFileSync(opts.skillFile, 'utf-8');
  const { meta, body } = parseFrontmatter(raw);

  // Resolve provider: factory handles request > frontmatter precedence
  const provider = opts.providerFactory
    ? opts.providerFactory(meta.provider, meta.model)
    : opts.provider!;

  const contextJson = JSON.stringify(opts.context, null, 2);
  const systemPrompt =
    body.replace('{{CONTEXT}}', contextJson) +
    `\n\n## Repository\nAll file paths are relative to: ${opts.repoPath}\n`;

  emit({ type: 'step:provider', step: opts.step ?? 0, provider: provider.name });

  const result = await provider.complete(
    systemPrompt,
    'Execute the skill. Respond with ONLY the JSON object described. No markdown fences, no explanation, no preamble.'
  );

  // Save raw output for debugging before any parse attempt
  fs.mkdirSync(path.dirname(opts.outputFile), { recursive: true });
  fs.writeFileSync(opts.outputFile + '.raw.txt', result.text, 'utf-8');

  let parsed: unknown;
  try {
    parsed = JSON.parse(result.text);
  } catch {
    try {
      parsed = JSON.parse(stripJsonFences(result.text));
    } catch {
      try {
        parsed = JSON.parse(jsonrepair(stripJsonFences(result.text)));
      } catch (e) {
        throw new Error(`Skill "${meta.name}" returned non-JSON output: ${String(e)}`);
      }
    }
  }

  fs.writeFileSync(opts.outputFile, JSON.stringify(parsed, null, 2), 'utf-8');
  emit({
    type: 'step:saved',
    step: opts.step ?? 0,
    name: meta.name as import('./events').StepName,
    file: opts.outputFile,
    data: parsed,
    tokens: result.usage,
  });

  return parsed;
}
