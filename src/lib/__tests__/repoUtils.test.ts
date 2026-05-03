import { describe, expect, test } from 'bun:test';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { lineDiff, readFiles, writeFiles } from '@/lib/helpers/repoUtils';

function makeTmp(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'repoutils-test-'));
}

// ── lineDiff ─────────────────────────────────────────────────────────────────

describe('lineDiff', () => {
  test('identical texts → 0/0', () => {
    expect(lineDiff('a\nb\nc', 'a\nb\nc')).toEqual({ added: 0, removed: 0 });
  });

  test('empty old, non-empty new → all added', () => {
    expect(lineDiff('', 'a\nb')).toEqual({ added: 2, removed: 0 });
  });

  test('non-empty old, empty new → all removed', () => {
    expect(lineDiff('a\nb', '')).toEqual({ added: 0, removed: 2 });
  });

  test('one line replaced', () => {
    expect(lineDiff('a\nb\nc', 'a\nX\nc')).toEqual({ added: 1, removed: 1 });
  });

  test('line appended', () => {
    expect(lineDiff('a\nb', 'a\nb\nc')).toEqual({ added: 1, removed: 0 });
  });

  test('line removed', () => {
    expect(lineDiff('a\nb\nc', 'a\nc')).toEqual({ added: 0, removed: 1 });
  });

  test('both sides empty → 0/0', () => {
    expect(lineDiff('', '')).toEqual({ added: 0, removed: 0 });
  });
});

// ── readFiles ─────────────────────────────────────────────────────────────────

describe('readFiles', () => {
  test('reads existing files', () => {
    const tmp = makeTmp();
    fs.writeFileSync(path.join(tmp, 'a.ts'), 'hello');
    fs.writeFileSync(path.join(tmp, 'b.ts'), 'world');

    const result = readFiles(tmp, ['a.ts', 'b.ts']);
    expect(result).toEqual({ 'a.ts': 'hello', 'b.ts': 'world' });
  });

  test('silently skips missing files', () => {
    const tmp = makeTmp();
    fs.writeFileSync(path.join(tmp, 'exists.ts'), 'ok');

    const result = readFiles(tmp, ['exists.ts', 'missing.ts']);
    expect(Object.keys(result)).toEqual(['exists.ts']);
  });

  test('returns empty object when all files are missing', () => {
    const tmp = makeTmp();
    expect(readFiles(tmp, ['nope.ts'])).toEqual({});
  });

  test('returns empty object for empty file list', () => {
    expect(readFiles('/any', [])).toEqual({});
  });
});

// ── writeFiles ────────────────────────────────────────────────────────────────

describe('writeFiles', () => {
  test('creates new files and emits file:written with isNew=true', () => {
    const tmp = makeTmp();
    const events: unknown[] = [];

    writeFiles(tmp, { 'src/new.ts': 'const x = 1;\n' }, (e) => events.push(e));

    expect(fs.readFileSync(path.join(tmp, 'src/new.ts'), 'utf-8')).toBe('const x = 1;\n');
    expect(events).toHaveLength(1);
    expect((events[0] as Record<string, unknown>).isNew).toBe(true);
    expect((events[0] as Record<string, unknown>).type).toBe('file:written');
  });

  test('overwrites existing files and emits isNew=false', () => {
    const tmp = makeTmp();
    fs.writeFileSync(path.join(tmp, 'f.ts'), 'old');
    const events: unknown[] = [];

    writeFiles(tmp, { 'f.ts': 'new' }, (e) => events.push(e));

    expect(fs.readFileSync(path.join(tmp, 'f.ts'), 'utf-8')).toBe('new');
    expect((events[0] as Record<string, unknown>).isNew).toBe(false);
  });

  test('emits correct linesAdded/linesRemoved', () => {
    const tmp = makeTmp();
    fs.writeFileSync(path.join(tmp, 'f.ts'), 'a\nb\nc\n');
    const events: unknown[] = [];

    writeFiles(tmp, { 'f.ts': 'a\nb\nX\nY\n' }, (e) => events.push(e));

    const ev = events[0] as Record<string, unknown>;
    expect(ev.linesAdded).toBe(2);  // X, Y replace c → +2
    expect(ev.linesRemoved).toBe(1); // only c removed (trailing '' is common)
  });

  test('creates intermediate directories', () => {
    const tmp = makeTmp();
    writeFiles(tmp, { 'deep/nested/dir/file.ts': 'x' }, () => {});
    expect(fs.existsSync(path.join(tmp, 'deep/nested/dir/file.ts'))).toBe(true);
  });
});
