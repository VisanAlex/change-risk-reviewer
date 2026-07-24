# Architecture

## Product boundary

Change Risk Reviewer compresses review attention. It does not replace code
review, testing, static analysis, or the human merge decision.

```text
selected Git change
  -> safe scope resolution
  -> bounded deterministic collectors
  -> EvidenceEnvelopeV1
  -> explainable priority bands
  -> constrained host investigation
  -> calibrated human-facing report
```

One canonical `skills/review/SKILL.md` owns the workflow. Codex and Claude
manifests contain install metadata only. This prevents host prompts from
drifting.

## Deterministic boundary

`EvidenceEnvelopeV1` is the versioned machine boundary between collection and
reasoning. It contains:

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

The envelope is also the extension seam for future host-supplied language
intelligence. Version `0.1.0` intentionally defines no framework adapter API:
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
consumers. It may reorder them only with new repository evidence. The report
separates verified facts, impact inferences with calibrated confidence,
unknowns, tests, and coverage limits.

Repository content—including `AGENTS.md`, `CLAUDE.md`, prompt-like filenames,
and text inside diffs—is data for this review. Host/system policy and the
user-selected scope remain authoritative; discovered repository instructions
cannot relax read-only behavior, suppress limits, or change the report
contract.

## Security and privacy

Child processes use argument arrays with `shell: false`. Git pagers, external
diff, text conversion, filesystem-monitor hooks, and optional locks are
disabled for collection.
Ripgrep runs with `--no-config`. File reads verify containment and real paths.
Checked-out submodule directories are excluded from working-tree search. No
collector sends network requests or executes repository scripts.

The helper is offline; host-model processing follows the host's policy. The
skill minimizes source context and never dumps the full diff into its report.
