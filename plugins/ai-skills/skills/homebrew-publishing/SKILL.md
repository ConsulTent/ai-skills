---
name: homebrew-publishing
description: Publish, update, or debug Homebrew packages — create a third-party tap, author formulae (Go CLIs and others), fix brew audit/install/test or tap CI failures, bump formula versions for new releases, and submit to homebrew-core (eligibility rules, PR process, AI/LLM disclosure policy). Use whenever the user mentions Homebrew, brew, taps, formulae, or wants a CLI/library installable via `brew install`.
---

# Homebrew Publishing

Homebrew's docs lag its behavior (verified 2026-10: org-wide `master`→`main` branch renames hard-coded into doc examples; path-form audit/install disabled; tap CI only builds formulae on pull-request events). This skill encodes what actually works and names the authoritative source to check when behavior surprises.

## 0. Route decision: homebrew-core vs third-party tap

Check BEFORE planning a core submission — a PR that fails these on its face gets closed by maintainers:

- Repo age ≥ 30 days (below that, "normally not eligible").
- Notability on the canonical repo: ≥30 forks, ≥30 watchers, or ≥75 stars — **or 90/90/225 when the submitter is the repo owner or a commit author** (self-submission).
- Failing either → third-party tap. That is the policy's own fallback, not a consolation prize.

Check metrics with:
```sh
gh api repos/OWNER/REPO --jq '{stars: .stargazers_count, forks: .forks_count, watchers: .subscribers_count, created: .created_at}'
```

## 1. Formula authoring

Formula name = the repo/project name (`mcpcli`), NOT the installed binary name (`mcp`). Check the name is free: `https://formulae.brew.sh/api/formula/<name>.json` → 404 means free (check both project name and binary name).

Go CLI template (proven end-to-end 2026-10):

```ruby
class Projectname < Formula
  desc "One-line description, capitalized, under 90 chars"
  homepage "https://github.com/OWNER/REPO"
  url "https://github.com/OWNER/REPO/archive/refs/tags/vX.Y.Z.tar.gz"
  sha256 "<computed>"
  license "SPDX-ID"          # e.g. "AGPL-3.0-or-later"; -or-later only if the repo says so
  depends_on "go" => :build

  def install
    system "go", "build", *std_go_args(output: bin/"<binary>"), "./cmd/<binary>"
  end

  test do
    assert_match version.to_s, shell_output("#{bin}/<binary> --version")
  end
end
```

- `std_go_args(output: bin/"<binary>")` renames the built binary when it differs from the formula name. If audit on CI rejects the kwarg, fall back to explicit `-o`, `bin/"<binary>"`.
- Version derives from the tag in `url` (`v1.1.0` → `1.1.0`).
- A source-tarball build has **no VCS stamp**, so `--version` must print the project's baked-in version constant for the test block to hold — verify this is true of the project before writing the assertion.
- sha256, computed over the exact tarball the formula references:
```sh
set -o pipefail && curl -sL https://github.com/OWNER/REPO/archive/refs/tags/vX.Y.Z.tar.gz -o /tmp/t.tar.gz && sha256sum /tmp/t.tar.gz
```
- Homebrew's own `go` formula must be ≥ the project's minimum Go (audit catches drift — a tight floor is a maintenance liability).

## 2. Tap setup + CI — where the docs are wrong

Tap repo: `github.com/OWNER/homebrew-<name>`. Users install `brew install OWNER/<name>/<formula>` (auto-taps).

**Do not hand-roll `brew audit/install/test` steps in CI.** Brew 4.x tap semantics reject them:
- `brew audit <path>.rb` — disabled; name form only.
- `brew install <path>.rb` — rejected: "Homebrew requires formulae to be in a tap".
- `brew tap <name> <local-path>` in CI — "remote mismatch" (setup-homebrew already registered the tap).

Use the official `brew tap-new` test-bot template instead — copy `references/tap-ci.yml` into the tap repo as `.github/workflows/ci.yml`. Key properties:
- `setup-homebrew` **SHA-pinned with a tag comment** (branch renames broke `@master`; a bare tag works but the SHA+comment form is the current convention).
- Linux runs in the official `ghcr.io/homebrew/brew:main` privileged container (no fresh-brew-on-ubuntu asymmetries).
- **`brew test-bot --only-formulae` only actually builds/tests formulae on `pull_request` events with a formula diff.** On push events it reports `testing_formulae (none)` and silently skips — a green push run proves only tap syntax + audit. To genuinely verify a formula, open a real PR touching the `.rb` (even a desc tweak), watch it go green on both platforms, then squash-merge.

Watch a run:
```sh
gh run watch <run-id> --repo OWNER/homebrew-<name> --exit-status
```

## 3. Version bumps (the recurring flow)

**Automated for ConsulTent/mcpcli:** the tap bump runs itself — mcpcli's `release-build.yml` `sync-homebrew-tap` job reads the release's four `mcp-<os>-<arch>` digests from the release API, edits the tap's `Formula/mcpcli.rb`, opens the PR with the disclosure paragraph, and merges when tap CI is green. Dispatch `release-build.yml` with the `tag` input to backfill a missed release; the manual flow above stays for other repos.

### Source formula

1. Tag the release upstream.
2. Branch, update `url` (new tag) and `sha256` in `Formula/<formula>.rb`.
3. Push branch → open PR → CI builds/tests both platforms (the PR event IS the gate) → squash-merge with message `<formula> <version>`.

### Binary formula (serve pre-built release assets)

When upstream publishes attested per-platform binaries, a binary formula installs in seconds with zero build deps (and drops the brew-Go-version coupling). Structure:

```ruby
on_macos do
  on_arm do
    url "https://github.com/OWNER/REPO/releases/download/vX.Y.Z/<bin>-darwin-arm64"
    sha256 "..."
  end
  on_intel do ... end
end
on_linux do
  on_arm do ... end
  on_intel do ... end
end

def install
  binary = Dir.children(".").grep(/\A<bin>-/).first
  bin.install binary => "<bin>"
end
```

- `on_*` blocks are NOT allowed inside `def install` — the glob picks whichever asset the platform block downloaded.
- Checksums come from the release API without downloading anything: `gh api repos/OWNER/REPO/releases/tags/vX.Y.Z --jq '.assets[] | .name + " " + .digest'` (fall back to hashing a download only if a digest is null).
- Version derives from the URL; the binaries' embedded `--version` stamp satisfies the standard test block.
- A bump touches 4 URL+sha pairs — script it after the first manual bump hurts once.
- `brew audit` may grumble about pre-built binaries in taps; test-bot's PR run is the empirical gate — if it flags, apply the documented audit exception rather than reverting to source.
- Bottles are the alternative (brew-native pre-builds) but need per-platform bottle builds, a root_url host, and per-version bottle blocks — machinery a binary formula doesn't need when release assets already exist.

## 4. homebrew-core, once §0 passes

Shape: fork `Homebrew/homebrew-core`, `brew tap --force homebrew/core`, branch off `origin/HEAD` named after the formula, one commit `<name> <version> (new formula)`, verify with `HOMEBREW_NO_INSTALL_FROM_API=1 brew install --build-from-source <name>` + `brew lgtm --online`, push the branch to the fork, open the PR from that branch (never from main). Re-verify the detailed steps on brew.sh at submission time — do not trust frozen copies, including this one (§6).

## 5. AI/LLM usage policy (binds Homebrew-repo issues and PRs)

1. Disclose AI use in the initial issue/PR, naming the tool and model.
2. Review all AI-generated content yourself before requesting review.
3. Never credit AI as author, co-author, committer, or signatory — no "Assisted-by"/"Co-developed-by" trailers.
4. Answer maintainer questions and review comments yourself, without AI.
5. Unwilling or unable to comply → close the PR.

Keep the disclosure paragraph on file (e.g., in the tap README) so a future core PR can paste it verbatim:
> This formula and pull request were prepared with AI assistance (<tool>, <model>). I reviewed and tested everything myself and will respond to feedback personally.

## 6. When behavior surprises: verify against source, not docs

- Action refs / default branches: `gh api repos/Homebrew/actions --jq .default_branch` and its tags; SHA-pin.
- Current tap CI conventions: `gh api "repos/Homebrew/brew/contents/.github/workflows/tap-new-tests.yml?ref=main"` — the template `brew tap-new` renders for new taps.
- Formula helpers (e.g. `std_go_args` kwargs): grep Homebrew/brew's `Library/Homebrew` for `def std_go_args`.
- Command rejection messages ("disabled", "must be in a tap") are authoritative — do not work around them; switch to the name/tap-qualified form or test-bot.
