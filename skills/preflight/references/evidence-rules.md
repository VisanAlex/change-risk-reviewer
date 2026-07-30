# Preflight Evidence Rules

## Evidence hierarchy

Prefer evidence in this order:

1. Exact, contradictory behavior visible in both the target and proposal.
2. Existing target tests, policies, validation, calculations, state
   transitions, or side effects that define a business contract.
3. External boundaries such as routes, events, jobs, persistence, exports,
   notifications, and third-party API payloads.
4. Documentation and examples that agree with executable source.
5. Names, directory conventions, and textual references used only as search
   leads.

Tests can document existing behavior. They do not prove that the target is
correct or that the proposal has adequate coverage.

## Cross-language comparison

Map behavior through domain concepts rather than implementation vocabulary.
Useful comparison anchors include:

- input meaning and normalization;
- calculations, rounding, ordering, and time boundaries;
- authorization and actor scope;
- validation and rejected states;
- persisted fields and lifecycle transitions;
- emitted events, jobs, notifications, and audit records;
- external request and response contracts;
- retry, idempotency, and partial-failure behavior.

Matching class or function names are not proof of equivalent behavior. Different
control structures are not evidence of a mismatch by themselves.

## Omission and absence

Absence claims require a disclosed, bounded search. State what was searched and
where. Prefer:

`No handling for cancellation was found in the selected prototype files.`

Avoid:

`The prototype does not handle cancellation.`

If the proposal is only a short user description, label unspecified behavior as
an assumption or unknown, not a defect.

## Business importance

Prioritize contracts whose violation could affect unrelated users, money,
permissions, compliance, persisted data, external consumers, or irreversible
side effects. A narrowly used rule can still be important when it represents a
domain invariant. Breadth is evidence of impact, not a requirement for a
finding.

## Evidence labels

Keep these categories distinct:

- **Target fact**: verified in the target baseline.
- **Proposal fact**: verified in the prototype, specification, or user-stated
  proposal.
- **Inference**: a possible mismatch derived from cited facts. Attach `high`,
  `medium`, or `low` confidence.
- **Unknown**: information the available artifacts do not establish.

Never attach confidence to verified facts. Never present a textual reference as
a runtime call site.
