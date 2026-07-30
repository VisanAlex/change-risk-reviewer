# Stories Report Contract

Start every result with the selected requirements and repository state:

`Stories scope: <requirements/design artifacts> against <repository and revision>.`

If a prior preflight report was supplied, name its baseline and disclose
whether the current repository has materially drifted from it.
If none was supplied, state `not assessed: no prior preflight supplied`; never
use `none observed` without a comparison baseline.

## Default output

```text
## Repository recheck

- Current behavior: <fact with exact repository citation, or `new proposal
  scope` with exact requirement citation or `user-stated decision` when no
  current counterpart applies>
- Direct impact: <existing surface with repository evidence, or new area with
  exact requirement citation or `user-stated decision` and a `new proposal
  scope` label>
- Indirect impact: <surface, relationship, and evidence>
- Drift since preflight: <verified change | none observed | `not assessed: no
  prior preflight supplied`>

## Technical stories

### STORY-001: <outcome-oriented title>

Status: <ready | partial | blocked>
Requirements: <REQ IDs>

Objective:
<user or operational outcome>

Current behavior:
<verified repository behavior with exact citations, or `new proposal scope`
with exact requirement citation or `user-stated decision` when no current
counterpart applies>

Desired behavior:
<finalized requirement with artifact citation or user-stated decision>

Delta:
<smallest meaningful behavioral difference between current and desired
behavior>

Scope:
- <behavior included>

Affected areas:
- <existing component or file with exact repository citation and why it is
  relevant, or proposed area with exact requirement citation or `user-stated
  decision` and a `new proposal scope` label>

Business contracts:
- <rule that must remain true>

Acceptance scenarios:
1. <falsifiable scenario>

Dependencies:
- <story, decision, or external dependency>

Unknowns:
- <material unresolved point or "None identified">

Out of scope:
- <explicit exclusion>

## Requirement coverage

| Requirement | Primary story | Status | Evidence |
|---|---|---|---|
| REQ-001 | STORY-001 | ready | path:lines, requirement citation, or `user-stated decision` |

## Cross-story risks and dependencies

- <shared contract, ordering dependency, or indirect impact>

## Coverage limits

- <artifact, revision, search, semantic, or execution limit>
```

## Handoff mode

When another story-writing skill owns final formatting, replace `Technical
stories` with:

```text
## Story Evidence Pack

### STORY-CANDIDATE-001

- Requirements: <REQ IDs>
- Outcome: <one independently verifiable result>
- Current behavior: <fact and exact repository citation, or `new proposal
  scope` with exact requirement citation or `user-stated decision`>
- Desired behavior: <requirement evidence>
- Delta: <specific difference>
- Direct impact: <areas and evidence>
- Indirect impact: <areas, relationship, and evidence>
- Candidate components: <evidence-backed areas>
- Business contracts: <rules to preserve>
- Acceptance scenarios: <falsifiable scenarios>
- Dependencies: <other candidates or decisions>
- Unknowns: <material unresolved points>
- Status: <ready | partial | blocked>
```

Keep the requirement coverage, cross-story risks, and coverage limits sections.
The pack must be self-contained so another skill does not need access to the
conversation.

## Contract rules

- Give every claim about existing current behavior or an affected existing area
  an exact repository citation.
- For a wholly new area with no current counterpart, give an exact requirement
  citation or label it `user-stated decision`, then label the area
  `new proposal scope`; do not require a repository citation.
- Never attach an unrelated repository location merely to satisfy the story
  shape for `new proposal scope`.
- Indirect impact on an existing surface still requires exact repository
  evidence for the relationship.
- Give every desired-behavior claim a requirement citation or label it as a
  user-stated decision.
- Give every complete story an explicit `Delta` that states the smallest
  meaningful behavioral difference between current and desired behavior.
- When a prior preflight exists, report verified drift or `none observed`.
  Without one, report `not assessed: no prior preflight supplied`; never imply
  that drift was checked.
- Do not report `ready` when a material product decision remains unresolved.
- Do not mark a finalized requirement `partial` or `blocked` merely because its
  `new proposal scope` has no repository counterpart.
- Do not silently omit requirements that do not fit a story. Mark them
  `partial` or `blocked`.
- Do not call textual references runtime call sites.
- Do not say the stories are complete, approved, safe, or guaranteed to prevent
  implementation defects.
