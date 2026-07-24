# Fallback collection

Use this only when the bundled helper or a compatible Node runtime is
unavailable. Keep all operations read-only and pass revisions and paths as
distinct process arguments.

## Working change

1. Resolve the repository and `HEAD` with Git.
2. Collect the final tracked state against `HEAD`:

   ```text
   git --no-pager -c core.quotePath=false diff --no-ext-diff --no-textconv --find-renames HEAD --
   ```

3. List untracked, non-ignored files without reading binary content:

   ```text
   git --no-pager -c core.quotePath=false ls-files --others --exclude-standard -z
   ```

4. Do not follow untracked symlinks or read outside the repository root.

## Named range

1. Reject empty, newline-containing, or option-like revisions.
2. Resolve base and head to commit object IDs with `rev-parse --verify`.
3. Resolve their merge base.
4. Diff the merge base against the resolved head with `--no-ext-diff` and
   `--no-textconv`.
5. An invalid range is an error; never substitute the working tree.

## Bounded reach

When ripgrep exists, use `--no-config`, fixed strings, ignored-directory globs,
and explicit caps. Search changed path stems and conservative changed
identifiers. Say `N files contain a literal occurrence`; do not say `N call
sites`.

When ripgrep is missing, use Git-native path and history evidence only.

## Required disclosure

State that enhanced collectors are unavailable. Name omitted dimensions:
stable machine ranking, bounded import-pattern classification, per-collector
limits, and any history or textual reach not collected. Semantic downstream
reach remains unknown unless another trusted host tool establishes it.
