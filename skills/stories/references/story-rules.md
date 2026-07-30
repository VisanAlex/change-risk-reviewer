# Story Rules

## Evidence hierarchy

Prefer:

1. Exact current behavior in the selected repository state.
2. Explicit finalized requirements or approved product decisions.
3. Tests, policies, validation, calculations, state transitions, and side
   effects that document existing business contracts.
4. Direct and indirect consumers supported by imports, references, routes,
   events, jobs, persistence, or integrations.
5. Earlier preflight reports and designer notes used as search leads.

An earlier preflight statement is not current repository evidence. Recheck its
important claims and disclose revision or behavior drift.
When no earlier preflight was supplied, label drift `not assessed: no prior
preflight supplied`; do not imply that a comparison found no drift.

## Current-to-desired delta

For every requirement, record:

- current behavior with repository evidence, or `new proposal scope` with an
  exact requirement citation or `user-stated decision` when no current
  counterpart applies;
- desired behavior with requirement evidence;
- the smallest meaningful behavioral difference;
- direct and indirect affected areas;
- business contracts that remain true;
- unknown product or technical decisions.

Different wording is not a behavioral delta. Missing proposal detail is an
unknown unless the requirement artifact was searched with enough coverage to
support an omission observation.

## Story slicing

Prefer vertical outcome slices that a reviewer can understand and verify.
Include all technical layers needed for that outcome inside the same story.

Create a separate story only when the work has an independent outcome,
acceptance boundary, rollout boundary, or prerequisite that can be verified on
its own. Do not split solely by:

- frontend versus backend;
- controller versus service;
- database versus application code;
- implementation versus tests;
- one file or component per story.

When one business contract affects several stories, repeat the concise contract
and identify the shared dependency. Do not assume another story will preserve
it implicitly.

## Acceptance scenarios

Make scenarios falsifiable and tied to the stated delta. Include:

- the primary successful behavior;
- rejected or unauthorized behavior when relevant;
- important boundary calculations or state transitions;
- indirect consumers when shared behavior changes;
- failure or partial-success behavior when side effects are involved.

Do not prescribe automated versus manual execution unless the requirement or
repository evidence makes that distinction material.

## Components and files

List existing components, files, routes, services, policies, jobs, events,
tables, or integrations only when repository evidence supports their
relevance. A wholly new area may instead be supported by an exact finalized
requirement citation or `user-stated decision`; label it `new proposal scope`
and do not imply that it already exists. Describe existing areas as affected or
candidate areas. Do not turn an existing implementation detail into a mandatory
future design without a finalized decision.

## Coverage status

- `ready`: desired behavior and relevant current contracts are sufficiently
  established to write a verifiable story.
- `partial`: a story can be drafted, but one or more material details remain
  uncertain.
- `blocked`: writing an actionable story would require inventing product
  behavior or choosing between materially different outcomes.

Never hide `partial` or `blocked` status to make the story set appear complete.
