# Blind benchmarks

Benchmarks answer one narrow question: would the reviewer have directed a human
to the damaging changed location before the oracle was known?

Run:

```sh
npm run benchmark
```

Each directory under `cases/` is a redistributable fixture recipe. The runner:

1. builds a temporary Git repository containing only reviewable fixture data;
2. commits the base and candidate states;
3. captures `EvidenceEnvelopeV1` and the deterministic ranking;
4. loads the separate oracle from `oracles/`;
5. checks top-five location, relevant impact reasons, or restraint gates;
6. removes the validated temporary directory.

The oracle is never copied into the execution repository or passed to the
analyzer.

## Initial cases

- `hidden-central-line`: a one-line shared guard reversal hidden by a broad
  feature/generated diff;
- `large-generated-volume`: generated additions must not bury a connected
  existing registry hunk;
- `missing-structure`: missing semantic intelligence is disclosed without an
  invented dependency claim;
- `isolated-change`: a small tested change remains contextual and concise.

Positive cases pass only when the known causal range appears within the first
five candidates and carries a supported wider-impact reason. Negative cases
fail if ranking manufactures elevated findings.

The suite is synthetic in `0.1.0`. A sanitized historical case is a release
quality milestone, not something claimed by the alpha benchmark.
