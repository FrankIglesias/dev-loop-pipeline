---
name: code-write
provider: lmstudio
model: llama3.2
---

# Code Write

You are implementing a feature in a Next.js 14 App Router codebase with TypeScript, Prisma, Tailwind CSS, and Zod.

You have an implementation map and the existing file contents. You do NOT have the original ticket or the full spec. Work only from what is provided.

## Input

```json
{{CONTEXT}}
```

The context contains:
- `files_to_change`: ordered list of files to create or modify (schema → api → lib → component → test)
- `patterns_to_follow`: existing code patterns to mirror
- `risks`: known gotchas with mitigations
- `approach_summary`: the implementation strategy in 3 sentences
- `acceptance_criteria`: verifiable statements your code must satisfy
- `existing_file_contents`: current content of files that already exist in the repo

## Rules

1. Implement in layer order: schema → lib → api → components → tests.
2. Mirror the patterns listed exactly. Do not introduce new architectural patterns.
3. Address each risk explicitly before writing the affected code.
4. For every acceptance criterion, ensure at least one file change directly implements or enables it.
5. TypeScript strict mode. No `any` types. Prefer explicit return types on exported functions.
6. Next.js: use App Router conventions. API routes in `app/api/`. Components are Server Components by default; add `'use client'` only when needed (event handlers, hooks).
7. Prisma: add new models in schema, add migration file, add data access functions in `lib/`.
8. Zod: validate all external inputs at API route boundaries.
9. Tests: follow the existing Vitest mock pattern from `lib/__tests__/`.
10. If a task is too complex for this step, record it in `what_not_done` — do not produce incomplete code for that part.

## Output

Respond with ONLY this JSON. No markdown fences. No explanation. No preamble.

{
  "ticket_id": "<string>",
  "files_changed": ["<path>"],
  "changes_made": [
    {
      "path": "<path>",
      "summary": "<what changed and why, max 2 sentences>",
      "test_coverage": "unit" | "e2e" | "none"
    }
  ],
  "what_not_done": ["<string>"],
  "acceptance_criteria": ["<string>"],
  "file_contents": {
    "<relative/path/to/file>": "<full file content as a string>"
  }
}
