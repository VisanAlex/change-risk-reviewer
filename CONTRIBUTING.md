# Contributing

Thank you for helping make code-change review more trustworthy.

Use Node.js 24 and install the locked development dependencies with `npm ci`.
Before proposing a change, run:

```sh
npm run check
npm run benchmark
npm pack --dry-run
```

Behavior changes should include focused tests. Ranking changes must explain
their evidence rule and must not weaken the hidden-central-line or isolated
change benchmarks. Do not add proprietary incidents, source code, credentials,
or client information to fixtures.

The project does not accept rules that infer risk solely from AI authorship,
diff size, or an opaque aggregate score.

Read [docs/contributing-benchmarks.md](docs/contributing-benchmarks.md) before
adding an escaped-regression case. Oracles must remain separate from fixture
inputs and are loaded only after capture.
