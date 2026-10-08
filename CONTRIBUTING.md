# Contributing to forge-agent-lens-for-openclaw

## Local checks

This repository uses pnpm 9 and Node.js 24.16+ or 26.1+.

```shell
npx pnpm@9 install --frozen-lockfile
npx pnpm@9 check
```

Before opening a pull request, also run:

```shell
uvx --from 'reuse[charset-normalizer]==6.2.0' reuse lint
```

## Test a change in OpenClaw

To run your checkout in a local OpenClaw gateway:

```shell
openclaw plugins install --link .
openclaw gateway restart
openclaw plugins inspect forge --runtime --json
```

## Pull requests

Use a Conventional Commit title. Call out privacy or compatibility changes in
the pull request description, and update the README when user-visible behavior
changes. Do not commit generated build artifacts or local configuration.

## Releases

release-please keeps a release PR open that bumps the version and changelog
from the Conventional Commits on `main`. The version changes in
`package.json`, `openclaw.plugin.json`, and `src/config/version.ts`. Merging
the PR tags `vX.Y.Z`, creates the GitHub release, and runs the Publish Package
workflow (`publish.yml`) on the tag. That workflow publishes to npm and
ClawHub through trusted publishing. Before 1.0, `feat` and `fix` both bump the
patch version, and breaking changes bump the minor version. To choose the
version, add a `Release-As: X.Y.Z` footer to a commit.

If Publish Package fails on a transient error, rerun only the failed jobs:
find the run ID with `gh run list --workflow publish.yml`, then run
`gh run rerun <run-id> --failed`. Rerunning the npm job after it published
fails, because npm already has that version. If Publish Package fails because
of a bug, fix it in a pull request to `main` and release the next version.
Reruns use the workflow files from the release tag, so they won't pick up the
fix.

Never reuse or move an existing release tag.

## Contributor License Agreement

Contributors must agree to the [CoreWeave CLA](./CLA.md) when pushing code to this project.

Agreement with the CoreWeave CLA must be signified by including a `Signed-off-by`
trailer in every submitted Git commit to this repository. By signing off, you certify that you have the right to submit the contribution and that you agree to and are bound by the CoreWeave Contributor License Agreement in effect at the date of your submission, found in [`CLA.md`](./CLA.md) in the root of this repository, which governs your submission. If you are contributing on behalf of an entity, you further certify that you are authorized to bind that entity to the CLA.

Sign each commit with the `--signoff` (`-s`) option to [`git commit`](https://git-scm.com/docs/git-commit#Documentation/git-commit.txt---signoff). Git has no configuration option that adds the trailer automatically; if you want it on every commit, use an alias such as `git config alias.ci "commit -s"` or a `prepare-commit-msg` hook.

## Licensing

This project is licensed under Apache-2.0 (see [`LICENSE`](./LICENSE)) and follows the [REUSE](https://reuse.software/) specification. REUSE requires the license text in [`LICENSES/Apache-2.0.txt`](./LICENSES/Apache-2.0.txt). Licensing metadata lives in [`REUSE.toml`](./REUSE.toml): its aggregate annotation covers every file by default, so new files need no SPDX header. If you add material under a different license or copyright, declare it with an inline SPDX header or a `REUSE.toml` annotation and include any additional license text in `LICENSES/<SPDX-License-Identifier>.txt`. Run `reuse lint` from the repository root before opening a PR.
