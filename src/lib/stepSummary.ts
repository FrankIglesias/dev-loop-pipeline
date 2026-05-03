import type { LogLine, StepName } from './types';

type LogLineWithoutId = Omit<LogLine, 'id'>;

export function getStepSummary(name: StepName, data: unknown): LogLineWithoutId[] {
  if (!data || typeof data !== 'object') return [];

  const d = data as Record<string, unknown>;
  const lines: LogLineWithoutId[] = [];

  try {
    switch (name) {
      case 'spec-freeze': {
        const title = (d.title as string) ?? '(no title)';
        const ac = Array.isArray(d.acceptance_criteria) ? d.acceptance_criteria.length : 0;
        lines.push({ text: `  📋 "${title}"`, cls: 'info' });
        lines.push({ text: `  ${ac} acceptance criteria`, cls: 'muted' });
        if (Array.isArray(d.constraints) && d.constraints.length > 0) {
          lines.push({ text: `  ${d.constraints.length} constraints`, cls: 'muted' });
        }
        break;
      }

      case 'impl-scout': {
        const files = Array.isArray(d.files_to_change) ? d.files_to_change : [];
        lines.push({ text: `  🗂  ${files.length} file(s) to touch:`, cls: 'info' });
        for (const f of files) {
          const file = f as Record<string, unknown>;
          lines.push({
            text: `     ${file.action === 'create' ? '✚' : '✎'} ${file.path}  (${file.layer})`,
            cls: 'muted',
          });
        }
        if (Array.isArray(d.risks) && d.risks.length > 0) {
          lines.push({ text: `  ⚠️  ${d.risks.length} risk(s) flagged`, cls: 'muted' });
        }
        break;
      }

      case 'code-write': {
        const changed = Array.isArray(d.files_changed) ? d.files_changed : [];
        lines.push({ text: `  ✍️  ${changed.length} file(s) written:`, cls: 'info' });
        for (const f of changed) {
          lines.push({ text: `     ${f}`, cls: 'muted' });
        }
        const notDone = Array.isArray(d.what_not_done) ? d.what_not_done : [];
        if (notDone.length > 0) {
          lines.push({ text: `  ⚑  ${notDone.length} item(s) deferred`, cls: 'muted' });
        }
        break;
      }

      case 'qa-gate': {
        const results = Array.isArray(d.criteria_results) ? d.criteria_results : [];
        const verified = results.filter(
          (r: unknown) => (r as Record<string, unknown>).status === 'verified'
        ).length;
        const failed = results.filter(
          (r: unknown) => (r as Record<string, unknown>).status === 'failed'
        ).length;
        const partial = results.filter(
          (r: unknown) => (r as Record<string, unknown>).status === 'partial'
        ).length;
        const notV = results.filter(
          (r: unknown) => (r as Record<string, unknown>).status === 'not-verified'
        ).length;
        const pass = Boolean(d.passed);
        lines.push({
          text: `  ${pass ? '✅' : '❌'} QA ${pass ? 'PASSED' : 'FAILED'}`,
          cls: pass ? 'green' : 'red',
        });
        lines.push({
          text: `     verified: ${verified}  failed: ${failed}  partial: ${partial}  not-verified: ${notV}`,
          cls: 'muted',
        });
        const issues = results.flatMap((r: unknown) => {
          const rr = r as Record<string, unknown>;
          return Array.isArray(rr.issues) ? rr.issues : [];
        });
        if (issues.length > 0) {
          lines.push({ text: `     ${issues.length} issue(s) logged`, cls: 'muted' });
        }
        break;
      }

      case 'pr-package': {
        const title = (d.pr_title as string) ?? '(no title)';
        const branch = (d.branch as string) ?? '';
        lines.push({ text: `  🚀 PR: "${title}"`, cls: 'info' });
        if (branch) {
          lines.push({ text: `     branch: ${branch}`, cls: 'muted' });
        }
        const followUps = Array.isArray(d.follow_ups) ? d.follow_ups.length : 0;
        if (followUps > 0) {
          lines.push({ text: `     ${followUps} follow-up(s) noted`, cls: 'muted' });
        }
        break;
      }
    }
  } catch {
    // summary is best-effort
  }

  return lines;
}
