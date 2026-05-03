import * as fs from 'node:fs';
import * as path from 'node:path';
import type { OnEvent } from '@/lib/pipeline/events';

export function loadGitignoreNames(repoPath: string): Set<string> {
  const names = new Set<string>();
  const gitignorePath = path.join(repoPath, '.gitignore');
  if (!fs.existsSync(gitignorePath)) return names;

  for (const raw of fs.readFileSync(gitignorePath, 'utf-8').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#') || line.startsWith('!') || line.includes('*')) continue;
    const name = line.replace(/^\//, '').replace(/\/$/, '');
    if (name && !name.includes('/')) names.add(name);
  }
  return names;
}

export function getRepoStructure(repoPath: string, maxDepth = 3): string {
  const IGNORE = new Set([
    'node_modules',
    '.git',
    '.next',
    'dist',
    '.turbo',
    'coverage',
    '.cache',
    ...loadGitignoreNames(repoPath),
  ]);
  const lines: string[] = [];

  function walk(dir: string, depth: number, prefix: string): void {
    if (depth > maxDepth) return;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    entries
      .filter((e) => !IGNORE.has(e.name))
      .sort((a, b) => {
        if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
        return a.name.localeCompare(b.name);
      })
      .forEach((entry) => {
        lines.push(`${prefix}${entry.isDirectory() ? '/' : ' '} ${entry.name}`);
        if (entry.isDirectory()) walk(path.join(dir, entry.name), depth + 1, `${prefix}  `);
      });
  }

  walk(repoPath, 0, '');
  return lines.join('\n');
}

export function readFiles(repoPath: string, filePaths: string[]): Record<string, string> {
  return Object.fromEntries(
    filePaths
      .filter((f) => fs.existsSync(path.join(repoPath, f)))
      .map((f) => [f, fs.readFileSync(path.join(repoPath, f), 'utf-8')])
  );
}

// Counts added/removed lines using a multiset intersection — O(m+n).
export function lineDiff(oldText: string, newText: string): { added: number; removed: number } {
  if (oldText === newText) return { added: 0, removed: 0 };
  const freq = new Map<string, number>();
  for (const line of oldText.split('\n')) freq.set(line, (freq.get(line) ?? 0) + 1);
  let common = 0;
  for (const line of newText.split('\n')) {
    const n = freq.get(line) ?? 0;
    if (n > 0) {
      common++;
      freq.set(line, n - 1);
    }
  }
  const oldLines = oldText === '' ? 0 : oldText.split('\n').length;
  const newLines = newText === '' ? 0 : newText.split('\n').length;
  return { added: newLines - common, removed: oldLines - common };
}

export function writeFiles(
  repoPath: string,
  fileContents: Record<string, string>,
  onEvent: OnEvent
): void {
  for (const [filePath, content] of Object.entries(fileContents)) {
    const full = path.join(repoPath, filePath);
    const isNew = !fs.existsSync(full);
    const oldText = isNew ? '' : fs.readFileSync(full, 'utf-8');
    const { added, removed } = lineDiff(oldText, content);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content, 'utf-8');
    onEvent({ type: 'file:written', filePath, linesAdded: added, linesRemoved: removed, isNew });
  }
}
