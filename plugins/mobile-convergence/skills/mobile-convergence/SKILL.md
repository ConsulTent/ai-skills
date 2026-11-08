---
name: mobile-convergence
description: The Android software factory — drive a Flutter/Dart plan from root-caused intent to a CONVERGED, reviewed state via the used-skills protocol (USED_SKILLS.json, ponytail-precedence combined runs, pass/remove iterations, zh-CN compactions), then hand off to SDD execution. Full battery: every flutter/dart skill is seeded into USED_SKILLS.json; each seeded skill's own run reports its fit. Use when the operator asks to plan, review, or polish an Android/Flutter change with the skill battery, or to converge an existing plan.
---

# MOBILE-CONVERGENCE — the Android software factory (plan-review SDLC)

You are an Android software factory. A change enters as root-caused intent and leaves as a
CONVERGED plan — one that survived every review lens in its inventory until the inventory
ran out — and then executes through SDD. The process is a bookkeeping protocol
(`USED_SKILLS.json`) wrapped around a review battery; follow it EXACTLY. Improvising the
protocol is a defect.

## The pipeline (every change, in order)

1. **Root-cause first-hand.** Every defect is verified by reading the code yourself —
   line-by-line through the shipped source, with build/device evidence where relevant —
   before any plan text exists. A symptom report is not a root cause; a root cause you
   inherited from a subagent's report is not first-hand. Cite symbols, never
   `lib/widgets/foo.dart:NNN` (a docs guard exists in most repos and reddens on
   line-number citations in markdown).
2. **Write the plan document** (shape below) and commit it to the repo's plan directory.
3. **Run the convergence loop** (the USED_SKILLS protocol below) until the skill inventory
   has run out. Then, and only then, present the plan for approval.
4. **The fold commit**: rewrite the plan document to the folded shape in ONE diff.
5. **Execute through SDD**: one worktree branch; per task a fresh implementer subagent
   (TDD — RED observed before GREEN) then a fresh task reviewer; a fix loop capped at five
   rounds; a final whole-branch review before the finish sequence.
6. **The finish sequence**: the live re-prove on a scratch device/emulator snapshot (NEVER
   the operator's device data or signed release builds); the visual gate for UI work; the
   version stamp; the STATUS done[] entry; the ledger copy; both doc guards re-run
   post-stamp and post-ledger; merge; push; cleanup (grep scratch for credentials FIRST).

## The plan document shape

- **Context** — the operator's ask verbatim in substance, the root causes with their
  evidence, and the ground truth the design stands on (named symbols, existing chassis
  reused). Unanswered forks proceed on the recommended default, stated as a ruling.
- **The design** — `D1..Dn`, each element with: pinned shapes (exact identifiers,
  signatures, string literals to use verbatim), the named symbols it reuses (existing
  helpers over new builds — rung 2 of the ladder), and every accepted simplification
  LEDGERED with the rejected alternative AND its cost ("X rejected: <the failure it
  causes>"). A trade-off without a named rejected alternative is not a ruling.
- **Rulings I made** — one line per decision taken on the operator's behalf.
- **Review trail** — the rounds, the lenses, the folds; compacted per the protocol.
- **Tasks** — SDD-structured, each with its commit subject; sequential when files share.
- **Verification** — the live repro matrix (the operator's repro verbatim where one
  exists), the absence receipts (zero forbidden log lines), the doc guards, and the
  cleanup step.

## USED_SKILLS.json — the convergence ledger

Location: the SDD workspace for this plan (`.superpowers/sdd/<plan>/USED_SKILLS.json`).

**Seed** it before pass 1 with EVERY skill in the battery — the flutter/dart catalog
unconditionally, the craft lenses per their activation rule:

```json
{
  "plan": "<plan file path>",
  "protocol": "One fresh run per skill per pass, one skill at a time, ponytail combined into every run (ponytail precedence, not recorded). A run that produces no plan change removes the skill. Iterate until USED_SKILLS.json has run out of skills. Compact 'Rulings I made' + 'Review trail' (zh-CN) after every 3 runs.",
  "skills": { "<skill>": { "runs": 0, "changes": [], "status": "active" } },
  "pass_log": []
}
```

**The pass loop** — repeat until the inventory is empty:

1. For each still-active skill, ONE run at a time (never parallel): a fresh review of the
   CURRENT plan text by a subagent carrying TWO lenses — the skill itself AND `$ponytail`
   combined in the SAME subagent, **ponytail taking PRECEDENCE**: the laziness ladder
   leads, and every skill finding must SURVIVE the ladder to stand (a finding the ladder
   would cut is named and cut; a cut that would create a real defect is named and kept).
   Findings are tagged by owning lens.
2. The reviewer's contract: read the committed plan plus the accumulated pass delta; report
   NEW findings only (or the explicit "no new findings — exhausted"); never manufacture
   findings; never re-litigate a folded ruling; verdict on the ladder
   `SHIP / SHIP-WITH-CUTS / SHIP-WITH-FINDINGS / REWORK`.
3. Fold every finding into the plan text (or cut it with a cited reason — a silent discard
   is forbidden), then update USED_SKILLS.json and make the decision: **KEEP or REMOVE the
   skill**. A run that produced no plan change REMOVES the skill — the lens is exhausted.
   Removal is permanent; a removed skill is skipped in all later passes.
4. Record ONLY the skill itself in USED_SKILLS.json (ponytail is a lens inside every run,
   never an entry). Note in the entry when a run's findings were all ponytail-attributed —
   that means the skill's own lens is spent even if the run changed the plan.
5. **After every 3 runs of a pass**: compact "Rulings I made" and "Review trail" —
   in **zh-CN** (the operator's standing language for these two sections) — and fold the
   compaction into the running plan text.
6. When every skill has been removed: **the plan is CONVERGED.** Rewrite the plan document
   to the folded shape in ONE diff (the fold commit) and present it for approval.

**The reviewer dispatch contract**: the subagent loads its skills by reading the SKILL.md
files directly (the Skill tool refuses ambiguous names in subagent context — the
documented fallback); it is read-only on the checkout; it never dispatches its own
subagents; it never re-runs the implementer's tests.

## The mobile review battery

The seed inventory — the official Flutter/Dart skills catalog (github.com/flutter/
agent-plugins, github.com/dart-lang/skills). Every skill below is seeded into
USED_SKILLS.json — none optional, none filtered by the plan's surfaces in advance; a
seeded skill's own run reports whether it fits the task, and the convergence loop settles
it (no plan change → removed; findings → it keeps running):

- **Flutter — UI & Layout**: `flutter-build-responsive-layout` (adaptive UI with
  `LayoutBuilder`, `MediaQuery`, `Expanded`/`Flexible`) · `flutter-fix-layout-issues`
  (RenderFlex overflow, unbounded constraints).
- **Flutter — Architecture & Data**: `flutter-apply-architecture-best-practices`
  (layered UI/Logic/Data, MVVM, repository pattern) · `flutter-implement-json-serialization`
  (`fromJson`/`toJson` models) · `flutter-setup-declarative-routing` (`MaterialApp.router`,
  `go_router`, deep links) · `flutter-setup-localization` (`flutter_localizations`, `intl`,
  `l10n.yaml`) · `flutter-use-http-package` (GET/POST/PUT/DELETE).
- **Flutter — Testing & Previews**: `flutter-add-widget-test` (`WidgetTester`: rendering,
  taps, scroll, text entry) · `flutter-add-widget-preview` (`@Preview` interactive
  previews) · `flutter-add-integration-test` (Flutter Driver; debug APK +
  `gradlew app:assembleAndroidTest` + `flutter drive`; Firebase Test Lab where configured).
- **Dart — Language & Docs**: `dart-use-doc-examples` (`{@example}` directives) ·
  `dart-use-pattern-matching` (switch expressions) · `dart-use-primary-constructors`
  (new constructor syntax) · `dart-write-documentation` (Effective Dart `///`).
- **Dart — Testing**: `dart-add-unit-test` (`package:test`) · `dart-generate-test-mocks`
  (`package:mockito` + `build_runner`) · `dart-collect-coverage` (coverage + LCOV).
- **Dart — Analysis & Debugging**: `dart-run-static-analysis` (`dart analyze`,
  `dart fix --apply`) · `dart-fix-runtime-errors` (stack trace via `get_runtime_errors`/
  lsp, fix, verify via `hot_reload`) · `dart-resolve-package-conflicts` (pub version
  solving) · `dart-migrate-to-checks-package` (matcher → checks).
- **Dart — CLI & Interop**: `dart-build-cli-app` (entrypoints, exit codes, subprocesses) ·
  `dart-setup-ffi-assets` (Native Assets hooks) · `dart-use-ffigen` (FFI bindings) ·
  `dart-use-path-package` (`package:path`/`package:file`).

- **The craft lenses** (OPTIONAL — the AI's discretion): `impeccable` (design/craft for
  anything visual or operator-facing — the rendered-result gate, the craft floor before
  UI edits, token-locked colors, the design system wins over novelty) and `hallmark`
  (the anti-slop design discipline — structural variety, honest copy with no invented
  metrics, roman headers, the mobile non-negotiables) when the change builds or reshapes
  UI. **Activation rule**: if the plan renders, reshapes, or ships operator-facing UI,
  seed them into USED_SKILLS.json like any other skill; a pure-logic plan skips them —
  the discretion is stated in the plan's seed note either way.
- **`ponytail`** rides every run (precedence) and closes each compaction.

**Lens probe sheet** (the minimum each lens asks of an Android plan):

- architecture — layered UI/Logic/Data; view-models own state, widgets stay dumb;
  repository seams over direct service calls; every new dependency's construction home named.
- responsive-layout — every surface at phone and tablet widths; the LayoutBuilder vs
  MediaQuery choice named; Expanded/Flexible vs fixed sizing ruled.
- fix-layout-issues — every RenderFlex overflow traced to its constraint source; every
  unbounded constraint named (ListView inside Column and friends).
- widget-test — every pin drives `WidgetTester` (pumpWidget, taps, text entry); RED
  reachable; deterministic (no sleeps); fixtures exercise behavior, not implementation.
- widget-preview — operator-facing surfaces get `@Preview` entries.
- integration-test — both APKs build (debug + `app:assembleAndroidTest`); `flutter drive`
  exercised end to end; Firebase Test Lab where the repo configures it.
- routing — `go_router` paths typed; every deep link has a test; no unnamed fallback route.
- localization — every user-facing string through `l10n.yaml`; zero hardcoded strings.
- serialization — `fromJson`/`toJson` total under null safety; schema drift named per field.
- http — timeout and non-2xx paths handled, not just the happy path; error surfaces mapped.
- static-analysis — `dart analyze` clean; `dart fix --apply` run; the lint config reviewed,
  never blanket-ignored.
- fix-runtime-errors — runtime evidence from `get_runtime_errors`, never vibes; the fix
  verified through `hot_reload`.
- package-conflicts — the pub resolution pinned; conflicts resolved at the version
  constraint, never with `dependency_overrides` vibes.
- coverage — new code paths covered; the LCOV report checked, not assumed.
- generate-test-mocks — mocks generated via build_runner; no hand-rolled fakes.
- docs — Effective Dart `///` on every public API surface the plan touches.
- pattern-matching/primary-constructors — modern Dart syntax where it removes boilerplate,
  none for its own sake.
- cli/ffi/path — subprocess exit codes routed; FFI bounds checked; file ops through
  `package:path`, never string math.
- impeccable — the rendered result judged at its ship sizes (the visual gate, or
  coordinator inspection with the analyzer when the judge is capped); the design
  system's token/depth/accent laws win; the craft floor loaded before any UI edit.
- hallmark — the pre-flight scan honored (existing tokens/fonts/palette preserved);
  the slop gates run post-build; structural variety against the project's own
  established system, never against a catalog default.

## The runtime bridge

The Dart MCP server (`dart mcp-server`) is the runtime-evidence channel:
`hot_reload`, `hot_restart`, `get_runtime_errors`, `list_running_apps`. Build facts come
from the analyzer; runtime facts come from the MCP tools — a runtime claim without an MCP
observation is not evidence. Android note: adb/emulator/gradle-variant lenses do not exist
upstream — device interaction rides the MCP server, and adb appears only as the plan
demands it.

## Skill freshness

The flutter and dart skills this factory loads are vendored under `vendor/`
(`agent-plugins`, `dart-skills` — git submodules, provenance reference). Adopt locally via
the upstreams' documented path: `npx skills add flutter/agent-plugins --skill '*' --agent
universal --yes` (and `npx skills add dart-lang/skills --skill '*' --agent universal
--yes`); update with `npx skills update`. The repo's weekly workflow
(`.github/workflows/update-3p-skills.yml`) bumps the submodule pins to upstream tips and
patch-bumps this plugin's version.

## Enforcement hooks

The plugin ships hooks (`hooks/hooks.json`) that make the convergence battery mechanically
un-skippable once `$mobile-convergence` is invoked: state lives in
`.superpowers/sdd/mobile-convergence-session.json` (phase `invoked` → `battery` at plan
approval); full mode pre-seeds
`.superpowers/sdd/mobile-convergence-pending-ledger.json` at approval — move it into the
plan's SDD workspace as `USED_SKILLS.json` and fill `plan`. The Stop hook gates stopping
while any skill is `active` (the harness caps continuations; `$mobile-convergence off`
exits the contract), and SessionStart re-injects the contract after compaction or in any
session entering the repo mid-flight. The PreToolUse hook also denies ship-shaped git
operations (push, merge, rebase, PR create/merge) while the battery is pending — the stop
gate only nudges (the harness caps continuations at 3 per stop-attempt), the ship-gate
does not cap. The hook displays the current USED_SKILLS.json to the operator as a status
message every 3 runs — the compaction cadence. The hooks never edit the plan — they gate
stopping and inject reminders; any hook failure fails open.

## Hard rules of the factory

- **Symbol citations only** in every markdown the plan touches (`WidgetName` / `funcName` —
  never a source file name followed by a line number); re-run the docs guard after any
  plan-file edit and again after any ledger text lands.
- **Credentials never enter committed files** — plans, ledgers, STATUS, fixtures, logs;
  keys ride command lines or env at runtime; scratch is grep-verified before deletion.
- **TDD RED-first** on every behavioral task; a RED that cannot fail is not a pin.
- **Live, not just green** — the repro matrix on a scratch device/emulator snapshot proves
  the operator's scenario; runtime claims carry MCP observations; the absence receipts
  (zero forbidden log lines) are assertions, not vibes.
- **Hot reload discipline** — reload after UI/simple-method edits, restart after
  `initState`/global state/`main()` changes (the reload-vs-restart decision table); never
  ship a session whose last evidence predates the last edit.
- **The one-diff rewrite** — the plan document is rewritten to the folded shape at the
  fold commit; a delta appendix that implementers must reconcile against the plan is a
  defect the ladder cuts.
- **Craft lenses review DESIGN, not protocol** — an impeccable/hallmark finding never
  extends the convergence loop's rules, only the plan's content (they follow the same
  fold-or-cut discipline as every other lens).
- **Convergence is not approval** — the converged plan is presented; execution starts on
  the operator's word.

## After convergence (the SDD handoff)

Execute the Tasks section through the subagent-driven-development pipeline: a worktree
branch per plan; the plan file committed first; per task the implementer brief (exact
values verbatim), the implementer, the review package, the task reviewer, the fix loop
(≤5, findings parked with rulings, never silently dropped); then the whole-branch review,
the live re-prove, the stamp + STATUS + ledger + guards, merge, push, cleanup — and the
shipping report ends with the complete "Rulings I made" list, every ledgered ruling
surfaced with its cost.
