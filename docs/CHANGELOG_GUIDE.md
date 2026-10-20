# How to record changes

1. Every change that users would notice gets one line under `## [Unreleased]` in the same pull request.
2. Group lines under: `Added` (new features), `Changed` (behaviour changes), `Deprecated`, `Removed`,
   `Fixed` (bug fixes), `Security`.
3. Write for users, in the past tense, one line each: "Fixed records missing in the box score header".
4. To release: rename `[Unreleased]` to `[x.y.z] - YYYY-MM-DD`, add a fresh empty `[Unreleased]`, update the
   `VERSION` file, commit as `Release x.y.z`, then tag: `git tag -a vx.y.z -m "x.y.z" && git push --tags`.
5. Versioning: MAJOR = breaking change to config or layout, MINOR = new feature, PATCH = bug fix.
   Pre-releases: `1.1.0-beta.1`, `1.1.0-rc.1`.
6. Commit messages: `feat: ...`, `fix: ...`, `docs: ...`, `chore: ...` make changelog writing easy.
