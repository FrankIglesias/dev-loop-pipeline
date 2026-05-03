// ─────────────────────────────────────────────────────────────────────────────
// Canonical handoff types for the dev-loop pipeline.
//
// Fields marked [DROP after step N] are never forwarded downstream —
// the compression extractors in pipe.ts enforce this structurally.
// ─────────────────────────────────────────────────────────────────────────────

import type { LLMProvider } from './provider';

// ── Pipeline input ──────────────────────────────────────────────────────────
export interface PipelineInput {
  ticketId: string;
  ticketText?: string;
  repoPath: string;
  runId: string;
  fromStep?: number;
  provider: LLMProvider;
}

// ── Step 1 output: spec-freeze ───────────────────────────────────────────────
// Frozen at ~300 tokens by design. No prose, only structured fields.
export interface FrozenSpec {
  ticket_id: string;
  title: string; // one sentence — the "what"
  goal: string; // one sentence — the "why"
  acceptance_criteria: string[]; // ≤8 items, each verifiable
  constraints: string[]; // fixed limits that cannot be changed
  out_of_scope: string[]; // explicit deferrals

  // Provenance only — never forwarded downstream
  _raw_ticket_summary?: string; // [DROP before step 2]
  _raw_description?: string; // [DROP before step 2]
}

// ── Step 2 output: impl-scout ────────────────────────────────────────────────
// Input: full FrozenSpec (~300 tokens)
// Output: compressed to what code-write needs (~500 tokens)
export interface ImplMap {
  ticket_id: string;
  files_to_change: FileChange[];
  patterns_to_follow: Pattern[];
  risks: Risk[];
  approach_summary: string; // ≤3 sentences

  // Carried from spec — forwarded to code-write
  acceptance_criteria: string[];
}

export interface FileChange {
  path: string;
  action: 'modify' | 'create' | 'test-add';
  reason: string;
  layer: 'schema' | 'api' | 'component' | 'lib' | 'test' | 'e2e';
}

export interface Pattern {
  description: string;
  example_file: string; // real path in the repo
}

export interface Risk {
  description: string;
  mitigation: string;
}

// ── Step 3 output: code-write ────────────────────────────────────────────────
// Input: ImplMap fields + acceptance_criteria + existing file contents
//        NOT received: spec.goal, spec.constraints, spec.out_of_scope
export interface CodeSummary {
  ticket_id: string;
  files_changed: string[];
  changes_made: ChangeMade[];
  what_not_done: string[]; // explicit deferrals

  // Carried forward to qa-gate
  acceptance_criteria: string[];

  // Actual file contents written to disk by pipe.ts after this step
  file_contents: Record<string, string>;
}

export interface ChangeMade {
  path: string;
  summary: string; // ≤2 sentences
  test_coverage: 'unit' | 'e2e' | 'none';
}

// ── Step 4 output: qa-gate ───────────────────────────────────────────────────
// Input: CodeSummary + written file contents
//        NOT received: ImplMap (dropped entirely after step 3)
export interface QaReport {
  ticket_id: string;
  criteria_results: CriterionResult[];
  issues: Issue[];
  passed: boolean;
  lint_and_types_passed: boolean;

  // Carried to pr-package
  acceptance_criteria: string[];
  files_changed: string[];
}

export interface CriterionResult {
  criterion: string;
  status: 'verified' | 'partial' | 'not-verified' | 'blocked';
  evidence: string; // must reference specific files and code
  issues: string[];
}

export interface Issue {
  severity: 'blocker' | 'warning' | 'suggestion';
  description: string;
  file: string | null;
  suggestion: string | null;
}

// ── Step 5 output: pr-package ────────────────────────────────────────────────
// Input: spec.title + acceptance_criteria + full QaReport + files_changed
//        NOT received: ImplMap, full CodeSummary.changes_made, full FrozenSpec
export interface PrPackage {
  ticket_id: string;
  pr_title: string;
  pr_body: string; // GitHub markdown
  follow_ups: FollowUp[]; // first-class output, not buried in description
}

export interface FollowUp {
  title: string;
  reason: string;
  priority: 'high' | 'medium' | 'low';
}

// ── Compression map ───────────────────────────────────────────────────────────
//
// spec-freeze  →  impl-scout:    FULL FrozenSpec (all fields, ~300 tokens)
//
// impl-scout   →  code-write:    files_to_change + patterns_to_follow + risks
//                                + approach_summary + acceptance_criteria + ticket_id
//                                + existing_file_contents (read from disk by pipe.ts)
//                                DROP: _raw_* fields from FrozenSpec
//                                DROP: spec.goal, .constraints, .out_of_scope
//
// code-write   →  qa-gate:       files_changed + changes_made + what_not_done
//                                + acceptance_criteria
//                                + written_file_contents (re-read from disk by pipe.ts)
//                                DROP: ImplMap entirely
//
// qa-gate      →  pr-package:    full QaReport
//                                + spec.title (only field from FrozenSpec)
//                                DROP: changes_made detail, full ImplMap, full FrozenSpec
