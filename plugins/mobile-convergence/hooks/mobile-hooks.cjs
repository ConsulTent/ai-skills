#!/usr/bin/env node
// mobile-convergence enforcement hooks — the convergence battery is mechanically
// un-skippable once $mobile-convergence is invoked. State:
// <project>/.superpowers/sdd/mobile-convergence-session.json (phase "invoked" ->
// "battery" at plan approval; deleted at CONVERGED or "$mobile-convergence off").
// Patterns: ponytail (state file, stdin fallback timer, fail-silent) + impeccable
// (state-driven Stop gate, stop_hook_active guard, harness caps continuations).
// The hooks never edit plans — they gate stopping and inject reminders.

const fs = require("fs");
const path = require("path");
const { CATALOG, SEED_EXCLUDE } = require("./mobile-catalog");

const EVENT = process.argv[2] || "";
const PROTOCOL =
  "One fresh run per skill per pass, one skill at a time, ponytail combined into every run (ponytail precedence, not recorded). A run that produces no plan change removes the skill. Iterate until USED_SKILLS.json has run out of skills. Compact 'Rulings I made' + 'Review trail' (zh-CN) after every 3 runs.";

// --- plumbing ---------------------------------------------------------------

function projectDir(data) {
  return (data && typeof data.cwd === "string" && data.cwd) || process.cwd();
}
function sddDir(data) {
  return path.join(projectDir(data), ".superpowers", "sdd");
}
function statePath(data) {
  return path.join(sddDir(data), "mobile-convergence-session.json");
}
function pendingLedgerPath(data) {
  return path.join(sddDir(data), "mobile-convergence-pending-ledger.json");
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

function readState(data) {
  try {
    return JSON.parse(fs.readFileSync(statePath(data), "utf8").replace(/^\uFEFF/, ""));
  } catch (e) {
    return null;
  }
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

/** {pending: [{path, rel, name, active}], converged: [{path, rel, name}]} */
function batteryStatus(data) {
  const dir = sddDir(data);
  const out = { pending: [], converged: [] };
  let paths = [];
  try {
    paths = fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => path.join(dir, e.name, "USED_SKILLS.json"));
  } catch (e) { /* no sdd dir yet */ }
  paths.push(pendingLedgerPath(data));
  for (const p of paths) {
    let ledger;
    try {
      ledger = JSON.parse(fs.readFileSync(p, "utf8").replace(/^\uFEFF/, ""));
    } catch (e) { continue; } // absent or unreadable — fail open
    const skills = ledger && typeof ledger.skills === "object" ? ledger.skills : {};
    const active = Object.values(skills).filter(
      (s) => s && typeof s === "object" && s.status === "active",
    ).length;
    const entry = { path: p, rel: path.relative(projectDir(data), p), name: path.basename(path.dirname(p)), active };
    if (active > 0) out.pending.push(entry);
    else out.converged.push(entry);
  }
  return out;
}

function seedLedger() {
  const skills = {};
  for (const name of CATALOG) {
    if (SEED_EXCLUDE.includes(name)) continue;
    skills[name] = { runs: 0, changes: [], status: "active" };
  }
  return { plan: "", protocol: PROTOCOL, skills, pass_log: [] };
}

// --- event handlers ----------------------------------------------------------

function promptSubmit(data) {
  const prompt = (data.prompt || "").trim();
  const project = projectDir(data);
  if (/[$@/]mobile-convergence(-partial)?\s+off\b/i.test(prompt)) {
    clearState(data);
    inject("UserPromptSubmit", "MOBILE-CONVERGENCE CONTRACT OFF — the convergence gate no longer applies in this repo.");
    return;
  }
  const m = prompt.match(/[$@/]mobile-convergence(-partial)?\b/i);
  if (m) {
    const mode = m[1] ? "partial" : "full";
    const prev = readState(data);
    writeState(data, {
      mode,
      phase: (prev && prev.phase) || "invoked",
      started_at: (prev && prev.started_at) || new Date().toISOString(),
    });
    const seed =
      mode === "full"
        ? "at plan approval a ledger pre-seeded with every flutter/dart skill lands in .superpowers/sdd/ — move it into the plan's SDD workspace as USED_SKILLS.json and fill \"plan\"; impeccable/hallmark join per the activation rule"
        : "seed .superpowers/sdd/<plan>/USED_SKILLS.json with every review skill the plan will use";
    inject(
      "UserPromptSubmit",
      `MOBILE-CONVERGENCE CONTRACT ACTIVE (${mode} battery) — once the plan is approved the convergence loop is mandatory: ${seed}. ` +
        "One review run per skill per pass, one at a time, $ponytail combined in every run (precedence); a run that produces no plan change removes the skill; iterate until the inventory is empty = CONVERGED. " +
        "Stopping is gated until then. $mobile-convergence off exits the contract.",
    );
    return;
  }
  const state = readState(data);
  if (!state || state.phase !== "battery") return; // silent for every other prompt
  const bat = batteryStatus(data);
  if (bat.pending.length) {
    const p = bat.pending.find((x) => x.name !== "mobile-convergence-pending-ledger.json") || bat.pending[0];
    if (displayIfBoundary(data, state, p)) return; // every 3 runs: the ledger itself
    inject("UserPromptSubmit", `MOBILE-CONVERGENCE battery in flight: ${p.active} skill(s) still active in ${p.rel}.`);
  } else if (fs.existsSync(pendingLedgerPath(data))) {
    inject("UserPromptSubmit", "MOBILE-CONVERGENCE: move .superpowers/sdd/mobile-convergence-pending-ledger.json into the plan's SDD workspace as USED_SKILLS.json and fill \"plan\".");
  } else {
    inject("UserPromptSubmit", "MOBILE-CONVERGENCE: plan approved but no USED_SKILLS.json — seed the ledger.");
  }
}

/** Every 3 runs — the compaction cadence — show the operator the ledger itself. */
function displayIfBoundary(data, state, p) {
  let ledger;
  try {
    ledger = JSON.parse(fs.readFileSync(p.path, "utf8").replace(/^\uFEFF/, ""));
  } catch (e) { return false; }
  const skills = ledger.skills || {};
  const total = Object.values(skills).reduce(
    (n, s) => n + (s && typeof s.runs === "number" ? s.runs : 0), 0);
  const boundary = Math.floor(total / 3);
  const shown = typeof state.last_shown_run_total === "number" ? state.last_shown_run_total : 0;
  if (boundary <= shown) return false;
  state.last_shown_run_total = boundary;
  writeState(data, state);
  const active = Object.entries(skills).filter(([, s]) => s && s.status === "active");
  const removed = Object.keys(skills).length - active.length;
  const passes = Array.isArray(ledger.pass_log) ? ledger.pass_log.length : 0;
  inject(
    "UserPromptSubmit",
    `MOBILE-CONVERGENCE LEDGER STATUS (after ${total} review runs, pass_log entries: ${passes}) — surface this to the operator verbatim as a status message:\n` +
      `plan: ${ledger.plan || "(unset)"}\n` +
      `active skills (${active.length}${removed ? `, removed: ${removed}` : ""}):\n` +
      active.map(([name, s]) => `- ${name} (runs: ${s.runs || 0})`).join("\n"),
  );
  return true;
}

function toolUse(data) {
  const state = readState(data);
  if (!state) return; // no contract in this repo
  if (state.phase !== "battery") {
    state.phase = "battery";
    state.approved_at = new Date().toISOString();
    writeState(data, state);
  }
  const bat = batteryStatus(data);
  if (state.mode === "full" && !bat.pending.length) {
    fs.mkdirSync(sddDir(data), { recursive: true });
    fs.writeFileSync(pendingLedgerPath(data), JSON.stringify(seedLedger(), null, 2));
    const n = CATALOG.length - SEED_EXCLUDE.length;
    inject(
      "PostToolUse",
      `MOBILE-CONVERGENCE: plan approved — a ledger pre-seeded with ${n} flutter/dart skills is at .superpowers/sdd/mobile-convergence-pending-ledger.json. ` +
        'Move it to .superpowers/sdd/<plan>/USED_SKILLS.json and fill "plan"; add impeccable/hallmark per the activation rule if the plan renders UI. ' +
        "Begin pass 1 now: one skill at a time, $ponytail combined in every run (precedence); a run that produces no plan change removes the skill. " +
        "The stop gate enforces the loop until CONVERGED. $mobile-convergence off exits the contract.",
    );
  } else if (state.mode === "full") {
    inject("PostToolUse", "MOBILE-CONVERGENCE: plan approved — a ledger is already in flight; continue the convergence loop (the stop gate enforces it).");
  } else {
    inject(
      "PostToolUse",
      "MOBILE-CONVERGENCE (partial battery): plan approved — seed .superpowers/sdd/<plan>/USED_SKILLS.json with every review skill the plan will use, then begin pass 1 (one skill at a time, $ponytail combined, no-change removes). The stop gate enforces the loop until CONVERGED. $mobile-convergence off exits the contract.",
    );
  }
}

/** The uncapped gate: no ship-shaped git op lands while the battery is pending. */
function pretoolUse(data) {
  const state = readState(data);
  const bat = batteryStatus(data);
  // Armed only while work is genuinely outstanding: an active ledger, or an
  // approved plan whose ledger was never seeded. A converged ledger ships.
  const armed =
    bat.pending.length > 0 ||
    (state && state.phase === "battery" && !bat.converged.length);
  if (!armed) return; // fast path — one stat for every normal repo
  const cmd = data.tool_input && typeof data.tool_input.command === "string" ? data.tool_input.command : "";
  if (!/git\s+(push|merge|rebase)\b|gh\s+pr\s+(create|merge)\b/i.test(cmd)) return;
  const p = bat.pending[0];
  const where = p ? `${p.active} skill(s) still active in ${p.rel}` : "ledger not seeded yet";
  block(
    `MOBILE-CONVERGENCE convergence ship-gate: ${where} — converge before "${cmd.slice(0, 80)}". ` +
      'Plain "git commit" for loop bookkeeping is unaffected. $mobile-convergence off exits the contract.',
  );
}

function stop(data) {
  const state = readState(data);
  const bat = batteryStatus(data);
  if (!state && !bat.pending.length) return; // fast path — no contract anywhere
  if (data.stop_hook_active === true) return; // harness re-entry; it caps continuations anyway
  if (bat.pending.length) {
    const p = bat.pending[0];
    const hint =
      p.name === "mobile-convergence-pending-ledger.json"
        ? " (this is the approval pre-seed — move it into the plan's SDD workspace as USED_SKILLS.json first)"
        : "";
    block(
      `MOBILE-CONVERGENCE convergence battery: ${p.active} skill(s) still active in ${p.rel}${hint} — ` +
        "run the next single-skill review run ($ponytail combined, precedence); a run that produces no plan change removes the skill. $mobile-convergence off exits the contract.",
    );
  }
  if (state && state.phase === "battery") {
    if (bat.converged.length) {
      clearState(data);
      inject("Stop", "MOBILE-CONVERGENCE: the inventory is empty — the plan is CONVERGED. Present it for approval; convergence is not approval.");
      return;
    }
    block(
      "MOBILE-CONVERGENCE: plan approved but no USED_SKILLS.json — seed the ledger (.superpowers/sdd/<plan>/USED_SKILLS.json) before stopping. $mobile-convergence off exits the contract.",
    );
  }
  // phase "invoked" — still planning; stops are legitimate.
}

function sessionStart(data) {
  const bat = batteryStatus(data);
  const state = readState(data);
  if (!bat.pending.length && !(state && state.phase === "battery")) return;
  const p = bat.pending[0];
  const where = p ? `${p.active} skill(s) still active in ${p.rel}` : "ledger not seeded yet";
  inject(
    "SessionStart",
    `MOBILE-CONVERGENCE CONTRACT ACTIVE in this repo — the convergence battery is in flight (${where}). ` +
      "The protocol: one fresh run per skill per pass, one at a time, $ponytail combined (precedence); a no-change run removes the skill; iterate until the inventory is empty = CONVERGED. " +
      "Stopping is gated until then. $mobile-convergence off exits the contract.",
  );
}

// --- entry -------------------------------------------------------------------

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
