---
name: golang-project-init
description: Scaffold a new golang project from an approved implementation plan — or from an idea, through brainstorming — in the shape golang-decompose carves toward: domains under internal/<domain>/ with model, repository, service and handler layers, role interfaces, stub implementations, wiring in cmd/<app>/main.go, a test per package, the repo files and the doc set. Use when the operator asks to initialize, scaffold, or start a new golang project from a plan, a design or an idea.
---

# golang-project-init — scaffold a Go project from an approved plan

You are the coordinator of a scaffold: an approved Go implementation plan — or an
idea, when no plan is given — goes in, a green project skeleton comes out, in the
shape `golang-decompose` carves toward. Write every file yourself. A skeleton
only: stub bodies return `errNotImplemented` and carry no behavior.

- **`$ponytail`** rides you, with precedence: the smallest tree the plan asks for.
- **`$brainstorming`** supplies the plan when there is none, **`$golang-how-to`**
  routes the samber skills the plan's surfaces need, and **`$golang-code-style`**
  shapes every file. Load each by reading its SKILL.md directly (the Skill tool
  refuses ambiguous names in sub-agents).

## The pipeline

Run it in this order:

1. **Frame** — the ask (a plan or design doc, or an idea), the repo root, the
   project name, the constraints. Create the branch `init/<project>` off the
   default branch now, so everything this skill commits lands on it; in a repo
   with no commits, the first commit founds that branch. Remove any
   `INIT_LEDGER.json` left by an abandoned init — it would keep the gates armed.
2. **Brainstorm when no plan is given** — run `$brainstorming` as written: nothing
   is scaffolded before the design doc is approved and the operator has approved
   the plan. With a plan given, read it and ask only what the skeleton needs that
   it leaves open — binaries, domains, external systems, the DI choice.
3. **Route** — `$golang-how-to` picks the samber skills for the plan's surfaces.
   `golang-project-layout`'s two opening questions, architecture and DI, are
   already answered: by this shape and by step 2.
4. **Open the ledger** (below).
5. **Scaffold**, marking each unit `active` as it starts and committing it as it
   goes `done`.
6. **Verify** — `go mod tidy` (no dependency added without asking), then
   `go build ./... && go vet ./... && go test ./...` green, `gofmt -l .` empty,
   and no hyphen in a created directory outside `.superpowers/`. Set the ledger
   to `done`.
7. **Hand off** — the tree, what the plan left open, the commands to run.

To ask the operator mid-scaffold, mark the unfinished units `blocked`: the Stop
gate then lets the turn end and lists them.

## The skeleton

Scaffold in the order that stays green, one commit per unit —
`<domain>: <layer>`, `wiring: <app>`, then `repo-files` and `docs`; `go.mod`
rides in the first package's commit:

1. **`go.mod`** — `go mod init <module path>`: the repository URL, lowercase,
   hyphens for a multi-word module name.
2. **Each domain**, under `internal/<domain>/`, only the layers it uses, in the
   order model → repository → service → handler:
   - **model** — the domain's types, each with a doc comment.
   - **repository** — the role interface `<Entity>Repository`, carrying the
     methods the plan names; a stub struct named for the store the plan names
     (`PostgresOrderRepository`); a constructor `New<Stub>` taking that store (a
     `*sql.DB`, a client) or nothing when the plan names none.
   - **service** — the role interfaces, split by action as the plan names them
     (`OrderCreator`, `OrderReader`); a stub struct `<Entity>Service` and a
     constructor taking the repositories it reads.
   - **handler** — a stub `<Entity>Handler` whose constructor takes the service
     roles it calls, with one method per route, RPC or command the plan names
     and, for HTTP, a `Register(*http.ServeMux)`.

   A stub method returns `errNotImplemented`, unexported, one per package. An HTTP
   handler answers 501, gRPC `codes.Unimplemented`, a CLI the error itself. Every
   package opens with a package doc and a compile-time check
   (`var _ <Interface> = (*<stub>)(nil)`). Every package under `internal/` gets
   one test file beside its primary file: one test per stub method asserting
   `errors.Is(err, errNotImplemented)`, HTTP through `httptest`; a package with
   no stub gets a test that constructs its types.
3. **Wiring** — `cmd/<app>/main.go` per binary: read the config, construct the
   stores, the stubs and the handlers — a handler takes its services through
   their role interfaces — and run; an `http.Server` carries its
   `ReadHeaderTimeout`. `main` holds wiring only.
4. **Repo files** — Makefile, `.golangci.yml`, `.gitignore`, a Dockerfile with a
   `.dockerignore`: a multi-stage build from the `go.mod` toolchain onto a Debian
   or Ubuntu base; when the runtime needs packages, Homebrew goes on that base
   and `brew install` adds them.
5. **Docs** — a README (purpose, build, run, test, layout), `AGENTS.md` with
   `@docs/PROJECT_MAP.md` and the always-load directive that
   `golang-project-layout`'s initialization checklist writes at project creation,
   a README per domain, and `docs/PROJECT_MAP.md` with an `@`-link to each.

A created directory is a valid package name — one lowercase word, no hyphens or
underscores (`appsearch`, `userservice`) — and the package name equals the
directory name; file names are lowercase with underscores. This is stricter than
`golang-naming`, which tolerates hyphenated multi-word directories. The shape
follows "Refactoring a Go Code into SOLID Code" by Juliardi Fajar Hidayatullah
(Medium, 2022), as `golang-decompose` reads it.

## The ledger

Keep it at `.superpowers/sdd/<project>/INIT_LEDGER.json` in the invoking checkout —
git-ignored scratch (add the ignore rule when the repo lacks one), never
committed. One unit per package, plus `repo-files` and `docs`; the hooks read it,
so its shape is pinned:

```json
{
  "plan": "<plan or design doc path>",
  "phase": "scaffold | verify | done",
  "default_branch": "<name>",
  "init_branch": "init/<project>",
  "units": {
    "internal/<domain>/model": { "status": "pending" },
    "repo-files": { "status": "pending" },
    "docs": { "status": "pending" }
  }
}
```

Status runs `pending` → `active` → `done`, or `blocked`. Update it as each unit
starts and ends — it is the recovery map after compaction.

## Hooks

The plugin ships `hooks/hooks.json`: four events, all calling
`hooks/init-hooks.cjs`; every failure fails open. State lives in
`.superpowers/sdd/golang-project-init-session.json`.

- A prompt that names `golang-project-init` arms the contract;
  `golang-project-init off` releases it, until the skill is named again.
- The gates arm when the ledger's phase is `scaffold` or `verify`, and clear state
  at `done`.
- **SessionStart** re-injects the recovery map: the phase, the branch, and one
  line per unfinished unit.
- **PreToolUse on Bash — the ship-gate, uncapped** — before `done` it denies
  `git push`, `gh pr create` and `gh pr merge`, and any `git merge` or
  `git rebase` naming the init branch or the default branch.
- **Stop** blocks while any unit is `pending` or `active`; with only `blocked`
  units left it allows the stop and lists them.

## Hard rules

- Nothing is scaffolded before an approved design and plan.
- The coordinator writes every file itself.
- No dependency is added without asking.
- No hyphen in a created directory outside `.superpowers/`; the package name
  equals the directory name.
- Skeleton only: stub bodies return `errNotImplemented`, no behavior.
- Credentials never enter committed files.
