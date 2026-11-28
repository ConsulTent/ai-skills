---
name: golang-decompose
description: Carve a Go project or monolith into domains small enough to plan, review and improve on their own — a read-only survey, a committed domain map, a structural carve in parallel worktrees, Docker parity and a convergence run through to release. Use when the operator asks to break up, decompose, modularize or restructure a golang project or monolith into domains, modules or components.
---

# golang-decompose — carve a Go project into domains

You are the coordinator of a structural carve: a Go project or monolith goes in, domains
come out. Edit no source yourself — every code change happens inside an agent's run. The
carve is structural only; a behavioral finding goes to the map's "Deferred observations"
and is never carved.

- **Every agent** carries `$ponytail` (precedence) plus its assigned skills, loaded by
  reading the SKILL.md files directly (the Skill tool refuses ambiguous names in
  sub-agents). Agents dispatch no sub-agents.
- **An agent gets a brief file** — its unit only, never the whole map. Briefs, reports
  and review packages are files in the ledger workspace; an agent returns only status,
  commits, a one-line test summary and concerns, as in `DONE — 2 commits — go
  build/vet/test green — concern: Dockerfile builds ./cmd/api, which moved`.

## Runtime parameters

Before any survey, ask the operator for what the end-to-end run needs: connection
strings, API keys, ports, flags. After the survey's run-time config facet, ask once
more for anything the app reads that is still missing.

- The operator answers with the values themselves, or with bws references when
  choosing the mcpcli route.
- Keep the values in a git-ignored `run.env` in the ledger workspace; they reach the
  containers as env. Never write them to the map, the ledger, a brief, a report or a
  transcript. Grep-verify the file and delete it at release.
- With mcpcli, resolve the call from `mcp --help` at run time — this skill ships no
  command — and capture a fetched value, never echo it. When an image needs mcpcli,
  install it with Homebrew from the tap `ConsulTent/tap/mcpcli`.

## What a domain buys

A convergence loop is priced by its plan's blast radius: every reviewer reads every
package the plan touches, and the coordinator re-reads its growing context on each
call. A carve cuts a Go project into domains small enough to plan, review and improve
on their own.

## The pipeline

Run the pipeline in this order:

1. **Runtime parameters.**
2. **Frame** — the ask, the repo root, constraints, public packages whose API is
   frozen.
3. **Open the ledger.**
4. **Survey** — read-only agents in parallel.
5. **Write the domain map** and commit it to the repo's plan directory.
6. **The operator's ruling** — carving starts on the operator's word. Nothing after it
   waits for a word.
7. **Docker pass 1.**
8. **Carve** in parallel waves.
9. **Merge** into `decompose/<project>`.
10. **Docker pass 2.**
11. **The convergence run.**
12. **Cleanup.**
13. **Documentation.**
14. **Release.**

## The domain map

Write the domain map as one plan document:

- **Context** — the ask, the survey's ground truth, the constraints.
- **The design** — the target layout; the kernel pinned with exact signatures and its
  named consumers; then one `Dk` per domain: actor, packages current → target, layers,
  its own interfaces named by role, the pinned cross-domain contracts it consumes, what
  it owns (systems, config, files), its swap sentence (the storage test, stated for
  this domain), safety-net tier, prerequisites, assigned skills.
- **Rulings I made** — plain lines, one per decision taken on the operator's behalf.
- **Deferred observations** — behavioral findings, parked and never carved.
- **Tasks** — one per domain, grouped into waves; commit subjects from one template,
  `<domain>: <layer>` (as in `appsearch: repository`).

## The ledger

Keep the ledger at `.superpowers/sdd/<map>/DECOMPOSE_LEDGER.json` in the checkout the
skill was invoked from — git-ignored scratch (add the ignore rule when the repo lacks
one), never committed. The hooks read it, so its shape is pinned: one entry per
sub-agent with `runs`, `changes`, `status`, as sccgo's ledger does.

```json
{
  "plan": "<map path>",
  "protocol": "One entry per sub-agent. Every agent carries $ponytail (precedence) plus its assigned skills, read from the SKILL.md files. Independent agents run in parallel. Update in the same message as every dispatch and report.",
  "phase": "survey | map | carve | merge | verify | clean | docs | release | done",
  "default_branch": "<name>",
  "carve_branch": "decompose/<project>",
  "agents": {
    "carve:<domain>": {
      "runs": 0, "status": "pending",
      "skills": ["golang-refactoring", "golang-database"],
      "worktree": "<path>", "branch": "carve/<domain>", "base": "<sha>",
      "brief": "<path>", "report": "<path>", "changes": []
    }
  }
}
```

- Status: `pending` → `active` → `done`, or `blocked`, or `cut` — the operator's
  ruling to drop a domain.
- `$ponytail` rides every agent and is not an entry of its own.
- Update the ledger in the same message as every dispatch and report, never only in
  todos, and keep `phase` in step with the pipeline (its values are the stages, in
  order) — the hooks arm and release on it. The ledger is the recovery map after
  compaction: trust it, `git worktree list` and `git log`.
- The filename differs from sccgo's `USED_SKILLS.json` on purpose: sccgo's hooks read
  every file of that name as one of theirs.

## The survey

Dispatch four read-only agents in parallel, one per group below. Each returns one
compact table; only the tables enter your context. Every command below is verified —
the agents run them as written.

- **Structure** — module shape (`go.mod`, `go.work`, `vendor/`, `replace` and `tool`
  directives; `go env GOWORK`) · package inventory (`go list ./...`;
  `go list -f '{{.ImportPath}} files={{len .GoFiles}} tests={{len .TestGoFiles}} xtests={{len .XTestGoFiles}}' ./...`;
  largest files via `wc -l`) · names vs directories
  (`go list -f '{{.Name}} {{.ImportPath}}' ./...` — name ≠ directory, plurals, generic
  names like `util`, `common`, `helpers`, `base`, hyphens) · import graph
  (`go list -f '{{.ImportPath}} {{join .Imports " "}}' ./...` filtered to the module
  prefix; hubs via
  `go list -f '{{join .Imports "\n"}}' ./... | sort | uniq -c | sort -rn`) · test-only
  edges:
  `go list -f '{{.ImportPath}} t={{join .TestImports " "}} x={{join .XTestImports " "}}' ./...`
  · per-binary reach (`go list -deps ./cmd/<bin>` filtered to the module prefix; what
  every binary needs is the kernel).
- **Actors** — entry points (`func main()` sites, routes, RPCs, CLI commands, queue
  and cron consumers) · call paths (`gopls references <file>:<line>:<col>` from each
  entry point down) · domain types and stores (where the nouns live; schema,
  migrations, ORM models).
- **Contracts** — external systems (external imports:
  `go list -f '{{join .Imports "\n"}}' ./... | grep -E '^[^/]+\.[^/]+/' | grep -v '^<module>/' | sort -u`;
  `go mod why -m <module>` for a dependency nobody can place) · interfaces and method
  counts · global state and `init()` · layering violations (handlers touching storage
  or clients; upward imports) · run-time config (the flags, env and files the app reads
  at run time).
- **Constraints** — safety net (`go test -cover ./...`; build-tagged tests such as
  `go test -tags=integration ./...`; fixtures) · move constraints:
  `go list -f '{{.ImportPath}} ignored={{.IgnoredGoFiles}} cgo={{.CgoFiles}} embed={{.EmbedFiles}}' ./...`
  (generated code marked `DO NOT EDIT`; `//go:linkname`) · Docker and Homebrew setup
  (Dockerfiles, `.dockerignore`, compose files, how Homebrew gets into an image, the
  run configuration) · docs, versions and ownership (documentation home, architecture
  doc, latest tag via `git tag --list 'v*' --sort=-v:refname | head -1`, git hot
  files, `CODEOWNERS`).

## Deciding the cut

Decide the cut by the primary source, with the secondary as its guardrail:

- Primary — "Refactoring a Go Code into SOLID Code" by Juliardi Fajar Hidayatullah
  (Medium, 2022), including its closing comment that Go file and folder names carry
  no hyphens.
- Secondary — "From Monolith to Modularity: Refactoring Go Web Applications" by James
  Reed (Leapcell, 2025).

- **SRP — one actor per domain.** Domains are the article's use cases
  (`internal/<domain>/`), traced from entry points. Merge two only when they share
  nouns, stores and co-change; split one that serves unrelated routes or mostly
  touches another's data.
- **Four layers**: `handler` → `service` → `repository`, plus `model` — only those a
  domain uses.
- **OCP, ISP, DIP**: make each layer's contract an interface, split by action or role
  (`Search` / `Sync` / `Construct`); add a second implementation beside the first;
  point imports one way, with `cmd/<app>/main.go` alone naming concrete types. Apply
  the article's test: replace this domain's storage with another — do only the
  repository package and the wiring change? Export the role interfaces per layer — a
  divergence from the samber skills, which prefer consumer-owned interfaces; the
  consumer-side interface remains the tool for a cross-domain sliver or a cycle.
- **Kernel**: hold only what two or more domains need, each entry with its named
  consumers; one consumer means it lives in that domain.
- **Naming**: a created directory is a valid package name — one lowercase word, no
  hyphens or underscores (`appsearch`, `userservice`); the package name equals the
  directory name; file names are lowercase with underscores. This is stricter than
  `golang-naming`, which tolerates hyphenated multi-word directories. Rename an
  existing hyphenated directory in the step that moves it.
- **Order inside a domain**: model → config → repository → service → handler → rewire
  `main`, which ends as an orchestrator; keep each layer testable with the next one
  mocked. Keep it package-level in one module by default; a module split is its own
  plan. Leave alone what already fits: register it in the map.
- **Sizing**: a domain is right-sized when a fresh reader can take in its design entry
  plus every package it touches in one sitting; otherwise split by actor or stage the
  carve.
- **Each domain's checks**: build/vet/test green before and after; one-way imports in
  its subtree; concrete constructors referenced only from `cmd/`; no cross-domain
  import outside role interfaces and the kernel; the swap sentence true; no leftover
  alias or `REFACTOR(` marker; no hyphen in a created path.

## The carve

Dispatch one carver per domain. Carve the kernel first, then waves by dependency:
best-covered seams first, thinnest net last, with characterization tests written
first.

- **The brief is a file** and the single source of requirements: that domain's `Dk`,
  its Task, the global constraints, the pinned contracts it consumes, its worktree and
  base. Never the whole map.
- **Skills**: `$ponytail` always, with precedence, plus the map's assignments —
  `golang-refactoring` by default and one per surface (`golang-database` for a
  repository, `golang-concurrency` for goroutines or workers, the gRPC, GraphQL, CLI
  or flag skill for that transport: `golang-grpc`, `golang-graphql`, `golang-cli`).
- **The carver** works only in its worktree, follows `golang-refactoring`'s core
  loop, commits each step with the map's subject, never edits a Dockerfile (the Docker
  agent owns them), and records in its report any Docker impact (a moved binary or
  build input).
- **A red run** is reverted to `base`; a blocked domain is ledgered and re-dispatched
  once its blocker clears.

## The parallel rule

Run in parallel by default: the survey groups, the carvers of one wave, the
convergence run's reviewers, the documentation agents, and fix agents on
file-disjoint findings.

Go sequential only when two units share a file, a symbol or callers; when one needs
the other's groundwork (`golang-refactoring`'s checklist); for a workspace-wide
rename; and for merges.

## Worktrees

Follow the superpowers skill `using-git-worktrees`. Detect existing isolation first
(git-dir versus common-dir, with the submodule guard). Create worktrees with a
native worktree tool when it can create them, else `git worktree add` into a
git-ignored directory. In each one run `go mod download`, then a green baseline
`go build ./... && go vet ./... && go test ./...` — red is the operator's call before
any carve, because a red baseline makes every later failure ambiguous.

Keep one integration worktree on `decompose/<project>`, off the default branch, and
one worktree and branch (`carve/<domain>`) per in-flight carver; parallel carvers
never share one. Name each worktree, branch and base in the ledger.

## Dockerfiles

Give the Dockerfiles to one Docker agent, in its own worktree, in two passes. It
carries `$ponytail` plus `docker-skills:docker-build-strategies`;
`docker-skills:docker-project-foundations` joins when the project has no Docker
setup.

- **Pass 1, before the first carve, on the base tree.** No Dockerfile: generate one
  or more as the project dictates (one per binary, or one multi-stage file with a
  target per binary), each with a `.dockerignore`. Dockerfiles exist: build each and
  repair one only when its build fails. This is the parity run's image of the
  original.
- **Pass 2, after the merge.** Update them to the carved tree: moved build paths,
  new binaries, a changed module path, the Go version.
- **Packages**: every image the skill writes or updates installs what it needs with
  Homebrew — the repo's own way of getting it into an image, or Homebrew on a Debian
  or Ubuntu base when there is none, then `brew install`. mcpcli comes from
  `ConsulTent/tap/mcpcli`. Generated files carry no secrets.

## Merge and the convergence run

- **Merge** one domain at a time into `decompose/<project>`, each followed by
  build/vet/test. A conflict goes to a merge agent carrying `golang-refactoring`.
- **Parity harness**: an agent carrying `golang-testing` starts the original image
  and the carved image in separate containers, with the repo's run configuration
  adapted so the two do not collide (other ports, separate scratch stores), and the
  parameters from `run.env`. It never touches the live server. It sends both the
  same request matrix (the map's entry points) and diffs status, headers and bodies.
- **Review**: each verification skill — `golang-testing` always, plus what the
  surfaces demand — reviews in parallel, read-only, findings to files.
- **Loop until clean**: give every difference and finding a fix round from agents
  carrying their skill; the harness re-runs and each skill that reported re-reviews
  its fix, until both builds answer identically and no skill reports an open finding.
  Ledger what cannot be fixed as `blocked` and report it to the operator — never
  drop it.

## Cleanup, documentation, release

Run each on its own.

- **Cleanup**, after the convergence run: an agent carrying `golang-refactoring`
  deletes what the carve left behind — emptied directories and superseded files,
  leftover aliases and `REFACTOR(` markers, what `deadcode ./...` proves unreachable
  — then runs `go mod tidy`.
- **Imported modules**: when other repos import the module, an agent carrying
  `golang-dependency-management` applies the `/vN` module-path suffix.
- **Documentation**, by `golang-documentation`: one agent per carved-out section, in
  parallel, writes the `README.md` in its section; one agent writes
  `docs/PROJECT_MAP.md` — an `@`-link to each README — and links it from the root
  `AGENTS.md` (created with that link when absent). The architecture doc — the
  design contract — is rewritten to the as-built structure; create it when none
  exists.
- **Final proof**: build/vet/test green, and the parity harness runs once more.
- **Release**: grep-verify `run.env` and delete it; the ledger's `phase` goes to
  `release`; `decompose/<project>` merges into the default branch; its head is tagged
  `vN.0.0` — the latest `v*` tag's major plus one, `v1.0.0` when there is none;
  branch and tag are pushed; worktrees are removed; the ledger reads `done`.

## Hooks

The plugin ships `hooks/hooks.json`: five events, all calling
`hooks/decompose-hooks.cjs`; every failure fails open. State lives in
`.superpowers/sdd/golang-decompose-session.json`.

- A prompt that names `golang-decompose` arms the contract; `golang-decompose off`
  releases it, until the skill is named again.
- The gates arm when the ledger's phase reaches `carve`, release at `release`, and
  clear state at `done`.
- **SessionStart** re-injects the recovery map: the phase and one line per
  unfinished agent with its worktree and branch.
- **UserPromptSubmit** shows one status line per prompt, and the full ledger every
  3 completed agent runs.
- **PostToolUse on ExitPlanMode** injects the carve-start reminder at the map's
  approval.
- **PreToolUse on Bash — the ship-gate, uncapped** — before `release` it denies
  `git push`, `gh pr create` and `gh pr merge`, and any `git merge` or `git rebase`
  naming the carve branch or the default branch.
- **Stop** blocks while any agent is `pending` or `active`; with only `blocked`
  agents left it allows the stop and lists them.

## Hard rules

- The coordinator edits no source; agents dispatch no sub-agents.
- Every agent carries `$ponytail`.
- A carver gets its brief, never the whole map, and never edits a Dockerfile.
- Update the ledger with every dispatch and report.
- Keep the carve structural only.
- Cite symbols, never `file.go:NNN`.
- Runtime parameters never enter committed files, and never the live server's values
  in the harness.
- No merge or tag before the ledger reads `release`.
- No project-specific paths and no shipped `mcp` command.
