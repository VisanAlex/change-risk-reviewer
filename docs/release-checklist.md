# Release checklist

Publishing is a separate explicit decision. Completing development or this
checklist does not authorize a registry, marketplace, GitHub release, or push.

## Metadata

- [x] Set the intended GitHub owner and repository URL to
  `https://github.com/VisanAlex/change-risk-reviewer`.
- [ ] Confirm the public repository resolves at that URL after creation.
- [ ] Keep `package.json`, both plugin manifests, both marketplaces, and release
  tag on the same version.
- [ ] Confirm MIT license, publisher name, repository URL, and alpha/stable
  wording.
- [ ] Review changelog/release notes for the evidence and benchmark behavior
  actually shipped.

## Clean checkout

Record operating system, Git, Node, npm, Codex, and Claude Code versions. Run
the complete check once on the minimum supported Node 20 release line and once
on the current development release.

```sh
npm ci --ignore-scripts
npm run check
npm run benchmark
npm pack --dry-run
```

Then rebuild and prove the committed runtime is unchanged:

```sh
npm run build:skill
git diff --exit-code -- skills/review/scripts/analyze.mjs
```

Validate the skill and Claude plugin:

```sh
skills-ref validate skills/preflight
skills-ref validate skills/stories
skills-ref validate skills/review
claude plugin validate .
```

## Exact archive

- [ ] Create the candidate archive with `npm pack --ignore-scripts`.
- [ ] Inspect its file list: manifests, marketplaces, canonical skill,
  references, bundled analyzer, docs, and license must be present.
- [ ] Confirm `src/`, `tests/`, `node_modules/`, logs, and credentials are absent.
- [ ] Extract the archive to a new temporary directory and rerun packaging
  validation without installing dependencies.

## Host smoke: Codex

- [ ] Add the extracted/local marketplace with `codex plugin marketplace add`.
- [ ] Restart the desktop app and install the cached plugin copy.
- [ ] Invoke `$change-risk-reviewer:preflight` with an accessible local
  prototype and target repository. Confirm it cites both sides, reports
  unknowns, and does not treat language choice as risk.
- [ ] Invoke `$change-risk-reviewer:stories` with finalized requirements, a
  preflight report, and the current repository. Confirm it rechecks the
  repository, maps every requirement, and discloses drift and blocked items.
- [ ] Invoke `$change-risk-reviewer:review` against the
  `hidden-central-line` fixture.
- [ ] Record the host version, exact archive hash, first-ranked location,
  evidence labels, and disclosed limits.
- [ ] Confirm no write, stage, test execution, network request, risk score, or
  merge verdict occurred.

## Host smoke: Claude Code

- [ ] Run `claude plugin validate .` on the extracted archive.
- [ ] Add and install the extracted marketplace.
- [ ] Invoke `/change-risk-reviewer:preflight` with the same prototype and
  target used for the Codex smoke.
- [ ] Invoke `/change-risk-reviewer:stories` with the same finalized
  requirements and repository used for the Codex smoke.
- [ ] Invoke `/change-risk-reviewer:review` against the same fixture.
- [ ] Record the host version, exact archive hash, first-ranked location,
  evidence labels, and disclosed limits.
- [ ] Compare report structure with the Codex record; wording may differ, but
  the evidence hierarchy and human-authority boundary may not.

## Publish gate

- [ ] A maintainer explicitly authorizes the target and version.
- [ ] The synthetic founding case, generated-volume case, degradation case, and
  restraint case pass.
- [ ] For a stable (non-alpha) claim, at least one accepted sanitized historical
  case passes blind.
- [ ] Publish only the reviewed archive/hash.
- [ ] After publication, install from the public source in both hosts and repeat
  the smoke check.
