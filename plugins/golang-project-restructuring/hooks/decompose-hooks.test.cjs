#!/usr/bin/env node
// Fixture test for decompose-hooks.cjs — one state machine over fixture dirs.
// Run: node plugins/golang-project-restructuring/hooks/decompose-hooks.test.cjs
const { spawnSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const HOOK = path.join(__dirname, "decompose-hooks.cjs");
let failures = 0;
let n = 0;

function run(event, opts = {}) {
  const r = spawnSync(process.execPath, [HOOK, event], {
    cwd: opts.cwd,
    input: opts.raw !== undefined ? opts.raw : JSON.stringify(opts.stdin || {}),
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
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `decompose-hook-${name}-`));
  fs.mkdirSync(path.join(dir, ".superpowers", "sdd"), { recursive: true });
  return dir;
}
function readJSON(p) { return JSON.parse(fs.readFileSync(p, "utf8")); }
function ctxOf(r) {
  try { return JSON.parse(r.out).hookSpecificOutput.additionalContext || ""; }
  catch (e) { return null; }
}
const stateFile = (p) => path.join(p, ".superpowers", "sdd", "golang-decompose-session.json");
const silent = (r) => r.code === 0 && r.out === "" && r.err === "";
const say = (p, prompt) => run("prompt-submit", { cwd: p, stdin: { prompt } });
const activate = (p) => say(p, "$golang-decompose");
const gate = (p, command) => run("pretool-use", { cwd: p, stdin: { tool_input: { command } } });
// One ledger agent: `runs` completed runs, a worktree and a branch to recover.
const agent = (status, runs = 0) => ({ runs, status, worktree: "../w-user", branch: "carve/user", changes: [] });
function ledger(p, phase, agents, extra = {}) {
  const dir = path.join(p, ".superpowers", "sdd", "shop-domains");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, "DECOMPOSE_LEDGER.json"),
    JSON.stringify(Object.assign({ plan: "docs/domains.md", phase, default_branch: "main", carve_branch: "decompose/shop", agents }, extra)),
  );
}

// 1. Empty project: hooks are invisible no-ops.
let p = project("empty");
let r = run("session-start", { cwd: p });
check("session-start empty: silent", silent(r), r.out);
r = run("stop", { cwd: p });
check("stop empty: silent", silent(r), r.err);
r = gate(p, "git push");
check("ship-gate empty: push passes", r.code === 0 && r.err === "");

// 2. Activation writes the contract.
r = say(p, "$golang-decompose break up this repo");
check("activation injects the contract", /DECOMPOSE CONTRACT ACTIVE/.test(ctxOf(r) || ""), ctxOf(r));
let st = readJSON(stateFile(p));
check("state written: started_at, not off", st.off === undefined && typeof st.started_at === "string", JSON.stringify(st));
check("sdd gitignore written", fs.readFileSync(path.join(p, ".superpowers", "sdd", ".gitignore"), "utf8").includes("*"));

// 3. Stop while planning (no ledger) is allowed.
r = run("stop", { cwd: p });
check("stop invoked, no ledger: allowed", silent(r), r.err);

// 4. `off` leaves the marker the gates honour.
r = say(p, "$golang-decompose off");
check("off injects CONTRACT OFF", /DECOMPOSE CONTRACT OFF/.test(ctxOf(r) || ""), ctxOf(r));
check("off leaves its marker", readJSON(stateFile(p)).off === true);

// 5. The representative prompt arms the contract; a file name does not.
p = project("named");
r = say(p, "Use golang-decompose shop: break it up into modules or components");
check("the representative prompt arms the contract", /DECOMPOSE CONTRACT ACTIVE/.test(ctxOf(r) || "") && fs.existsSync(stateFile(p)), ctxOf(r));
r = say(p, "the golang-decompose-hooks.cjs file changed");
check("a file name is not the skill", silent(r), r.out);
p = project("case");
r = say(p, "run $GOLANG-DECOMPOSE here");
check("case-insensitive activation writes state", fs.existsSync(stateFile(p)));
r = say(p, "GOLANG-DECOMPOSE off, please");
check("`off` without a sigil releases", readJSON(stateFile(p)).off === true);

// 6. Map approval: the carve-start reminder, once a ledger is opened.
p = project("approval");
activate(p);
r = run("tool-use", { cwd: p, stdin: {} });
check("map approval before the ledger is opened: silent", silent(r), r.out);
ledger(p, "map", { "survey:structure": agent("done", 4) });
r = run("tool-use", { cwd: p, stdin: {} });
check("map approval injects the carve-start reminder", /map approved/.test(ctxOf(r) || ""), ctxOf(r));
st = readJSON(stateFile(p));
check("map approval writes nothing to state", !("phase" in st) && !("approved_at" in st), JSON.stringify(st));
p = project("nocontract");
r = run("tool-use", { cwd: p, stdin: {} });
check("map approval without a contract: silent", silent(r));

// 7. A ledger before `carve` is not armed.
p = project("map");
activate(p);
ledger(p, "map", { "survey:structure": agent("active", 1) });
r = gate(p, "git push");
check("phase map: push passes", r.code === 0 && r.err === "");
r = run("stop", { cwd: p });
check("phase map: stop passes", r.code === 0 && r.err === "");

// 8. Armed, an agent in flight.
p = project("armed");
activate(p);
ledger(p, "carve", { "carve:user": agent("active", 1), "docker:base": agent("pending") });
r = run("stop", { cwd: p });
check("stop armed: blocked, names the agents", r.code === 2 && /carve:user/.test(r.err) && /docker:base/.test(r.err), r.err);
for (const cmd of [
  "git push",
  "git push -u origin decompose/shop",
  "git -C ../int push",
  "gh pr create --fill",
  "gh pr merge 7",
  "git merge decompose/shop",
  "git merge --no-ff main",
  "git rebase main",
  "git -C ../int merge decompose/shop",
  "cd ../int && git merge decompose/shop",
  "git merge carve/user && git merge main",
]) {
  r = gate(p, cmd);
  check(`ship-gate denies: ${cmd}`, r.code === 2 && /DECOMPOSE ship-gate/.test(r.err), `code=${r.code}`);
}
for (const cmd of ["git commit -m x", "git merge carve/user", "git -C ../w merge carve/user", "git worktree add ../w-user carve/user", "go test ./...", "git checkout main"]) {
  r = gate(p, cmd);
  check(`ship-gate allows: ${cmd}`, r.code === 0 && r.err === "", r.err);
}
r = gate(p, "git merge carve/main-feature");
check("ship-gate allows a domain branch that contains the default branch's name", r.code === 0 && r.err === "", r.err);

// 9. `off` releases an armed carve until the skill is named again.
say(p, "$golang-decompose off");
check("off on an armed carve leaves its marker", readJSON(stateFile(p)).off === true);
r = gate(p, "git push");
check("off: push passes", r.code === 0 && r.err === "", r.err);
r = run("stop", { cwd: p });
check("off: stop silent", silent(r), r.err);
r = run("session-start", { cwd: p });
check("off: session-start silent", silent(r), r.out);
r = run("tool-use", { cwd: p, stdin: {} });
check("off: no carve-start reminder", silent(r), r.out);
say(p, "use $golang-decompose again");
r = gate(p, "git push");
check("named again: the gate re-arms", r.code === 2, `code=${r.code}`);

// 10. A new session recovers the map.
r = run("session-start", { cwd: p });
const rec = ctxOf(r) || "";
check(
  "session-start lists unfinished agents with worktree and branch",
  /carve:user \(active, worktree: \.\.\/w-user, branch: carve\/user\)/.test(rec) && /shop-domains: carve/.test(rec),
  rec,
);

// 11. Only blocked agents: the stop is allowed and lists them.
p = project("blocked");
activate(p);
ledger(p, "verify", { "fix:parity": agent("blocked", 2), "carve:user": agent("done", 1) });
r = run("stop", { cwd: p });
check("stop with only blocked agents: allowed", r.code === 0 && r.err === "", `code=${r.code}`);
check("stop lists the blocked agents", /blocked — your ruling needed: fix:parity/.test(ctxOf(r) || ""), ctxOf(r));

// 12. The full ledger every 3 completed agent runs.
p = project("display");
activate(p);
ledger(p, "carve", { "carve:user": agent("active", 2), "carve:billing": agent("pending", 1) });
r = say(p, "status?");
check(
  "display at 3 runs: one line per agent",
  /DECOMPOSE LEDGER STATUS \(after 3 agent runs\)/.test(ctxOf(r) || "") &&
    /carve:billing \(pending, runs: 1, worktree: \.\.\/w-user, branch: carve\/user\)/.test(ctxOf(r) || ""),
  ctxOf(r),
);
st = readJSON(stateFile(p));
check("display persists last_shown_run_total", st.last_shown_run_total === 1, JSON.stringify(st));
r = say(p, "and now?");
check("below the next boundary: one status line", /carve in flight: 2 agent\(s\) in flight, 0 blocked, phase carve/.test(ctxOf(r) || ""), ctxOf(r));

// 13. Release, then done.
p = project("release");
activate(p);
ledger(p, "release", { "carve:user": agent("done", 3) });
r = gate(p, "git push origin main");
check("phase release: push passes", r.code === 0 && r.err === "", r.err);
r = run("stop", { cwd: p });
check("phase release: stop silent", silent(r), r.out);
r = run("session-start", { cwd: p });
check("phase release: session-start silent", silent(r), r.out);
ledger(p, "done", { "carve:user": agent("done", 3) });
r = run("stop", { cwd: p });
check("phase done: the contract is released", /the carve is done — the contract is released/.test(ctxOf(r) || ""), ctxOf(r));
check("phase done: state cleared", !fs.existsSync(stateFile(p)));

// 14. A ledger without branch names falls back to decompose/ and main|master.
p = project("fallback");
ledger(p, "carve", { "carve:user": agent("done", 1) }, { carve_branch: undefined, default_branch: undefined });
r = gate(p, "git merge decompose/shop");
check("fallback: merge into decompose/ denied", r.code === 2, `code=${r.code}`);
r = gate(p, "git merge trunk");
check("fallback: merge into an unnamed branch passes", r.code === 0, `code=${r.code}`);

// 15. Fail open on malformed input.
r = run("stop", { cwd: p, raw: "not json" });
check("malformed stdin: silent", silent(r), `code=${r.code}`);

console.log(`\n${n - failures}/${n} passed`);
process.exit(failures ? 1 : 0);
