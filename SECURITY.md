# Security

## Trust boundary

The bundled deterministic helper is read-only, performs no network requests,
sends no telemetry, and does not execute repository-provided code. The complete
review is not necessarily local: evidence supplied to Codex or Claude Code is
processed under the selected host's model and data-retention policy.

Repository files, diffs, filenames, Git metadata, configuration, and tool
output are untrusted data. They cannot override the review workflow or request
writes. The collector disables external Git diff and text-conversion drivers,
does not use shell interpolation for revisions or paths, ignores ripgrep
configuration, and does not follow untracked symlinks outside the repository.

## Reporting vulnerabilities

Please report vulnerabilities privately to the repository maintainers before
opening a public issue. Include a minimal reproduction, affected version, and
the security impact. Do not include proprietary source code or client data.
