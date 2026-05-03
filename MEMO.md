# Lessons-to-Skills Memo

Three failure modes from real dev loops. Each one maps to a specific skill or handoff in this pipeline.

---

## 1 → spec-freeze: Spec drift via async channels

### What broke

We were building a filtering feature. The Linear ticket said "users can filter posts by tag." A Slack thread said "we also need AND vs OR logic for multiple tags." A follow-up Loom video said "just start simple, we'll iterate." Three engineers on the call had three different mental models of done.

The implementer followed the Loom ("start simple, just OR logic"). The reviewer came to the PR expecting AND/OR because that's what Slack said. The product manager thought we were shipping only the basic filter because that's what the ticket said.

The result: a three-day re-review cycle, a scope debate on a merged PR, and a follow-up ticket that duplicated work already done.

Nobody was wrong. The spec just lived across Jira, Slack, and one person's memory simultaneously.

### What this pipeline does instead

`spec-freeze` runs first, before a single file is opened. It reads whatever source exists (ticket text, description, notes) and produces a single typed JSON artifact with an explicit `out_of_scope` array.

For this case: `"out_of_scope": ["AND vs OR logic for multi-tag filtering — defer to next iteration"]`.

That artifact is saved to disk (`01-spec.json`) before implementation starts. Everything downstream reads from it. If a Slack thread tries to expand scope mid-flight, it changes the frozen spec first — not the implementation, not the review conversation.

The `out_of_scope` field is the critical one. It's easy to write down what the feature *does*. Writing down what it explicitly *does not do* is the thing that prevents scope creep from being a conversation that happens on the PR instead of before the code.

---

## 2 → qa-gate: QA theater — CI is green, the feature is wrong

### What broke

We built a "mark notification as read" feature. The API test verified the endpoint returned 200. TypeScript compiled. The linter passed. The feature shipped.

Three days later: users reported the unread count badge in the nav wasn't decrementing. The test checked the server response. The unread count was client state managed by a Zustand store. Nobody had tested whether the store actually updated. CI was green. The feature was broken in the one place users actually saw it.

This is the failure mode I think of as "test theater." The tests are real, they pass, and they tell you nothing about whether the feature works.

### What this pipeline does instead

`qa-gate` doesn't ask "do tests pass?" It asks "does the written code satisfy each acceptance criterion?"

The criterion was: "unread count in the nav badge decrements immediately when a notification is marked as read." The gate receives that criterion, the changed files, and their contents. If `changes_made` shows only server-side files changed and the acceptance criterion mentions client state, the gate returns `not-verified` — not a pass.

The structural decision that makes this work: **qa-gate does NOT receive the impl-map**. If it could see "the plan said to update the Zustand store," it might rationalize passing a criterion the update doesn't actually satisfy. Blinding it to the plan forces honest evaluation. The gate only knows what was built and what it was supposed to do. That's the correct evaluation surface.

---

## 3 → pr-package: Review comments that became follow-up promises that became nothing

### What broke

A PR review on an upload feature had three reviewer comments:

1. "Extract the upload size limit to a config constant — it's hardcoded in three places."
2. "The `countUploadsToday` function needs a test — it has a boundary condition at midnight."
3. "This `<img>` is missing an `alt` attribute."

The implementer replied to all three: "Good catch — I'll do a follow-up ticket for each." PR approved, merged.

Six months later, during an on-call incident caused by the midnight boundary condition: no follow-up tickets had ever been created. The reviewer's comment was the only record they'd ever been noticed. Searching "countUploadsToday" across Jira and Slack found nothing.

This happens constantly. The reviewer and implementer both genuinely intend to follow up. Neither creates the ticket. The context is lost.

### What this pipeline does instead

`pr-package` produces `follow_ups` as a first-class typed field in its JSON output — not a checkbox in the PR body, not a comment reply, a structured array:

```json
{
  "follow_ups": [
    {
      "title": "Add unit test for countUploadsToday boundary condition at midnight",
      "reason": "QA gate flagged missing test coverage for non-trivial time boundary",
      "priority": "medium"
    }
  ]
}
```

Every `partial` criterion, every `warning` issue from the gate, and every `what_not_done` item from code-write automatically becomes a follow-up entry. The PR template renders them as a `## Follow-ups` table that reviewers see before approving.

The key is making follow-ups a typed output rather than an informal promise. A field in a JSON object has to be filled — it either has entries or it has `[]`. An informal comment reply can disappear. The act of making the gap explicit and structured is what changes the behavior: it's either captured before the PR merges or it doesn't exist.
