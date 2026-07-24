# Evidence hierarchy

Use the strongest available evidence and retain its original label.

1. **Verified change facts**
   - resolved Git object IDs and merge base;
   - exact changed hunk ranges and edit shape;
   - literal repository occurrence counts;
   - conservative import/include-pattern occurrences;
   - bounded Git history counts;
   - path roles, changed token patterns, and test-path changes.
2. **Repository-supported investigation**
   - minimal source context around a ranked hunk;
   - specific consumers opened from cited search results;
   - language intelligence already available in the host, when its provenance
     and limits are stated.
3. **Inference**
   - a possible behavioral or subsystem impact derived from facts;
   - always carries `high`, `medium`, or `low` confidence and fact citations.
4. **Unknown**
   - anything the available evidence cannot establish, including runtime
     behavior, semantic reach without a graph, and test adequacy.

## Confidence

- **High:** multiple independent facts directly support a narrow inference.
- **Medium:** evidence supports the connection, but runtime behavior or reach
  has not been executed or semantically proven.
- **Low:** a plausible hypothesis with limited supporting evidence.

Never raise confidence because a path name sounds important. Never convert a
literal occurrence into a semantic dependency claim.

## Priority reasons

- `SMALL_HUNK_BROAD_REACH`: ten or fewer changed lines plus broad supported
  literal/import reach.
- `SENSITIVE_SHARED_PATH`: a sensitive/shared path plus broad supported reach.
- `BROAD_TEXTUAL_REACH`: bounded occurrences exceed the baseline threshold.
- `CONTROL_FLOW_CHANGE`: changed control-flow token pattern.
- `PUBLIC_SURFACE_CHANGE`: changed public-surface token pattern.
- `SENSITIVE_FILE_ROLE`: conservative path classification.
- `NO_TEST_CHANGE`: contextual verification gap attached only to an already
  meaningful candidate.
- `GENERATED_FILE`: volume-suppression context.

These are explainable ordering rules, not a numeric risk score.
