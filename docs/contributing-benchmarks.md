# Contributing benchmarks

Benchmark contributions should represent escaped regressions or distinct
false-positive pressure without exposing private code.

## Rules

1. You must have the right to redistribute every fixture byte under this
   repository's MIT license.
2. Remove company, client, employee, domain, credential, incident, and product
   identifiers. Prefer a minimal synthetic reconstruction.
3. Preserve the failure shape, not proprietary implementation detail.
4. Put reviewable inputs in `benchmarks/cases/<id>/case.json`.
5. Put the causal location and pass conditions only in
   `benchmarks/oracles/<id>.json`.
6. Never add an expected-result marker, revealing filename, comment, or commit
   message to the fixture.
7. Add focused tests for location movement, deletion, rename, or restraint
   semantics that the case introduces.

## Case review

A maintainer should verify:

- the fixture is redistributable and contains no sensitive data;
- the oracle cannot be enumerated from the temporary execution repository;
- the causal range identifies the precise damaging hunk;
- required reasons describe supported impact evidence rather than path-name
  intuition;
- the case is meaningfully different from existing fixtures;
- the result is stable across repeated runs and operating systems.

Do not weaken an oracle merely to make a changed heuristic pass. Explain the
evidence model change and show why the new contract better represents human
review attention.
