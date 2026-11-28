#!/usr/bin/env node
// golang-project-init enforcement hooks — a scaffold in flight is resumable and
// un-shippable until its ledger reads `done`. State:
// <project>/.superpowers/sdd/golang-project-init-session.json
// ({ started_at } once a prompt names the skill; { off: true } after
// "golang-project-init off"; deleted when every ledger reads `done`).
// Ledger: every .superpowers/sdd/<name>/INIT_LEDGER.json — `units` keyed by
// package path, `repo-files` or `docs`, each with a `status`; `phase`,
// `default_branch`, `init_branch`.
// Plumbing mirrors the golang-decompose plugin's hook (state file, stdin fallback
// timer, fail-open). The hooks never edit source or ledgers.
// shortcut: global options other than `-C <path>` and a bare `git merge` slip the
// ship-gate; tighten when a scaffold needs it.

const fs = require("fs");
const path = require("path");

const EVENT = process.argv[2] || "";
// During `scaffold` and `verify`, a push or a merge would ship an unfinished skeleton.
const ARMED = ["scaffold", "verify"];
// A prompt that names the skill arms the contract; with `off` it releases it.
const NAMED = /(?<![\w-])[$@/]?golang-project-init(?![\w-])/i;
const OFF = /(?<![\w-])[$@/]?golang-project-init\s+off\b/i;
// `git [-C <path>] push|merge|rebase`.
const GIT_OP = /\bgit\s+(?:-C\s+\S+\s+)?(push|merge|rebase)\b\s*([^\n|;&]*)/gi;

// --- plumbing (golang-decompose's) --------------------------------------------

function projectDir(data) {
  return (data && typeof data.cwd === "string" && data.cwd) || process.cwd();
}
function sddDir(data) {
  return path.join(projectDir(data), ".superpowers", "sdd");
}
function statePath(data) {
  return path.join(sddDir(data), "golang-project-init-session.json");
}

function inject(event, text) {
  process.stdout.write(
    JSON.stringify({ hookSpecificOutput: { hookEventName: event, additionalContext: text } }),
  );
}
function block(reason) {
  process.stderr.write(reason);
  process.exit(2);
}
function parse(text) {
  try { return JSON.parse(String(text).replace(/^\uFEFF/, "")); } catch (e) { return null; }
}
function readState(data) {
  try { return parse(fs.readFileSync(statePath(data), "utf8")); } catch (e) { return null; }
}
function writeState(data, state) {
  fs.mkdirSync(sddDir(data), { recursive: true });
  // Keep scratch invisible to git in target repos (superpowers does the same).
  const gi = path.join(sddDir(data), ".gitignore");
  if (!fs.existsSync(gi)) {
    try { fs.writeFileSync(gi, "*\n"); } catch (e) { /* best-effort */ }
  }
  fs.writeFileSync(statePath(data), JSON.stringify(state, null, 2));
}
function clearState(data) {
  try { fs.unlinkSync(statePath(data)); } catch (e) { /* already gone */ }
}

// Every ledger under .superpowers/sdd/<name>/INIT_LEDGER.json, its units bucketed.
function ledgers(data) {
  const dir = sddDir(data);
  let names = [];
  try {
    names = fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name);
  } catch (e) { return []; /* no sdd dir yet */ }
  const out = [];
  for (const name of names) {
    const file = path.join(dir, name, "INIT_LEDGER.json");
    let ledger;
    try { ledger = parse(fs.readFileSync(file, "utf8")); } catch (e) { continue; }
    if (!ledger || typeof ledger !== "object") continue;
    const entries = ledger.units && typeof ledger.units === "object" ? ledger.units : {};
    const units = Object.entries(entries).map(([id, u]) => Object.assign({ id }, u && typeof u === "object" ? u : {}));
    out.push({
      rel: path.relative(projectDir(data), path.dirname(file)),
      phase: typeof ledger.phase === "string" ? ledger.phase : "",
      initBranch: typeof ledger.init_branch === "string" ? ledger.init_branch : "",
      branches: [ledger.init_branch, ledger.default_branch].filter((b) => typeof b === "string" && b),
      inflight: units.filter((u) => u.status === "pending" || u.status === "active"),
      blocked: units.filter((u) => u.status === "blocked"),
      unfinished: units.filter((u) => u.status !== "done"),
    });
  }
  return out;
}

/** Ledgers whose scaffold is under way — none once `off` released the contract. */
function armed(data) {
  const state = readState(data);
  if (state && state.off) return [];
  return ledgers(data).filter((l) => ARMED.includes(l.phase));
}

// --- event handlers ------------------------------------------------------------

function promptSubmit(data) {
  const prompt = (data.prompt || "").trim();
  if (OFF.test(prompt)) {
    writeState(data, { off: true }); // a marker the gates honour; the ledger alone would keep them armed
    inject("UserPromptSubmit", "INIT CONTRACT OFF — the scaffold gate no longer applies until the skill is named again.");
    return;
  }
  if (NAMED.test(prompt)) {
    writeState(data, { started_at: new Date().toISOString() });
    inject(
      "UserPromptSubmit",
      "INIT CONTRACT ACTIVE — once a plan is approved the scaffold runs on its own: the coordinator writes every file " +
        "under $golang-code-style, each unit is committed as it goes, and the ledger (INIT_LEDGER.json) is updated as each " +
        "unit starts and ends. The gates hold the scaffold until its ledger reads `done`. $golang-project-init off exits the contract.",
    );
  }
}

/** Does this command push, open or merge a PR, or merge/rebase into a protected branch? */
function ships(cmd, branches) {
  if (/\bgit\s+(?:-C\s+\S+\s+)?push\b|\bgh\s+pr\s+(create|merge)\b/i.test(cmd)) return true;
  const names = branches.length ? branches : ["init/", "main", "master"];
  for (const m of cmd.matchAll(GIT_OP)) {
    if (m[1] === "push") continue; // handled above
    const target = m[2].split(/\s+/).find((t) => t && !t.startsWith("-"));
    if (target && names.some((n) => (n.endsWith("/") ? target.startsWith(n) : target === n))) return true;
  }
  return false;
}

/** The uncapped gate: no ship-shaped git op lands while a scaffold is unfinished. */
function pretoolUse(data) {
  const list = armed(data);
  if (!list.length) return; // fast path — nothing in flight
  const cmd = data.tool_input && typeof data.tool_input.command === "string" ? data.tool_input.command : "";
  if (!cmd) return;
  const l = list.find((x) => ships(cmd, x.branches));
  if (!l) return;
  block(
    `INIT ship-gate: phase ${l.phase} in ${l.rel} — finish the scaffold until the ledger reads \`done\`. ` +
      'Plain "git commit" and "git switch -c" are unaffected. $golang-project-init off exits the contract.',
  );
}

function stop(data) {
  if (data.stop_hook_active === true) return; // harness re-entry; it caps continuations anyway
  const list = armed(data);
  if (!list.length) {
    // Planning, released or off: the contract ends only when every ledger reads `done`.
    const all = ledgers(data);
    if (readState(data) && all.length && all.every((l) => l.phase === "done")) {
      clearState(data);
      inject("Stop", "INIT: the scaffold is done — the contract is released.");
    }
    return;
  }
  const inflight = list.flatMap((l) => l.inflight.map((u) => `${u.id} (${l.rel})`));
  if (inflight.length) {
    block(
      `INIT scaffold: ${inflight.length} unit(s) not done — ${inflight.join(", ")}. ` +
        "Write and commit them, marking each done in the ledger; the gates hold until it reads `done`. $golang-project-init off exits the contract.",
    );
  }
  const blocked = list.flatMap((l) => l.blocked.map((u) => `${u.id} (${l.rel})`));
  if (blocked.length) inject("Stop", `INIT: ${blocked.length} unit(s) blocked — the operator's answer is needed: ${blocked.join(", ")}.`);
}

function sessionStart(data) {
  const list = armed(data);
  if (!list.length) return; // nothing in flight: planning, released or off
  const lines = list.flatMap((l) => [
    `${l.rel}: phase ${l.phase}, branch ${l.initBranch || "-"}`,
    ...l.unfinished.map((u) => `- ${u.id} (${u.status || "?"})`),
  ]);
  inject(
    "SessionStart",
    `INIT CONTRACT ACTIVE in this repo. Unfinished units:\n${lines.join("\n")}\n` +
      "Resume from the ledger and `git status`; the gates hold until the ledger reads `done`. " +
      "$golang-project-init off exits the contract.",
  );
}

// --- entry ---------------------------------------------------------------------

function main() {
  let input = "";
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    let data = {};
    try { data = JSON.parse(input.replace(/^\uFEFF/, "")); } catch (e) { /* fail open */ }
    try {
      if (EVENT === "prompt-submit") promptSubmit(data);
      else if (EVENT === "pretool-use") pretoolUse(data);
      else if (EVENT === "stop") stop(data);
      else if (EVENT === "session-start") sessionStart(data);
    } catch (e) { /* every failure fails open */ }
    process.exit(0);
  };
  // Windows: the harness can close stdout/stdin early — never hang the session.
  process.stdin.on("data", (c) => { input += c; });
  process.stdin.on("end", finish);
  process.stdin.on("error", () => { input = ""; finish(); });
  setTimeout(finish, 1000).unref();
}

main();
