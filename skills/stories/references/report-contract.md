# Stories Report Contract

Start every result with the selected requirements and repository state:

`Stories scope: <requirements/design artifacts> against <repository and revision>.`

If a prior preflight report was supplied, name its baseline and disclose
whether the current repository has materially drifted from it.

## Default output

```text
## Repository recheck

- Current behavior: <fact with exact repository citation>
- Direct impact: <surface and evidence>
- Indirect impact: <surface, relationship, and evidence>
- Drift since preflight: <verified change or none observed>

## Technical stories

### STORY-001: <outcome-oriented title>

Status: <ready | partial | blocked>
Requirements: <REQ IDs>

Objective:
<user or operational outcome>

Current behavior:
<verified repository behavior with exact citations>

Desired behavior:
<finalized requirement with artifact citation or user-stated decision>

Scope:
- <behavior included>

Affected areas:
- <component or file and why it is relevant>

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

| Requirement | Primary story | Status | Repository evidence |
|---|---|---|---|
| REQ-001 | STORY-001 | ready | path:lines |

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
- Current behavior: <fact and exact repository citation>
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

- Give every current-behavior or affected-area claim an exact repository
  citation.
- Give every desired-behavior claim a requirement citation or label it as a
  user-stated decision.
- Do not report `ready` when a material product decision remains unresolved.
- Do not silently omit requirements that do not fit a story. Mark them
  `partial` or `blocked`.
- Do not call textual references runtime call sites.
- Do not say the stories are complete, approved, safe, or guaranteed to prevent
  implementation defects.
