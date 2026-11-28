#!/usr/bin/env node
// golang-decompose enforcement hooks — a carve in flight is resumable and
// un-shippable until its ledger reads `release`. State:
// <project>/.superpowers/sdd/golang-decompose-session.json
// ({ started_at } once a prompt names the skill; { off: true } after
// "golang-decompose off"; deleted when every ledger reads `done`).
// Ledger: every .superpowers/sdd/<name>/DECOMPOSE_LEDGER.json — `agents` keyed by
// name (runs, status, worktree, branch), `phase`, `default_branch`, `carve_branch`.
// Plumbing mirrors sccgo's hook (state file, stdin fallback timer, fail-open).
// The hooks never edit source or ledgers — they gate stopping and ship-shaped git ops.
// shortcut: global options other than `-C <path>` and a bare `git merge` slip the
// ship-gate; tighten when a carve needs it.

const fs = require("fs");
const path = require("path");

const EVENT = process.argv[2] || "";
// At `carve` and before `release`, a push or a merge would ship an unfinished carve.
const ARMED = ["carve", "merge", "verify", "clean", "docs"];
// A prompt that names the skill arms the contract; with `off` it releases it.
const NAMED = /(?<![\w-])[$@/]?golang-decompose(?![\w-])/i;
const OFF = /(?<![\w-])[$@/]?golang-decompose\s+off\b/i;
// `git [-C <path>] push|merge|rebase` — the worktree form is this skill's likeliest.
const GIT_OP = /\bgit\s+(?:-C\s+\S+\s+)?(push|merge|rebase)\b\s*([^\n|;&]*)/gi;

// --- plumbing (sccgo's) -------------------------------------------------------

function projectDir(data) {
  return (data && typeof data.cwd === "string" && data.cwd) || process.cwd();
}
function sddDir(data) {
  return path.join(projectDir(data), ".superpowers", "sdd");
}
function statePath(data) {
  return path.join(sddDir(data), "golang-decompose-session.json");
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

// Every ledger under .superpowers/sdd/<name>/DECOMPOSE_LEDGER.json, its agents bucketed.
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
    const file = path.join(dir, name, "DECOMPOSE_LEDGER.json");
    let ledger;
    try { ledger = parse(fs.readFileSync(file, "utf8")); } catch (e) { continue; }
    if (!ledger || typeof ledger !== "object") continue;
    const entries = ledger.agents && typeof ledger.agents === "object" ? ledger.agents : {};
    const agents = Object.entries(entries).map(([id, a]) => Object.assign({ id }, a && typeof a === "object" ? a : {}));
    out.push({
      rel: path.relative(projectDir(data), path.dirname(file)),
      phase: typeof ledger.phase === "string" ? ledger.phase : "",
      branches: [ledger.carve_branch, ledger.default_branch].filter((b) => typeof b === "string" && b),
      agents,
      inflight: agents.filter((a) => a.status === "pending" || a.status === "active"),
      blocked: agents.filter((a) => a.status === "blocked"),
      unfinished: agents.filter((a) => a.status !== "done" && a.status !== "cut"),
      runs: agents.reduce((n, a) => n + (typeof a.runs === "number" ? a.runs : 0), 0),
    });
  }
  return out;
}

/** Ledgers whose carve is under way — none once `off` released the contract. */
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
    inject("UserPromptSubmit", "DECOMPOSE CONTRACT OFF — the carve gate no longer applies until the skill is named again.");
    return;
  }
  if (NAMED.test(prompt)) {
    writeState(data, { started_at: new Date().toISOString() });
    inject(
      "UserPromptSubmit",
      "DECOMPOSE CONTRACT ACTIVE — once the domain map is approved the carve runs on its own: parallel by default, " +
        "every agent carries $ponytail, the ledger (DECOMPOSE_LEDGER.json) is updated with every dispatch and report. " +
        "The gates hold the carve until its ledger reads `release`. $golang-decompose off exits the contract.",
    );
    return;
  }
  const state = readState(data);
  if (!state || state.off) return; // silent for every other prompt
  const list = armed(data);
  if (!list.length) return;
  if (showLedgerIfBoundary(data, state, list)) return; // every 3 runs: the ledger itself
  const inflight = list.reduce((k, l) => k + l.inflight.length, 0);
  const blocked = list.reduce((k, l) => k + l.blocked.length, 0);
  inject(
    "UserPromptSubmit",
    `DECOMPOSE carve in flight: ${inflight} agent(s) in flight, ${blocked} blocked, phase ${list[0].phase} in ${list[0].rel}.`,
  );
}

/** Every 3 completed agent runs — surface the ledger, one line per agent. */
function showLedgerIfBoundary(data, state, list) {
  const total = list.reduce((k, l) => k + l.runs, 0);
  const boundary = Math.floor(total / 3);
  const shown = typeof state.last_shown_run_total === "number" ? state.last_shown_run_total : 0;
  if (boundary <= shown) return false;
  state.last_shown_run_total = boundary;
  writeState(data, state);
  inject(
    "UserPromptSubmit",
    `DECOMPOSE LEDGER STATUS (after ${total} agent runs):\n` +
      list
        .map((l) => l.agents.map((a) => `- ${a.id} (${a.status || "?"}, runs: ${a.runs || 0}, worktree: ${a.worktree || "-"}, branch: ${a.branch || "-"})`).join("\n"))
        .join("\n"),
  );
  return true;
}

/** Does this command push, open or merge a PR, or merge/rebase into a protected branch? */
function ships(cmd, branches) {
  if (/\bgit\s+(?:-C\s+\S+\s+)?push\b|\bgh\s+pr\s+(create|merge)\b/i.test(cmd)) return true;
  const names = branches.length ? branches : ["decompose/", "main", "master"];
  for (const m of cmd.matchAll(GIT_OP)) {
    if (m[1] === "push") continue; // handled above
    const target = m[2].split(/\s+/).find((t) => t && !t.startsWith("-"));
    if (target && names.some((n) => (n.endsWith("/") ? target.startsWith(n) : target === n))) return true;
  }
  return false;
}

/** The uncapped gate: no ship-shaped git op lands while a carve is unfinished. */
function pretoolUse(data) {
  const list = armed(data);
  if (!list.length) return; // fast path — nothing in flight
  const cmd = data.tool_input && typeof data.tool_input.command === "string" ? data.tool_input.command : "";
  if (!cmd) return;
  const l = list.find((x) => ships(cmd, x.branches));
  if (!l) return;
  block(
    `DECOMPOSE ship-gate: phase ${l.phase} in ${l.rel} — finish the carve until the ledger reads \`release\`. ` +
      'Plain "git commit", "git merge carve/<domain>" and "git worktree" are unaffected. $golang-decompose off exits the contract.',
  );
}

function toolUse(data) {
  const state = readState(data);
  if (!state || state.off || !ledgers(data).length) return; // no contract, or nothing opened to carve
  inject(
    "PostToolUse",
    "DECOMPOSE: map approved — the carve starts now. Create the integration worktree on the carve branch, run Docker pass 1, " +
      "then dispatch wave 1 with one worktree per carver, $ponytail on every agent, and the ledger updated with every dispatch. " +
      "$golang-decompose off exits the contract.",
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
      inject("Stop", "DECOMPOSE: the carve is done — the contract is released.");
    }
    return;
  }
  const inflight = list.flatMap((l) => l.inflight.map((a) => `${a.id} (${l.rel})`));
  if (inflight.length) {
    block(
      `DECOMPOSE carve: ${inflight.length} agent(s) in flight — ${inflight.join(", ")}. ` +
        "Dispatch or finish them and update the ledger; the gates hold until it reads `release`. $golang-decompose off exits the contract.",
    );
  }
  const blocked = list.flatMap((l) => l.blocked.map((a) => `${a.id} (${l.rel})`));
  if (blocked.length) inject("Stop", `DECOMPOSE: ${blocked.length} agent(s) blocked — your ruling needed: ${blocked.join(", ")}.`);
}

function sessionStart(data) {
  const list = armed(data);
  if (!list.length) return; // nothing in flight: planning, released or off
  const lines = list.flatMap((l) =>
    l.unfinished.map((a) => `- ${a.id} (${a.status || "?"}, worktree: ${a.worktree || "-"}, branch: ${a.branch || "-"})`),
  );
  const phases = list.map((l) => `${l.rel}: ${l.phase}`).join("; ");
  inject(
    "SessionStart",
    `DECOMPOSE CONTRACT ACTIVE in this repo (${phases}). Unfinished agents:\n${lines.join("\n") || "- none"}\n` +
      "Resume from the ledger, `git worktree list` and `git log`; every agent carries $ponytail; the gates hold until the ledger reads `release`. " +
      "$golang-decompose off exits the contract.",
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
      else if (EVENT === "tool-use") toolUse(data);
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
