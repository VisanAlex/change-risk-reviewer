# Change Risk Reviewer

Change Risk Reviewer is an evidence-first plugin for three moments in the
development lifecycle:

- `preflight` finds business contracts and integration assumptions that a
  proposal must preserve before implementation planning, product work, or
  design work;
- `stories` rechecks the repository after the design is finalized and writes
  repository-grounded technical stories;
- `review` finds the few changed locations a human should inspect first after
  implementation.

It is built for the failure mode where a promising prototype or a large,
apparently working change misses one important rule on a shared path.

```text
Review first

1. src/core/dispatch.ts:14
   Evidence: `dispatch:text-breadth` finds 42 tracked files with a bounded
   literal reference; `dispatch:import-breadth` finds 18 conservative import
   patterns; `dispatch:control-flow` records a changed `if` token.
   Potential impact (medium confidence): unrelated consumers may now take the
   opposite shared dispatch branch.
   Verify: exercise two unrelated consumers through this dispatcher and inspect
   the authorization/early-return behavior.

Unknown: no semantic call graph was available.
Tests: no test file changed; tests/dispatch.test.ts is a nearby candidate.
```

This is risk-oriented attention compression, not another generic code reviewer.
It reports evidence and uncertainty; a human retains the implementation and
merge decisions.

## Choose a skill

| Phase | Skill | Question |
|---|---|---|
| Before implementation planning, product work, or design work | `preflight` | How does this work today, and what could it affect? |
| After design, before development | `stories` | What technical stories cover the verified delta? |
| After implementation | `review` | Which changed locations could have hidden impact? |

### Before implementation planning, product work, or design work

Use `preflight` during preliminary analysis by a developer, product manager,
designer, or technical lead. It compares a task, implementation plan, MOD-01,
specification, screen sketch, or prototype with the target application's
current behavior. It maps current flows, directly affected surfaces, indirect
impact, business contracts, and unknown assumptions.

```text
Use $change-risk-reviewer:preflight with MOD-01 and my screen-impact notes.
Explain how this works in the current Laravel application and map direct and
indirect impact.
```

```text
Use $change-risk-reviewer:preflight to compare docs/new-refund-flow.md with
the current application.
```

The preflight report identifies evidence-backed mismatches, contracts to
preserve, unknown assumptions, and the target files worth understanding first.
It does not execute either application or produce an implementation plan.

### After design, before development

Use `stories` after the intended behavior and technical direction are
finalized. It accepts the original task, the finalized design or plan, and an
optional preflight report. It always rechecks the selected repository state
before writing stories.

```text
Use $change-risk-reviewer:stories with MOD-01, the finalized screen design,
and the previous preflight report. Recheck the current repository, then write
the technical stories.
```

If a team already has a story-writing skill, use handoff mode:

```text
Use $change-risk-reviewer:stories in handoff mode. Produce a repository-grounded
Story Evidence Pack for our company story skill.
```

### After implementation

This tool reviews a selected Git change. It is not a whole-repository audit.
Run it after a meaningful implementation and before opening a PR, merging, or
deploying, especially when the diff is large, unfamiliar, AI-assisted, or
touches shared infrastructure.

| Your repository state | Ask |
|---|---|
| You still have uncommitted edits | `Review my current working changes for hidden impact.` |
| Your branch work is already committed | `Review the change from staging to HEAD.` |
| You want an exact commit window | `Review the change from <base-sha> to <head-sha>.` |

The working-change form compares the final staged, unstaged, and untracked
state with `HEAD`. If the working tree is clean, it correctly finds nothing.
Committed branch work needs an explicit base such as `origin/main`, `staging`,
or a commit SHA; ranges use the merge base, so unrelated base-branch movement
does not become part of the review.

Natural-language invocation is supported. Explicitly selecting the skill is
the most reliable option:

```text
Use $change-risk-reviewer:review on my changes from staging to HEAD.
```

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

## Language and framework support

The reviewer is Git-based and language-agnostic. It works on Laravel and
Livewire, Rails, Django, Spring, Go, and JavaScript repositories without
installing or invoking Composer, Artisan, PHP, Bundler, Python, Maven, Gradle,
Go, npm, or the project's test runner.

For Laravel and Livewire, that includes PHP `use` references plus conventional
policy, route, migration, and test paths. This is conservative repository
evidence, not a framework-specific semantic call graph.

Node belongs to the machine running Codex or Claude Code, not to the repository
being reviewed. Node 20 or newer enables the bundled analyzer. If compatible
Node is unavailable, the skill falls back to a smaller Git- and search-based
collection and reports the capabilities it lost.

## Install

The project is an alpha plugin with canonical `preflight`, `stories`, and
`review` skills shared by Codex and Claude Code. The installed plugin has zero
package dependencies; Node 20 or newer enables the enhanced deterministic
collector used by `review`. `preflight` and `stories` use the host's read and
search capabilities.

### Codex

For a local checkout:

```sh
codex plugin marketplace add /absolute/path/to/change-risk-reviewer
```

Restart the ChatGPT desktop app, open the Plugins Directory, select the
**Change Risk Reviewer** marketplace, and install the plugin. Invoke the
installed skills as `$change-risk-reviewer:preflight`,
`$change-risk-reviewer:stories`, and `$change-risk-reviewer:review` when
namespaced skills are shown, or select them from the skill picker.

After this repository is published, use its GitHub marketplace source:

```sh
codex plugin marketplace add VisanAlex/change-risk-reviewer
```

### Claude Code

For a local checkout:

```sh
claude plugin marketplace add /absolute/path/to/change-risk-reviewer
claude plugin install change-risk-reviewer@change-risk-reviewer
```

Invoke:

```text
/change-risk-reviewer:preflight
/change-risk-reviewer:stories
/change-risk-reviewer:review
```

After publication, replace the local path with
`VisanAlex/change-risk-reviewer`.

## Preflight product analysis

Ask naturally and identify the proposal artifact. The target defaults to the
current repository only when that is clear from the request.

```text
Use $change-risk-reviewer:preflight with MOD-01 and my screen map. Explain the
current behavior, then map directly and indirectly affected screens, flows,
business rules, and integrations.
```

```text
Use $change-risk-reviewer:preflight. The target is staging and the prototype is
the prototype/new-billing branch. Focus on invoice totals and payment state.
```

For a separate repository, provide an accessible local path. The skill does not
clone remote repositories or run either project. When a proposal exists only
as text, paste it into the request or point to a local specification.

The report contains:

1. current behavior with exact repository evidence;
2. a direct and indirect impact map;
3. preferably one to three evidence-backed compatibility risks, and never more
   than five;
4. business contracts the design must preserve;
5. unknown assumptions, suggested target files, and coverage limits.

## Write repository-grounded stories

Run `stories` after the product, design, or technical direction is finalized
and before development begins.

```text
Use $change-risk-reviewer:stories with MOD-01, the approved screen design, and
the earlier preflight report. Recheck the current repository and write the
technical stories.
```

The previous preflight is optional and is never accepted as current evidence.
The skill records the selected repository state, checks for drift, reconciles
current and desired behavior, and maps every requirement to a primary story.

Each story contains:

1. an outcome and coverage status;
2. current and desired behavior;
3. directly and indirectly affected areas;
4. evidence-backed candidate components;
5. business contracts, acceptance scenarios, dependencies, and unknowns.

When another story skill owns company formatting, request handoff mode:

```text
Use $change-risk-reviewer:stories in handoff mode. Recheck the repository and
produce a self-contained Story Evidence Pack for $company-plugin:stories.
```

The company skill can apply Jira fields, vocabulary, ownership, and formatting.
Change Risk Reviewer remains responsible for repository evidence, delta
reconciliation, and requirement coverage.

## Review an implementation

Ask naturally; users do not invoke the internal analyzer directly.

```text
Review my current change for hidden impact.
```

```text
Use the review skill on the change from origin/main to HEAD.
```

The skill defaults to the final working-tree state against `HEAD`, combining
staged, unstaged, renamed, deleted, and untracked files without duplicating the
same hunk. Named ranges resolve both endpoints, use their merge base, and
collect references, tests, and history from the selected head even when another
branch is checked out.

The report contains:

1. preferably one to three strong locations, and never more than five;
2. verified change facts that explain the ordering;
3. separately labeled inferences and unknowns;
4. test-change signals and coverage limits;
5. a concrete verification action for every prioritized location.

For team discoverability, add a convention like this to the repository's
`AGENTS.md` or `CLAUDE.md`:

```text
Before implementation planning, product work, or design work on a non-trivial
task, offer to run the installed preflight skill against the current
application. After the intended behavior and technical direction are
finalized, offer to run the stories skill, which must recheck the repository
before writing technical stories. After development, offer to run the review
skill.
Review working changes by default. If they are already committed, ask for the
intended base branch and review that base to HEAD.
```

This keeps the reviewer opt-in and read-only while making it part of the normal
handoff instead of something developers must remember after an incident.

## Trust model

All three skills are read-only and do not run tests or execute
repository-provided code. The deterministic `review` helper performs no network
requests, sends no telemetry, passes revisions and paths as process arguments,
disables external Git diff and text-conversion drivers, ignores ripgrep
configuration, and does not follow untracked symlinks outside the repository.
`preflight` and `stories` only inspect artifacts already available to the host.
`stories` does not publish work items to an external tracker.

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
- Missing tests or generic manual-QA advice cannot create a finding by itself.
- Stories do not hide partial or blocked requirements to appear complete.
- The reviewer never says `safe`, `approved`, or `ship it`.

## Development

Requires Node.js 20 or newer:

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
feature diff; its oracle is loaded only after ranking. Version `0.3.0` remains
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

Created and maintained by [Alex Visan](https://github.com/VisanAlex).

MIT licensed. Contributions and sanitized escaped-regression cases are welcome.
