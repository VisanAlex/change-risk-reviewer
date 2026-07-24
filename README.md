# Change Risk Reviewer

Change Risk Reviewer compresses a large Git diff into the few changed locations
that deserve human attention first. It is designed for the failure mode where a
large, apparently working change hides one dangerous edit on a shared path.

The project is evidence-first. It reports what the repository can support,
separates observations from hypotheses, and leaves the merge decision to a
human. It reviews human, AI-assisted, and mixed changes without guessing who
wrote them.

This repository is an alpha implementation. The canonical `review` skill is
packaged for Codex and Claude Code; the deterministic collector, benchmarks,
and complete installation guide are built in the following implementation
units.

## Status

- Version: `0.1.0` alpha
- License: MIT
- Runtime target: Node.js 24 for the enhanced collector
- Runtime dependencies: none in the installed plugin
- Network/telemetry: none in the deterministic helper

The host model may still process selected source evidence under the host's own
data policy. See [SECURITY.md](SECURITY.md).
