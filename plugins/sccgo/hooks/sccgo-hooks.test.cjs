#!/usr/bin/env node
// Fixture test for sccgo-hooks.cjs — the one test: a state machine over fixture
// dirs. Run: node plugins/sccgo/hooks/sccgo-hooks.test.cjs
const { spawnSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const HOOK = path.join(__dirname, "sccgo-hooks.cjs");
let failures = 0;
let n = 0;

function run(event, opts = {}) {
  const r = spawnSync(process.execPath, [HOOK, event], {
    cwd: opts.cwd,
    input: JSON.stringify(opts.stdin || {}),
    encoding: "utf8",
    timeout: 8000,
  });
  return { code: r.status, out: (r.stdout || "").trim(), err: (r.stderr || "").trim() };
}
function check(label, cond, detail) {
  n++;
  if (cond) console.log(`PASS ${label}`);
  else { failures++; console.log(`FAIL ${label}${detail ? " — " + detail : ""}`); }
}
function project(name) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `sccgo-hook-${name}-`));
  fs.mkdirSync(path.join(dir, ".superpowers", "sdd"), { recursive: true });
  return dir;
}
function readJSON(p) { return JSON.parse(fs.readFileSync(p, "utf8")); }
function ctxOf(r) {
  try { return JSON.parse(r.out).hookSpecificOutput.additionalContext || ""; }
  catch (e) { return null; }
}

// 1. Empty project: hooks are invisible no-ops.
let p = project("empty");
let r = run("session-start", { cwd: p });
check("session-start empty: silent 0", r.code === 0 && r.out === "", `code=${r.code} out=${r.out}`);
r = run("stop", { cwd: p });
check("stop empty: fast-path 0", r.code === 0 && r.out === "" && r.err === "", `code=${r.code} err=${r.err}`);

// 2. Activation: full mode.
r = run("prompt-submit", { cwd: p, stdin: { prompt: "plan T30 with $sccgo please" } });
check("prompt-submit activates full", r.code === 0 && /CONTRACT ACTIVE \(full/.test(ctxOf(r) || ""), ctxOf(r));
const st = readJSON(path.join(p, ".superpowers", "sdd", "sccgo-session.json"));
check("state written: invoked/full", st.mode === "full" && st.phase === "invoked", JSON.stringify(st));
check("sdd gitignore written", fs.readFileSync(path.join(p, ".superpowers", "sdd", ".gitignore"), "utf8").includes("*"));

// 3. Stop during planning (phase invoked) is allowed.
r = run("stop", { cwd: p });
check("stop phase=invoked: allowed", r.code === 0 && r.out === "" && r.err === "", `code=${r.code} err=${r.err}`);

// 4. Plan approval: phase flips, pending ledger pre-seeded (45 skills, how-to excluded).
r = run("tool-use", { cwd: p, stdin: {} });
const pendPath = path.join(p, ".superpowers", "sdd", "sccgo-pending-ledger.json");
const led = readJSON(pendPath);
check("tool-use flips to battery", readJSON(path.join(p, ".superpowers", "sdd", "sccgo-session.json")).phase === "battery");
check("pending ledger seeded with 45 skills", Object.keys(led.skills).length === 45 && !(led.skills["golang-how-to"]), String(Object.keys(led.skills).length));
check("tool-use instructs the move", /pre-seeded with 45/.test(ctxOf(r) || ""), ctxOf(r));

// 5. Stop gate: blocks on the un-moved pre-seed; stop_hook_active defers.
r = run("stop", { cwd: p, stdin: { stop_hook_active: true } });
check("stop stop_hook_active: defer", r.code === 0 && r.out === "", `code=${r.code}`);
r = run("stop", { cwd: p });
check("stop blocks on pending ledger (exit 2)", r.code === 2 && /sccgo-pending-ledger\.json/.test(r.err), `code=${r.code} err=${r.err}`);

// 6. Ledger moved into the plan workspace: gate still blocks, message names the plan.
const wsDir = path.join(p, ".superpowers", "sdd", "2026-11-08-t30");
fs.mkdirSync(wsDir);
fs.renameSync(pendPath, path.join(wsDir, "USED_SKILLS.json"));
r = run("prompt-submit", { cwd: p, stdin: { prompt: "continue" } });
check("per-turn status counts active", /45 skill\(s\) still active/.test(ctxOf(r) || ""), ctxOf(r));
r = run("stop", { cwd: p });
check("stop blocks naming the plan ledger", r.code === 2 && /2026-11-08-t30[\\/]/.test(r.err) && /45 skill\(s\)/.test(r.err), `code=${r.code} err=${r.err}`);

// 7. Convergence: inventory empty -> allow, CONVERGED context, state cleared.
fs.writeFileSync(path.join(wsDir, "USED_SKILLS.json"), JSON.stringify({ plan: "x", protocol: "p", skills: {}, pass_log: [] }));
r = run("stop", { cwd: p });
check("stop on converged: 0 + CONVERGED", r.code === 0 && /CONVERGED/.test(ctxOf(r) || ""), `code=${r.code} ctx=${ctxOf(r)}`);
check("state cleared at convergence", !fs.existsSync(path.join(p, ".superpowers", "sdd", "sccgo-session.json")));

// 8. SessionStart re-injects for any session entering a repo mid-flight
// (in-flight ledger, NO state file — the root-cause-1 scenario).
fs.writeFileSync(
  path.join(wsDir, "USED_SKILLS.json"),
  JSON.stringify({ plan: "x", protocol: "p", skills: { "golang-samber-do": { runs: 1, changes: [], status: "active" } }, pass_log: [] }),
);
r = run("session-start", { cwd: p });
check("session-start sees in-flight ledger", r.code === 0 && /CONTRACT ACTIVE in this repo/.test(ctxOf(r) || ""), ctxOf(r));

// 9. Battery phase without any ledger blocks with the seed instruction.
p = project("noseed");
run("prompt-submit", { cwd: p, stdin: { prompt: "$sccgo" } });
run("tool-use", { cwd: p, stdin: {} });
fs.unlinkSync(path.join(p, ".superpowers", "sdd", "sccgo-pending-ledger.json"));
r = run("stop", { cwd: p });
check("stop blocks when ledger missing", r.code === 2 && /no USED_SKILLS\.json/.test(r.err), `code=${r.code} err=${r.err}`);

// 10. The escape hatch: $sccgo off clears the contract.
r = run("prompt-submit", { cwd: p, stdin: { prompt: "$sccgo off" } });
check("$sccgo off clears state", r.code === 0 && /CONTRACT OFF/.test(ctxOf(r) || "") && !fs.existsSync(path.join(p, ".superpowers", "sdd", "sccgo-session.json")), ctxOf(r));
r = run("stop", { cwd: p });
check("stop after off: released", r.code === 0 && r.out === "" && r.err === "", `code=${r.code}`);

// 11. Partial mode activates distinctly.
r = run("prompt-submit", { cwd: p, stdin: { prompt: "$sccgo-partial polish this" } });
check("partial activation", /CONTRACT ACTIVE \(partial battery\)/.test(ctxOf(r) || ""), ctxOf(r));

// 12. Ship-gate: PreToolUse denies ship-shaped git ops while pending (uncapped).
p = project("shipgate");
run("prompt-submit", { cwd: p, stdin: { prompt: "$sccgo" } });
run("tool-use", { cwd: p, stdin: {} });
r = run("pretool-use", { cwd: p, stdin: { tool_input: { command: "git push origin main" } } });
check("ship-gate denies git push (pending pre-seed)", r.code === 2 && /ship-gate/.test(r.err) && /sccgo-pending-ledger\.json/.test(r.err), `code=${r.code} err=${r.err}`);
r = run("pretool-use", { cwd: p, stdin: { tool_input: { command: "git status" } } });
check("ship-gate passes git status", r.code === 0 && r.out === "" && r.err === "", `code=${r.code}`);
r = run("pretool-use", { cwd: p, stdin: { tool_input: { command: "git commit -m plan update" } } });
check("ship-gate passes git commit (loop bookkeeping)", r.code === 0, `code=${r.code}`);
const ws2 = path.join(p, ".superpowers", "sdd", "plan-x");
fs.mkdirSync(ws2);
fs.renameSync(path.join(p, ".superpowers", "sdd", "sccgo-pending-ledger.json"), path.join(ws2, "USED_SKILLS.json"));
r = run("pretool-use", { cwd: p, stdin: { tool_input: { command: "git push" } } });
check("ship-gate denies naming the plan ledger", r.code === 2 && /plan-x/.test(r.err) && /45 skill\(s\)/.test(r.err), `code=${r.code} err=${r.err}`);
fs.writeFileSync(path.join(ws2, "USED_SKILLS.json"), JSON.stringify({ plan: "x", protocol: "p", skills: {}, pass_log: [] }));
r = run("pretool-use", { cwd: p, stdin: { tool_input: { command: "git push" } } });
check("ship-gate passes converged ledger", r.code === 0, `code=${r.code}`);
p = project("invokedpush");
run("prompt-submit", { cwd: p, stdin: { prompt: "$sccgo" } });
r = run("pretool-use", { cwd: p, stdin: { tool_input: { command: "git push" } } });
check("ship-gate passes phase=invoked (arms at approval)", r.code === 0, `code=${r.code}`);
p = project("nostate");
r = run("pretool-use", { cwd: p, stdin: { tool_input: { command: "git push" } } });
check("ship-gate fast-path with no state", r.code === 0 && r.out === "", `code=${r.code}`);

// 13. Ledger display every 3 runs — the compaction cadence.
p = project("display");
run("prompt-submit", { cwd: p, stdin: { prompt: "$sccgo" } });
run("tool-use", { cwd: p, stdin: {} });
const ws3 = path.join(p, ".superpowers", "sdd", "plan-d");
fs.mkdirSync(ws3);
fs.renameSync(path.join(p, ".superpowers", "sdd", "sccgo-pending-ledger.json"), path.join(ws3, "USED_SKILLS.json"));
r = run("prompt-submit", { cwd: p, stdin: { prompt: "continue" } });
check("no display at 0 runs", !/LEDGER STATUS/.test(ctxOf(r) || ""), ctxOf(r));
let led2 = readJSON(path.join(ws3, "USED_SKILLS.json"));
Object.keys(led2.skills).slice(0, 3).forEach((k) => { led2.skills[k].runs = 1; });
fs.writeFileSync(path.join(ws3, "USED_SKILLS.json"), JSON.stringify(led2));
r = run("prompt-submit", { cwd: p, stdin: { prompt: "continue" } });
check("ledger displayed at the 3-run boundary", /LEDGER STATUS \(after 3 review runs/.test(ctxOf(r) || "") && /runs: 1/.test(ctxOf(r) || ""), ctxOf(r));
check("boundary persisted in state", readJSON(path.join(p, ".superpowers", "sdd", "sccgo-session.json")).last_shown_run_total === 1);
r = run("prompt-submit", { cwd: p, stdin: { prompt: "continue" } });
check("no repeat before the next boundary", !/LEDGER STATUS/.test(ctxOf(r) || "") && /battery in flight/.test(ctxOf(r) || ""), ctxOf(r));
led2 = readJSON(path.join(ws3, "USED_SKILLS.json"));
Object.keys(led2.skills).slice(3, 6).forEach((k) => { led2.skills[k].runs = 1; });
fs.writeFileSync(path.join(ws3, "USED_SKILLS.json"), JSON.stringify(led2));
r = run("prompt-submit", { cwd: p, stdin: { prompt: "continue" } });
check("ledger displayed again at 6 runs", /LEDGER STATUS \(after 6 review runs/.test(ctxOf(r) || ""), ctxOf(r));

console.log(`\n${n - failures}/${n} passed`);
process.exit(failures ? 1 : 0);
