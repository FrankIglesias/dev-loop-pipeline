import { beforeEach, describe, expect, mock, test } from 'bun:test';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

// ── helpers ───────────────────────────────────────────────────────────────────

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'runner-test-'));
}

function makeSkillFile(dir: string, content: string): string {
  const p = path.join(dir, 'skill.md');
  fs.writeFileSync(p, content);
  return p;
}

function makeOutputPath(dir: string): string {
  return path.join(dir, 'out', 'result.json');
}

function makeProvider(text: string) {
  return {
    name: 'mock/test',
    complete: mock(async () => ({ text, usage: undefined })),
  };
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('runSkill', () => {
  let tmp: string;

  beforeEach(() => {
    tmp = makeTmpDir();
  });

  test('parses valid JSON response and saves output file', async () => {
    const { runSkill } = await import('../pipeline/runner');
    const payload = { ticket_id: 'T-1', title: 'hello', acceptance_criteria: [] };
    const skillFile = makeSkillFile(
      tmp,
      `---\nname: spec-freeze\n---\nYou are helpful. Context: {{CONTEXT}}`
    );
    const outputFile = makeOutputPath(tmp);
    const provider = makeProvider(JSON.stringify(payload));

    const result = await runSkill({ skillFile, context: {}, repoPath: tmp, outputFile, provider });

    expect(result).toEqual(payload);
    expect(JSON.parse(fs.readFileSync(outputFile, 'utf-8'))).toEqual(payload);
  });

  test('strips markdown fences before parsing', async () => {
    const { runSkill } = await import('../pipeline/runner');
    const payload = { ticket_id: 'T-2' };
    const skillFile = makeSkillFile(tmp, `---\nname: spec-freeze\n---\nContext: {{CONTEXT}}`);
    const outputFile = makeOutputPath(tmp);
    const provider = makeProvider('```json\n' + JSON.stringify(payload) + '\n```');

    const result = await runSkill({ skillFile, context: {}, repoPath: tmp, outputFile, provider });
    expect(result).toEqual(payload);
  });

  test('uses jsonrepair to recover from lightly malformed JSON', async () => {
    const { runSkill } = await import('../pipeline/runner');
    const skillFile = makeSkillFile(tmp, `---\nname: code-write\n---\nContext: {{CONTEXT}}`);
    const outputFile = makeOutputPath(tmp);
    // Trailing comma — invalid JSON but jsonrepair handles it
    const provider = makeProvider('{ "ticket_id": "T-3", }');

    const result = await runSkill({ skillFile, context: {}, repoPath: tmp, outputFile, provider });
    expect((result as Record<string, unknown>).ticket_id).toBe('T-3');
  });

  test('throws when provider throws (e.g. network error)', async () => {
    const { runSkill } = await import('../pipeline/runner');
    const skillFile = makeSkillFile(tmp, `---\nname: code-write\n---\nContext: {{CONTEXT}}`);
    const outputFile = makeOutputPath(tmp);
    const provider = {
      name: 'mock/test',
      complete: mock(async () => {
        throw new Error('connection refused');
      }),
    };

    await expect(
      runSkill({ skillFile, context: {}, repoPath: tmp, outputFile, provider })
    ).rejects.toThrow('connection refused');
  });

  test('saves raw output alongside parsed JSON', async () => {
    const { runSkill } = await import('../pipeline/runner');
    const raw = '{"ticket_id":"T-4"}';
    const skillFile = makeSkillFile(tmp, `---\nname: spec-freeze\n---\nContext: {{CONTEXT}}`);
    const outputFile = makeOutputPath(tmp);
    const provider = makeProvider(raw);

    await runSkill({ skillFile, context: {}, repoPath: tmp, outputFile, provider });

    expect(fs.readFileSync(outputFile + '.raw.txt', 'utf-8')).toBe(raw);
  });

  test('emits step:provider and step:saved events', async () => {
    const { runSkill } = await import('../pipeline/runner');
    const events: string[] = [];
    const skillFile = makeSkillFile(tmp, `---\nname: spec-freeze\n---\nContext: {{CONTEXT}}`);
    const outputFile = makeOutputPath(tmp);
    const provider = makeProvider('{"ticket_id":"T-5"}');

    await runSkill({
      skillFile,
      context: {},
      repoPath: tmp,
      outputFile,
      provider,
      step: 1,
      onEvent: (e) => events.push(e.type),
    });

    expect(events).toContain('step:provider');
    expect(events).toContain('step:saved');
  });

  test('injects context JSON into prompt via {{CONTEXT}} placeholder', async () => {
    const { runSkill } = await import('../pipeline/runner');
    const skillFile = makeSkillFile(tmp, `---\nname: spec-freeze\n---\nSystem: {{CONTEXT}}`);
    const outputFile = makeOutputPath(tmp);
    const provider = makeProvider('{"ok":true}');

    await runSkill({
      skillFile,
      context: { ticket_id: 'T-6' },
      repoPath: tmp,
      outputFile,
      provider,
    });

    const [systemPrompt] = (provider.complete as ReturnType<typeof mock>).mock.calls[0] as [string];
    expect(systemPrompt).toContain('"ticket_id": "T-6"');
  });

  test('uses provider from factory when provided', async () => {
    const { runSkill } = await import('../pipeline/runner');
    const skillFile = makeSkillFile(
      tmp,
      `---\nname: spec-freeze\nprovider: lmstudio\nmodel: llama3.2\n---\nContext: {{CONTEXT}}`
    );
    const outputFile = makeOutputPath(tmp);
    const factoryProvider = makeProvider('{"ticket_id":"T-7"}');
    const factory = mock((_fp?: string, _fm?: string) => factoryProvider);

    await runSkill({ skillFile, context: {}, repoPath: tmp, outputFile, providerFactory: factory });

    // Factory should be called with the frontmatter provider/model
    expect(factory).toHaveBeenCalledWith('lmstudio', 'llama3.2');
  });
});
