# Preflight Report Contract

Lead with current behavior and the direct and indirect impact map, then the
small number of contracts that deserve attention before design is finalized.

## Output shape

```text
## Current behavior

- <verified flow or rule with exact target citation>

## Impact map

### Direct

- <existing screen, flow, service, data, or integration explicitly changed;
  exact proposal citation and exact target citation>
- <new proposal-only screen, route, service, data, or integration; exact
  proposal citation and `new proposal scope` label>

### Indirect

- <related existing surface, exact target evidence for the relationship, and
  possible effect>

## Preflight first

1. Target contract: <target path:line range>
   Proposal evidence: <prototype/spec path:line range or user-stated proposal>
   Evidence:
   - Target fact: <verified behavior>
   - Proposal fact: <verified behavior, bounded omission, or unknown>
   Potential mismatch (<confidence>): <specific business or integration impact>
   Preserve: <contract the production implementation must retain>
   Prove before implementation: <specific test, example, trace, or stakeholder
   confirmation>

## Contracts already represented

- <behavior supported by evidence on both sides>

## Unknowns and assumptions

- <material fact the available artifacts do not establish>

## Suggested target files to understand

- <path:line range> because <specific relevance>

## Coverage limits

- <artifact, revision, search, semantic, or execution limit>
```

## Finding requirements

- Give every current-behavior claim an exact target citation.
- Give impact-map claims evidence appropriate to the claim:
  - direct changes to existing behavior need exact proposal and target
    citations;
  - proposal-only additions need an exact proposal citation and a
    `new proposal scope` label, but do not require a target citation;
  - indirect impact needs exact target evidence for the relationship to the
    affected existing surface.
- Never attach an unrelated target location merely to satisfy the report
  shape for a proposal-only addition.
- Distinguish direct proposal scope from indirect evidence-backed impact.
- Do not infer indirect impact from file proximity or naming alone.
- Report no more than five findings and prefer one to three.
- Give every finding an exact target location.
- Give exact proposal locations when an artifact supports them. Use
  `user-stated proposal` only for behavior supplied directly in the
  conversation.
- If proposal behavior is missing, describe the bounded search that supports
  the omission observation. Otherwise classify it as unknown.
- Put confidence only on the potential mismatch inference.
- Make `Preserve` a behavioral contract, not an implementation prescription.
- Make `Prove before implementation` concrete and falsifiable.
- Do not promote missing tests by itself. Tests may be the best way to prove a
  separately evidenced contract.

## Quiet result

If the bounded comparison finds no specific mismatch, say:

`No evidence-backed compatibility mismatch was found in the selected artifacts.`

Still report material unknowns and coverage limits. Do not replace the quiet
result with a safety or approval statement.

## Scope language

Name both baselines at the start of the report:

`Preflight scope: <proposal artifact> against <target baseline>.`

When either side is a Git revision, include the resolved revision identity.
When the prototype is in another language, name both languages only as context.
Do not treat the language difference as a risk signal.
