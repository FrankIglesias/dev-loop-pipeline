# dev-loop-pipeline

A five-skill AI pipeline for a structured feature dev loop. Runs entirely in the browser — no CLI, no terminal required.

```
spec-freeze → impl-scout → code-write → qa-gate → pr-package
```

Each skill owns one responsibility and produces a typed JSON output that becomes the next skill's input. Context is explicitly compressed at every handoff to minimise token usage and prevent downstream steps from rationalising constraint violations.

---

## Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15.3 (App Router) |
| Runtime & package manager | Bun 1.1+ |
| Language | TypeScript 5, strict mode |
| Linter / formatter | Biome (semicolons, single quotes, 2-space indent) |
| LLM providers | LM Studio (default), Anthropic, OpenAI |
| JSON recovery | `jsonrepair` — 3-layer fallback parse |
| Tests | `bun test` |

---

## Prerequisites

- **[LM Studio](https://lmstudio.ai/)** — required as the default local LLM provider. Install it, download a model (e.g. `llama3.2`), and start its local server (default `http://localhost:1234/v1`). Anthropic and OpenAI are optional alternatives.
- **[Bun](https://bun.sh/)** 1.1+

---

## Install

```bash
bun install
```

---

## Run the UI

```bash
bun dev
```

Opens at **http://localhost:5173**.

Fill in:
- **Ticket ID** — e.g. `BCNP-42`
- **Provider** — LM Studio (local), Anthropic, or OpenAI
- **Model** — auto-detected for LM Studio; type manually for Anthropic / OpenAI
- **Repo path** — absolute path to the target repository
- **Ticket description** — optional but recommended for better output

Click **▶ Run pipeline**. Each step streams live to the log panel and updates its card when complete. Click any completed step card to inspect its full JSON output.

### Resume from a step

Every run gets a short `run-id` (e.g. `abc12345`) shown in the live log. Intermediate outputs are saved to `.pipeline-runs/{run-id}/`. To resume from step 3 without re-running steps 1–2, pass the same `run-id` and set `fromStep: 3` in the API body — or add a resume UI field.

---

## API

The UI hits a single endpoint:

```
POST /api/orchestrate
Content-Type: application/json
```

**Request body:**

```json
{
  "ticketId": "BCNP-42",
  "ticketText": "Add emoji reactions to standup posts…",
  "provider": "lmstudio",
  "model": "llama3.2",
  "repoPath": "/absolute/path/to/repo",
  "baseUrl": "http://localhost:1234/v1",
  "runId": "abc12345",
  "fromStep": 1
}
```

All fields except `ticketId` are optional. The endpoint responds with an **SSE stream** of newline-delimited `data: {...}` events.

**Event types:**

| Event | Fields |
|-------|--------|
| `run:start` | `runId`, `ticketId`, `repoPath`, `provider` |
| `step:start` | `step` (1–5), `name` |
| `step:provider` | `step`, `provider` |
| `step:saved` | `step`, `name`, `file`, `data`, `tokens` |
| `step:skipped` | `step`, `name` |
| `file:written` | `filePath`, `linesAdded`, `linesRemoved`, `isNew` |
| `run:done` | `prTitle`, `qaPassed`, `followUps`, `runDir` |
| `run:error` | `message` |

---

## Pipeline steps

| # | Skill | Responsibility | Output type |
|---|-------|----------------|-------------|
| 1 | `spec-freeze` | Convert a ticket into a frozen, verifiable spec | `FrozenSpec` |
| 2 | `impl-scout` | Audit the codebase and produce an implementation map | `ImplMap` |
| 3 | `code-write` | Write the code; return file contents + summary | `CodeSummary` |
| 4 | `qa-gate` | Verify each acceptance criterion against written code | `QaReport` |
| 5 | `pr-package` | Produce the PR description + explicit follow-ups | `PrPackage` |

Each skill is a Markdown file in `skills/` with a YAML frontmatter block:

```yaml
---
name: spec-freeze
provider: lmstudio
model: llama3.2
---
```

Resolution order for provider/model: **request body → skill frontmatter → default (LM Studio / llama3.2)**.

---

## Context compression

Every handoff is a deliberate compression decision. The step adapters live in [`src/lib/helpers/stepAdapters.ts`](src/lib/helpers/stepAdapters.ts) — one function per handoff, one file to audit.

```
spec-freeze  →  impl-scout
  SENDS:   full FrozenSpec + repo file tree (gitignore-aware, truncated at 200 lines)
  WHY:     impl-scout needs constraints and out-of-scope to produce a correct file list

impl-scout   →  code-write
  SENDS:   files_to_change + patterns + risks + approach_summary
           + acceptance_criteria + existing file contents (read from disk)
  DROPS:   spec.goal, spec.constraints, spec.out_of_scope
  WHY:     re-sending them lets code-write rationalize constraint violations
           instead of just following the plan

code-write   →  qa-gate
  SENDS:   files_changed + changes_made + what_not_done
           + acceptance_criteria + written file contents (re-read from disk)
  DROPS:   ImplMap entirely
  WHY:     the gate evaluates what was BUILT vs criteria — not plan vs criteria.
           File contents are re-read from disk so the gate sees what was
           actually written, not what the model claimed it wrote.

qa-gate      →  pr-package
  SENDS:   QaReport verdict + acceptance_criteria + files_changed + spec.title
  DROPS:   changes_made detail, full ImplMap, full FrozenSpec
  WHY:     a PR description needs the verdict and the file list, not the full
           implementation history.
```

---

## LLM providers

Three adapters, one interface:

```typescript
interface LLMProvider {
  name: string;
  complete(systemPrompt: string, userMessage: string): Promise<CompletionResult>;
}
```

| Adapter | File | Notes |
|---------|------|-------|
| `LMStudioProvider` | `providers/lmstudio.ts` | OpenAI-compatible, no API key, default |
| `AnthropicProvider` | `providers/anthropic.ts` | `@anthropic-ai/sdk`, requires `ANTHROPIC_API_KEY` |
| `OpenAIProvider` | `providers/openai.ts` | `openai` SDK, configurable `baseURL`, requires `OPENAI_API_KEY` |

---

## JSON parsing

LLM output is parsed with a 3-layer fallback:

1. `JSON.parse(raw)`
2. `JSON.parse(stripJsonFences(raw))` — strips ` ```json ``` ` wrappers
3. `JSON.parse(jsonrepair(stripped))` — recovers trailing commas, unquoted keys, etc.

Raw LLM output is always saved as `{step}.raw.txt` alongside the parsed JSON for debugging.

---

## Intermediate outputs

Each run saves step outputs under `.pipeline-runs/{run-id}/` (gitignored):

```
.pipeline-runs/abc12345/
├── 01-spec.json
├── 01-spec.json.raw.txt
├── 02-impl-map.json
├── 02-impl-map.json.raw.txt
├── 03-code-summary.json
├── 03-code-summary.json.raw.txt
├── 04-qa-report.json
├── 04-qa-report.json.raw.txt
├── 05-pr-package.json
└── 05-pr-package.json.raw.txt
```

---

## Project structure

```
dev-loop-pipeline/
├── skills/
│   ├── 01-spec-freeze.md
│   ├── 02-impl-scout.md
│   ├── 03-code-write.md
│   ├── 04-qa-gate.md
│   └── 05-pr-package.md
└── src/
    ├── app/
    │   ├── api/
    │   │   ├── orchestrate/route.ts   POST — runs pipeline, streams SSE
    │   │   └── models/route.ts        GET — lists LM Studio models
    │   ├── layout.tsx
    │   └── page.tsx
    ├── components/
    │   ├── PipelineApp.tsx            Root UI component
    │   ├── PipelineForm.tsx           Ticket / provider / model / repo inputs
    │   ├── StepGrid.tsx               Five step cards
    │   ├── StepCard.tsx               Single step card (idle/running/done/error)
    │   ├── LiveLog.tsx                Streaming log panel
    │   ├── ResultCard.tsx             Final run summary
    │   └── JsonDrawer.tsx             Step output inspector
    ├── hooks/
    │   ├── usePipeline.ts             Pipeline state, SSE streaming, reducer
    │   └── useModelDetect.ts          Auto-detect LM Studio models
    └── lib/
        ├── helpers/
        │   ├── highlight.ts           JSON syntax highlighter (HTML spans)
        │   ├── repoUtils.ts           loadGitignoreNames, getRepoStructure,
        │   │                          readFiles, lineDiff, writeFiles
        │   └── stepAdapters.ts        Context adapters — one per step handoff
        ├── pipeline/
        │   ├── context.ts             TypeScript interfaces for all handoffs
        │   ├── events.ts              PipelineEvent union type, OnEvent callback
        │   ├── pipe.ts                runPipeline — step orchestration
        │   ├── provider.ts            LLMProvider interface + factory
        │   ├── runner.ts              runSkill — calls provider, parses JSON
        │   └── providers/
        │       ├── anthropic.ts
        │       ├── lmstudio.ts
        │       └── openai.ts
        ├── stepSummary.ts             Converts step output → log lines
        └── types.ts                   Shared UI types (FormState, LogLine, etc.)
```

---

## Tests

```bash
bun test
```

76 tests across 5 suites:

| Suite | Tests | What it covers |
|-------|-------|----------------|
| `highlight.test.ts` | 18 | All `highlight()` branches — primitives, arrays, objects, HTML escaping, nesting |
| `repoUtils.test.ts` | 15 | `lineDiff`, `readFiles`, `writeFiles` — including diff counts, missing files, directory creation |
| `pipe.test.ts` | 14 | `loadGitignoreNames`, `getRepoStructure` — gitignore parsing, depth limit, sort order |
| `runner.test.ts` | 7 | `runSkill` — JSON parse fallbacks, jsonrepair recovery, event emission, context injection, provider factory |
| `stepSummary.test.ts` | 18 | `getStepSummary` — all 5 step types, edge cases, empty inputs |

### Lint & format

```bash
bun run lint      # biome lint
bun run format    # biome format --write
bun run check     # biome check --write (lint + format together)
```
