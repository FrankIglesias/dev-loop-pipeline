import { describe, expect, test } from 'bun:test';
import { getStepSummary } from '../stepSummary';

describe('getStepSummary', () => {
  test('returns empty array for null/non-object input', () => {
    expect(getStepSummary('spec-freeze', null)).toEqual([]);
    expect(getStepSummary('spec-freeze', 'string')).toEqual([]);
    expect(getStepSummary('spec-freeze', 42)).toEqual([]);
  });

  describe('spec-freeze', () => {
    test('shows title and acceptance criteria count', () => {
      const lines = getStepSummary('spec-freeze', {
        title: 'Add standup feed',
        acceptance_criteria: ['a', 'b', 'c'],
        constraints: [],
      });
      expect(lines[0].text).toContain('Add standup feed');
      expect(lines[1].text).toContain('3 acceptance criteria');
    });

    test('shows constraints when present', () => {
      const lines = getStepSummary('spec-freeze', {
        title: 'T',
        acceptance_criteria: [],
        constraints: ['no breaking changes', 'mobile first'],
      });
      expect(lines.some((l) => l.text.includes('2 constraints'))).toBe(true);
    });

    test('omits constraints line when empty', () => {
      const lines = getStepSummary('spec-freeze', {
        title: 'T',
        acceptance_criteria: [],
        constraints: [],
      });
      expect(lines.every((l) => !l.text.includes('constraints'))).toBe(true);
    });

    test('falls back to (no title) when title missing', () => {
      const lines = getStepSummary('spec-freeze', { acceptance_criteria: [] });
      expect(lines[0].text).toContain('(no title)');
    });
  });

  describe('impl-scout', () => {
    const implData = {
      files_to_change: [
        { path: 'lib/posts.ts', action: 'modify', layer: 'lib' },
        { path: 'app/api/posts/route.ts', action: 'create', layer: 'api' },
      ],
      risks: [{ description: 'race condition', mitigation: 'use transactions' }],
    };

    test('lists file count and each file', () => {
      const lines = getStepSummary('impl-scout', implData);
      expect(lines[0].text).toContain('2 file(s) to touch');
      expect(lines.some((l) => l.text.includes('lib/posts.ts'))).toBe(true);
      expect(lines.some((l) => l.text.includes('app/api/posts/route.ts'))).toBe(true);
    });

    test('uses ✚ for create and ✎ for modify', () => {
      const lines = getStepSummary('impl-scout', implData);
      const modifyLine = lines.find((l) => l.text.includes('lib/posts.ts'));
      const createLine = lines.find((l) => l.text.includes('app/api/posts/route.ts'));
      expect(modifyLine?.text).toContain('✎');
      expect(createLine?.text).toContain('✚');
    });

    test('shows risk count', () => {
      const lines = getStepSummary('impl-scout', implData);
      expect(lines.some((l) => l.text.includes('1 risk(s)'))).toBe(true);
    });

    test('omits risk line when no risks', () => {
      const lines = getStepSummary('impl-scout', { ...implData, risks: [] });
      expect(lines.every((l) => !l.text.includes('risk'))).toBe(true);
    });
  });

  describe('code-write', () => {
    test('lists written files and deferred count', () => {
      const lines = getStepSummary('code-write', {
        files_changed: ['lib/posts.ts', 'components/Feed.tsx'],
        what_not_done: ['migration file'],
      });
      expect(lines[0].text).toContain('2 file(s) written');
      expect(lines.some((l) => l.text.includes('lib/posts.ts'))).toBe(true);
      expect(lines.some((l) => l.text.includes('1 item(s) deferred'))).toBe(true);
    });

    test('omits deferred line when what_not_done is empty', () => {
      const lines = getStepSummary('code-write', {
        files_changed: ['lib/posts.ts'],
        what_not_done: [],
      });
      expect(lines.every((l) => !l.text.includes('deferred'))).toBe(true);
    });
  });

  describe('qa-gate', () => {
    const makeResult = (status: string) => ({ status, issues: [] });

    test('shows PASSED in green when passed is true', () => {
      const lines = getStepSummary('qa-gate', {
        passed: true,
        criteria_results: [makeResult('verified'), makeResult('verified')],
      });
      const verdict = lines.find((l) => l.text.includes('QA'));
      expect(verdict?.text).toContain('PASSED');
      expect(verdict?.cls).toBe('green');
    });

    test('shows FAILED in red when passed is false', () => {
      const lines = getStepSummary('qa-gate', {
        passed: false,
        criteria_results: [makeResult('verified'), makeResult('failed')],
      });
      const verdict = lines.find((l) => l.text.includes('QA'));
      expect(verdict?.text).toContain('FAILED');
      expect(verdict?.cls).toBe('red');
    });

    test('counts each status correctly', () => {
      const lines = getStepSummary('qa-gate', {
        passed: false,
        criteria_results: [
          makeResult('verified'),
          makeResult('failed'),
          makeResult('partial'),
          makeResult('not-verified'),
        ],
      });
      const counts = lines.find((l) => l.text.includes('verified:'));
      expect(counts?.text).toContain('verified: 1');
      expect(counts?.text).toContain('failed: 1');
      expect(counts?.text).toContain('partial: 1');
      expect(counts?.text).toContain('not-verified: 1');
    });

    test('shows issue count when issues exist', () => {
      const lines = getStepSummary('qa-gate', {
        passed: false,
        criteria_results: [{ status: 'failed', issues: ['missing auth', 'no validation'] }],
      });
      expect(lines.some((l) => l.text.includes('2 issue(s)'))).toBe(true);
    });
  });

  describe('pr-package', () => {
    test('shows PR title and branch', () => {
      const lines = getStepSummary('pr-package', {
        pr_title: 'feat: add standup feed',
        branch: 'feat/standup-feed',
        follow_ups: [],
      });
      expect(lines[0].text).toContain('feat: add standup feed');
      expect(lines.some((l) => l.text.includes('feat/standup-feed'))).toBe(true);
    });

    test('shows follow-up count', () => {
      const lines = getStepSummary('pr-package', {
        pr_title: 'T',
        branch: 'b',
        follow_ups: ['add tests', 'update docs'],
      });
      expect(lines.some((l) => l.text.includes('2 follow-up(s)'))).toBe(true);
    });

    test('omits follow-up line when none', () => {
      const lines = getStepSummary('pr-package', {
        pr_title: 'T',
        branch: 'b',
        follow_ups: [],
      });
      expect(lines.every((l) => !l.text.includes('follow-up'))).toBe(true);
    });
  });
});
