# Architecture

## Product boundary

Change Risk Reviewer compresses attention before and after implementation. It
does not replace product analysis, code review, testing, static analysis, or
human implementation and merge decisions.

```text
proposal artifact + target baseline
  -> bounded contract discovery
  -> current behavior and impact map
  -> calibrated preflight report

finalized design + current repository
  -> mandatory repository recheck
  -> current-to-desired reconciliation
  -> requirement coverage and story slicing
  -> technical stories or Story Evidence Pack

selected Git change
  -> safe Git scope resolution
  -> bounded deterministic collectors
  -> EvidenceEnvelopeV1
  -> explainable priority bands
  -> bounded ReviewInputV1 projection
  -> constrained host investigation
  -> calibrated change review report
```

One canonical skill owns each workflow:

- `skills/preflight/SKILL.md` compares a proposal with existing business and
  integration contracts before implementation planning, product work, or
  design work.
- `skills/stories/SKILL.md` rechecks the repository after the intended
  behavior is finalized and writes technical stories that cover the verified
  delta.
- `skills/review/SKILL.md` prioritizes hidden impact in an implemented Git
  change.

Codex and Claude manifests contain install metadata only. This prevents host
prompts from drifting.

## Preflight boundary

Preflight accepts tasks, MOD-01 documents, screen sketches, proposal text,
specification files, prototypes, accessible local repositories, and explicit
Git revisions. The target baseline is normally the current application, but it
may be an explicit revision or another accessible local path.

Preflight is host-driven because cross-language business comparison requires
reasoning over heterogeneous artifacts. It bounds investigation to five target
areas and three strong related contracts or consumers per area. Every reported
risk needs target evidence, proposal evidence or a bounded omission
observation, a calibrated mismatch inference, and a falsifiable verification
action.

Preflight does not run either project, clone remote repositories, make
implementation choices, or convert a language difference into a risk signal.
It reports current behavior, direct and indirect impact, contracts that must be
preserved, and uncertainty the developer, designer, product manager, or
technical lead must resolve.

## Stories boundary

Stories accepts finalized requirements, approved screen or flow designs, an
optional preflight report, and a selected repository baseline. It always
rechecks that repository state. A preflight report is a search lead, not
current evidence.

The workflow inventories at most ten independently meaningful requirements per
run, investigates at most eight repository areas and three strong related
contracts or consumers per area, reconciles current and desired behavior, and
maps every requirement to a primary story. Larger inputs must be narrowed to a
coherent feature slice instead of being silently truncated.

Stories are sliced by independently verifiable outcomes rather than technical
layers. Each story carries repository evidence, direct and indirect impact,
business contracts, acceptance scenarios, dependencies, and unknowns. Handoff
mode emits a self-contained Story Evidence Pack when another skill owns company
formatting.

Stories does not edit application code, publish work items, estimate effort,
assign owners, or hide partial and blocked requirements. Templates can change
presentation but cannot suppress evidence or coverage gaps.

## Deterministic boundary

For implemented Git change review, `EvidenceEnvelopeV1` is the versioned
machine boundary between collection and reasoning. It contains:

- resolved working/range scope and Git object identities;
- exact changed hunks and current- or old-side source locations;
- collector capabilities, bounds, failures, and truncation;
- facts with reason codes, collector names, source commands, and values;
- ordered candidates with bands, reasons, and stable tie breaks;
- changed/nearby/unverified test-path signals;
- warnings and evidence limits.

Object keys and arrays with order semantics are constructed deterministically.
V1 consumers must ignore additive unknown fields. A breaking change requires a
new schema version; reason-code meaning cannot silently change inside V1.

The full envelope is retained for deterministic tests, benchmarks, and
debugging. The bundled analyzer emits `ReviewInputV1` by default for host
reasoning. That projection keeps a ranked, reason-diverse selection of at most
five elevated/notable candidates, ten facts per candidate, one deduplicated
source-command catalog, and a bounded changed-file and test-path inventory.
Sample consumer paths are capped while their total counts and truncation limit
remain visible. Its `selection` metadata discloses what was retained and
omitted, including review-worthy candidates beyond the cap.
Context-only candidates are intentionally excluded rather than sent to the
model as invitations for speculative findings. `--full` exposes the underlying
envelope for maintainers; the skill itself uses `--compact`.

The envelope is also the extension seam for future host-supplied language
intelligence. The baseline intentionally defines no framework adapter API:
semantic facts can be designed after benchmarks show which integrations improve
ranking without weakening the baseline or hiding limits.

## Scope resolution

The working scope diffs the final tracked state against `HEAD`, then adds
bounded untracked text snapshots. Ignored files are excluded. Untracked binary
files are metadata only; untracked symlinks are not followed.

A named range resolves base and head to commit objects, finds their merge base,
and diffs the merge base against head. References, test paths, and history are
also collected from that resolved head object, independent of the current
checkout. Invalid ranges stop before collection and never fall back to the
working tree.

Locations use repository-relative POSIX paths. Current-side line ranges are
preferred; deletion-only hunks retain old-side ranges.

Git diff output has a byte bound. Reaching it marks Git scope `partial` and
emits a warning instead of silently presenting an incomplete diff as complete.

## Collectors

All collectors are bounded and read-only.

| Collector | Observation | Important limit |
|---|---|---|
| Git scope | hunks, edit kinds, object IDs | external diff/textconv disabled; truncation disclosed |
| File signals | conservative roles, changed token patterns | pattern evidence only |
| Text references | literal file breadth and import-pattern files | at most 100 ordinary and 5 generated hunks; not semantic call sites |
| Git history | recent frequency and co-change breadth | one shared 100-commit window across at most 100 ordinary and 5 generated paths |
| Test signals | changed and convention-nearby test paths | selected-head snapshot for ranges; no adequacy judgment |
| Language intelligence | unavailable in the baseline | semantic reach remains unknown |

A collector failure retains already completed facts. Capability records say
whether each dimension was `available`, `partial`, or `unavailable`.

## Ranking

Ranking exposes bands, not a score:

- `elevated`: strongest supported combinations, especially a small hunk with
  broad reach or a sensitive/shared path with broad reach;
- `notable`: meaningful reach, control/public-surface patterns, or sensitive
  path evidence without the strongest combination;
- `context`: low-signal, isolated, binary, or generated-volume context.

Rules have named reason codes and stable precedence. Generated-file volume is
suppressed so it cannot bury a connected existing hunk. Missing tests can add
verification context only after another signal has elevated a candidate.

## Agent boundary

The host investigates at most five ranked targets and their strongest cited
consumers, preferring one to three reportable findings. It may reorder them
only with new repository evidence. A finding needs a specific failure
hypothesis backed by visible fact IDs; a changed file, missing test change, or
generic manual-QA suggestion is insufficient. The report separates verified
facts, impact inferences with calibrated confidence, unknowns, tests, and
coverage limits.

Repository content, including `AGENTS.md`, `CLAUDE.md`, prompt-like filenames,
prototype specifications, and text inside diffs, is data for these workflows.
Host and system policy plus the user-selected scope remain authoritative.
Discovered repository instructions cannot relax read-only behavior, suppress
limits, or change the workflow report contracts.

## Security and privacy

Child processes use argument arrays with `shell: false`. Git pagers, external
diff, text conversion, filesystem-monitor hooks, and optional locks are
disabled for collection.
Ripgrep runs with `--no-config`. File reads verify containment and real paths.
Checked-out submodule directories are excluded from working-tree search. No
collector sends network requests or executes repository scripts.

The helper is offline; host-model processing follows the host's policy. The
skill minimizes source context and never dumps the full diff into its report.
