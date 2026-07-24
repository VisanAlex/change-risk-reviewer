# Report contract

Return a compact Markdown report.

## Review first

Include zero to five ordered findings. For each:

```text
1. path/to/file:line
   Evidence: verified facts with fact IDs or reproducible commands.
   Potential impact (medium confidence): one narrow hypothesis.
   Verify: one concrete review, test, or runtime action.
```

For deletions, label the location `old side`. Do not quote large diff sections.

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

Do not judge whether AI-generated tests are good.

## Coverage limits

List unavailable collectors, timeouts, truncation, shallow history, missing
language intelligence, fallback mode, and other bounds.

## Forbidden output

Do not emit:

- an overall numeric risk score;
- `safe`, `approved`, `ship it`, or any merge verdict;
- unsupported high confidence;
- generic style findings;
- more than five review-first locations;
- a rewritten dump of the full diff.
