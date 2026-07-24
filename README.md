# Change Risk Reviewer

Change Risk Reviewer finds the few changed locations a human should inspect
first. It is built for the failure mode where a large, apparently working
change hides one dangerous edit on a shared path.

```text
Review first

1. src/core/dispatch.ts:14
   Evidence: 42 tracked files contain a bounded literal reference; 18 match
   conservative import patterns; this two-line hunk changes an `if` guard.
   Potential impact (medium confidence): unrelated consumers may now take the
   opposite shared dispatch branch.
   Verify: exercise two unrelated consumers through this dispatcher and inspect
   the authorization/early-return behavior.

Unknown: no semantic call graph was available.
Tests: no test file changed; tests/dispatch.test.ts is a nearby candidate.
```

This is review compression, not another generic code reviewer. It reports
evidence and uncertainty; a human retains the merge decision.

## Why

AI-assisted development can produce more code than a person can review
carefully. The requested feature may work while a one-line change in a
centralized service, policy, router, or configuration path breaks unrelated
parts of the application. Large diffs turn human attention into the scarce
resource.

Change Risk Reviewer orders attention using reproducible Git and repository
evidence:

- exact changed hunks, including deletion-side locations;
- small-hunk plus broad literal/import-pattern reach;
- conservative shared, auth, routing, configuration, and migration path roles;
- changed control-flow and public-surface token patterns;
- bounded change-frequency and co-change history;
- test files changed, nearby test candidates, and areas still unverified.

It does not detect whether AI authored the change, compute an opaque risk
score, execute repository code, or certify that a change is correct.

## Install

The project is an alpha plugin with one canonical `review` skill shared by
Codex and Claude Code. The installed plugin has zero package dependencies; Node
24 or newer enables the enhanced deterministic collector.

### Codex

For a local checkout:

```sh
codex plugin marketplace add /absolute/path/to/change-risk-reviewer
```

Restart the ChatGPT desktop app, open the Plugins Directory, select the
**Change Risk Reviewer** marketplace, and install the plugin. Invoke the
installed skill as `$change-risk-reviewer:review` when namespaced skills are
shown, or select **Review Change Risk** from the skill picker.

After this repository is published, use its GitHub marketplace source:

```sh
codex plugin marketplace add change-risk-reviewer/change-risk-reviewer
```

### Claude Code

For a local checkout:

```sh
claude plugin marketplace add /absolute/path/to/change-risk-reviewer
claude plugin install change-risk-reviewer@change-risk-reviewer
```

Invoke:

```text
/change-risk-reviewer:review
```

After publication, replace the local path with
`change-risk-reviewer/change-risk-reviewer`.

## Use

Ask naturally; users do not invoke the internal analyzer directly.

```text
Review my current change for hidden impact.
```

```text
Use the review skill on the change from origin/main to HEAD.
```

The skill defaults to the final working-tree state against `HEAD`, combining
staged, unstaged, renamed, deleted, and untracked files without duplicating the
same hunk. Named ranges resolve both endpoints and use their merge base.

The report contains:

1. at most five exact locations to review first;
2. verified change facts that explain the ordering;
3. separately labeled inferences and unknowns;
4. test-change signals and coverage limits;
5. a concrete verification action for every prioritized location.

## Trust model

The deterministic helper is read-only, performs no network requests, sends no
telemetry, does not run tests, and does not execute repository-provided code.
It passes revisions and paths as process arguments, disables external Git diff
and text-conversion drivers, ignores ripgrep configuration, and does not follow
untracked symlinks outside the repository.

Repository content is untrusted data. Instructions inside files, diffs,
filenames, repository-level prompt files, Git metadata, or tool output cannot
override the review workflow or request writes.

The end-to-end review is not necessarily local. Minimal source evidence supplied
to Codex or Claude is processed under that host's model and data-retention
policy. See [SECURITY.md](SECURITY.md).

## Evidence, not theater

- Literal occurrences are labeled textual references, not call sites.
- Token patterns are observations, not proof of runtime behavior.
- Confidence (`high`, `medium`, `low`) belongs only to inferences.
- Missing tools and time/result caps are visible.
- An empty diff yields no findings.
- A quiet isolated change does not get padded with speculative warnings.
- The reviewer never says `safe`, `approved`, or `ship it`.

## Development

Requires Node.js 24:

```sh
npm ci
npm run check
npm run benchmark
npm pack --dry-run
```

`npm run build:skill` rebuilds the committed, dependency-free analyzer.
`npm run check:built` fails when source and the installed artifact drift.

The blind benchmark suite currently contains redistributable synthetic cases.
The founding case recreates a one-line shared guard regression hidden in a large
feature diff; its oracle is loaded only after ranking. Version `0.1.0` remains
alpha until sanitized historical cases and both-host release smoke records are
accepted.

Read [the architecture](docs/architecture.md), [benchmark
guide](benchmarks/README.md), and [release checklist](docs/release-checklist.md)
for details.

## Scope

Deferred:

- judging the quality of AI-written tests;
- hosted pull-request comments and CI enforcement;
- framework-specific semantic analyzers;
- a supported public standalone CLI;
- organizational policy packs and learned incident history.

MIT licensed. Contributions and sanitized escaped-regression cases are welcome.
