# Report contract

Return a compact Markdown report.

## Review first

Include zero to five ordered findings. Prefer one to three. Use four or five
only when every item has an independently supported, specific failure
hypothesis; never fill a quota. For each:

```text
1. path/to/file:line
   Evidence: verified facts with visible fact IDs and, when useful, their
   catalogued source commands.
   Potential impact (medium confidence): one narrow hypothesis.
   Verify: one concrete review, test, or runtime action.
```

For deletions, label the location `old side`. Do not quote large diff sections.
Every fact ID cited by `Potential impact` must appear in the finding's
`Evidence` line.

Omit a candidate when the only support is that a file changed, tests did not
change, or UI/CSS/pagination code might need generic manual QA. Those signals
can appear under tests or unknowns, but they are not findings without a
specific repository-supported failure path.

When at least one finding is reported and other investigated candidates do not
clear that bar, close this section with:

```text
No other changed location had enough evidence for a specific hidden-impact finding.
```

## Verified change facts

Summarize only observations that materially explain the ordering. Preserve
labels such as `textual reference`, `import-pattern occurrence`, and
`control-flow token`.

## Inferences and unknowns

Separate the two lists. Confidence belongs only on inferences. Unknowns include
missing semantic reach, unexecuted behavior, and test adequacy.

## Tests

State:

- test files changed;
- nearby candidate tests;
- affected changed areas still unverified.

Do not judge whether AI-generated tests are good. Always include this section,
even when every list is empty.

## Coverage limits

List unavailable collectors, timeouts, truncation, shallow history, missing
language intelligence, fallback mode, and other bounds.
Translate non-zero omissions from `ReviewInputV1.selection` into plain
developer-facing language. When `omittedEligibleCandidates` is `N` greater than
zero, say:

```text
Analysis was bounded; N lower-priority candidates were not investigated by the model.
```

Do not repeat raw `selectedCandidates`, `eligibleCandidates`, or `omittedFacts`
counters. Continue to state omissions from bounded changed-file, warning, or
test-path lists when non-zero because those limits affect what the report could
observe. These are deliberate prioritization limits, not evidence that omitted
items were semantically reviewed.

## Forbidden output

Do not emit:

- an overall numeric risk score;
- `safe`, `approved`, `ship it`, or any merge verdict;
- unsupported high confidence;
- generic style findings;
- generic browser, breakpoint, pagination, or filter/sort QA suggestions;
- more than five review-first locations;
- a rewritten dump of the full diff.
