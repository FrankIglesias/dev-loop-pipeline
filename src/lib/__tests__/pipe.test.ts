import { describe, expect, test } from 'bun:test';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { getRepoStructure, loadGitignoreNames } from '@/lib/helpers/repoUtils';

// ── helpers ───────────────────────────────────────────────────────────────────

function makeTmpRepo(files: Record<string, string | null>): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pipe-test-'));
  for (const [rel, content] of Object.entries(files)) {
    const full = path.join(dir, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    if (content === null) {
      // directory marker
      fs.mkdirSync(full, { recursive: true });
    } else {
      fs.writeFileSync(full, content);
    }
  }
  return dir;
}

// ── loadGitignoreNames ────────────────────────────────────────────────────────

describe('loadGitignoreNames', () => {
  test('returns empty set when no .gitignore exists', () => {
    const dir = makeTmpRepo({});
    expect(loadGitignoreNames(dir).size).toBe(0);
  });

  test('parses simple bare names', () => {
    const dir = makeTmpRepo({ '.gitignore': 'build\nout\n' });
    const names = loadGitignoreNames(dir);
    expect(names.has('build')).toBe(true);
    expect(names.has('out')).toBe(true);
  });

  test('strips trailing slash from directory entries', () => {
    const dir = makeTmpRepo({ '.gitignore': 'dist/\n.cache/\n' });
    const names = loadGitignoreNames(dir);
    expect(names.has('dist')).toBe(true);
    expect(names.has('.cache')).toBe(true);
  });

  test('ignores comment lines', () => {
    const dir = makeTmpRepo({ '.gitignore': '# this is a comment\nbuild\n' });
    const names = loadGitignoreNames(dir);
    expect(names.has('build')).toBe(true);
    expect([...names].some((n) => n.startsWith('#'))).toBe(false);
  });

  test('ignores glob patterns (lines containing *)', () => {
    const dir = makeTmpRepo({ '.gitignore': '*.log\n*.env\nbuild\n' });
    const names = loadGitignoreNames(dir);
    expect([...names].some((n) => n.includes('*'))).toBe(false);
    expect(names.has('build')).toBe(true);
  });

  test('ignores negation patterns', () => {
    const dir = makeTmpRepo({ '.gitignore': '!keep-this\nbuild\n' });
    const names = loadGitignoreNames(dir);
    expect(names.has('keep-this')).toBe(false);
    expect(names.has('build')).toBe(true);
  });

  test('ignores nested paths (containing /)', () => {
    const dir = makeTmpRepo({ '.gitignore': 'some/nested/path\nbuild\n' });
    const names = loadGitignoreNames(dir);
    expect(names.has('some/nested/path')).toBe(false);
    expect(names.has('build')).toBe(true);
  });

  test('ignores blank lines', () => {
    const dir = makeTmpRepo({ '.gitignore': '\n\nbuild\n\n' });
    const names = loadGitignoreNames(dir);
    expect(names.has('')).toBe(false);
    expect(names.has('build')).toBe(true);
  });
});

// ── getRepoStructure ──────────────────────────────────────────────────────────

describe('getRepoStructure', () => {
  test('lists files and directories', () => {
    const dir = makeTmpRepo({
      'src/index.ts': 'export {}',
      'README.md': '# hello',
    });
    const output = getRepoStructure(dir);
    expect(output).toContain('src');
    expect(output).toContain('README.md');
  });

  test('always excludes node_modules and .git', () => {
    const dir = makeTmpRepo({
      'node_modules/pkg/index.js': '',
      '.git/config': '',
      'src/index.ts': '',
    });
    const output = getRepoStructure(dir);
    expect(output).not.toContain('node_modules');
    expect(output).not.toContain('.git');
    expect(output).toContain('src');
  });

  test('excludes directories listed in .gitignore', () => {
    const dir = makeTmpRepo({
      '.gitignore': 'build\nout\n',
      'build/bundle.js': '',
      'out/index.html': '',
      'src/app.ts': '',
    });
    const output = getRepoStructure(dir);
    expect(output).not.toContain('build');
    expect(output).not.toContain('out');
    expect(output).toContain('src');
  });

  test('respects maxDepth', () => {
    const dir = makeTmpRepo({
      'a/b/c/deep.ts': '',
      'a/b/shallow.ts': '',
    });
    const output = getRepoStructure(dir, 1);
    expect(output).not.toContain('deep.ts');
  });

  test('directories appear before files (sorted)', () => {
    const dir = makeTmpRepo({
      'zfile.ts': '',
      'adir/index.ts': '',
    });
    const lines = getRepoStructure(dir).split('\n');
    const dirIdx = lines.findIndex((l) => l.includes('adir'));
    const fileIdx = lines.findIndex((l) => l.includes('zfile.ts'));
    expect(dirIdx).toBeLessThan(fileIdx);
  });

  test('returns empty string for empty directory', () => {
    const dir = makeTmpRepo({});
    expect(getRepoStructure(dir)).toBe('');
  });
});
