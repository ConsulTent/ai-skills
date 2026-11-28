#!/usr/bin/env node
// Fixture test for init-hooks.cjs — one state machine over fixture dirs.
// Run: node plugins/golang-project-init/hooks/init-hooks.test.cjs
const { spawnSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const HOOK = path.join(__dirname, "init-hooks.cjs");
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
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `init-hook-${name}-`));
  fs.mkdirSync(path.join(dir, ".superpowers", "sdd"), { recursive: true });
  return dir;
}
function readJSON(p) { return JSON.parse(fs.readFileSync(p, "utf8")); }
function ctxOf(r) {
  try { return JSON.parse(r.out).hookSpecificOutput.additionalContext || ""; }
  catch (e) { return null; }
}
const stateFile = (p) => path.join(p, ".superpowers", "sdd", "golang-project-init-session.json");
const silent = (r) => r.code === 0 && r.out === "" && r.err === "";
const say = (p, prompt) => run("prompt-submit", { cwd: p, stdin: { prompt } });
const activate = (p) => say(p, "$golang-project-init");
const gate = (p, command) => run("pretool-use", { cwd: p, stdin: { tool_input: { command } } });
// A scaffold half written: one package done, one being written, the two non-package units untouched.
const halfWritten = () => ({
  "internal/orders/model": { status: "done" },
  "internal/orders/repository": { status: "active" },
  "repo-files": { status: "pending" },
  docs: { status: "pending" },
});
function ledger(p, phase, units, extra = {}) {
  const dir = path.join(p, ".superpowers", "sdd", "orders");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, "INIT_LEDGER.json"),
    JSON.stringify(Object.assign({ plan: "docs/plan.md", phase, default_branch: "main", init_branch: "init/orders", units }, extra)),
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
r = say(p, "$golang-project-init scaffold this project");
check("activation injects the contract", /INIT CONTRACT ACTIVE/.test(ctxOf(r) || ""), ctxOf(r));
let st = readJSON(stateFile(p));
check("state written: started_at, not off", st.off === undefined && typeof st.started_at === "string", JSON.stringify(st));
check("sdd gitignore written", fs.readFileSync(path.join(p, ".superpowers", "sdd", ".gitignore"), "utf8").includes("*"));
r = say(p, "and how is it going?");
check("no ledger: later prompts stay silent", silent(r), r.out);

// 3. Stop while planning (no ledger) is allowed.
r = run("stop", { cwd: p });
check("stop invoked, no ledger: allowed", silent(r), r.err);

// 4. `off` leaves the marker the gates honour.
r = say(p, "$golang-project-init off");
check("off injects CONTRACT OFF", /INIT CONTRACT OFF/.test(ctxOf(r) || ""), ctxOf(r));
check("off leaves its marker", readJSON(stateFile(p)).off === true);

// 5. The representative prompt arms the contract; a file name does not.
p = project("named");
r = say(p, "Use golang-project-init orders: scaffold it from the plan at docs/plan.md");
check("the representative prompt arms the contract", /INIT CONTRACT ACTIVE/.test(ctxOf(r) || "") && fs.existsSync(stateFile(p)), ctxOf(r));
r = say(p, "the init-hooks.cjs file changed");
check("a file name is not the skill", silent(r), r.out);
p = project("case");
r = say(p, "run $GOLANG-PROJECT-INIT here");
check("case-insensitive activation writes state", fs.existsSync(stateFile(p)));
r = say(p, "GOLANG-PROJECT-INIT off, please");
check("`off` without a sigil releases", readJSON(stateFile(p)).off === true);

// 6. Armed, a package half written.
p = project("armed");
activate(p);
ledger(p, "scaffold", halfWritten());
r = run("stop", { cwd: p });
check(
  "stop armed: blocked, names every unfinished unit",
  r.code === 2 && /internal\/orders\/repository/.test(r.err) && /repo-files/.test(r.err) && /docs/.test(r.err) && !/model/.test(r.err),
  r.err,
);
for (const cmd of [
  "git push",
  "git push -u origin init/orders",
  "git -C ../x push",
  "gh pr create --fill",
  "gh pr merge 7",
  "git merge init/orders",
  "git merge --no-ff main",
  "git rebase main",
  "git checkout main && git merge init/orders",
]) {
  r = gate(p, cmd);
  check(`ship-gate denies: ${cmd}`, r.code === 2 && /INIT ship-gate/.test(r.err), `code=${r.code}`);
}
for (const cmd of ["git commit -m x", "git switch -c init/orders", "git add -A", "git merge feature/fix", "go test ./..."]) {
  r = gate(p, cmd);
  check(`ship-gate allows: ${cmd}`, r.code === 0 && r.err === "", r.err);
}

// 7. A new session recovers the map.
r = run("session-start", { cwd: p });
const rec = ctxOf(r) || "";
check(
  "session-start lists unfinished units with their status and the branch",
  /branch init\/orders/.test(rec) && /- internal\/orders\/repository \(active\)/.test(rec) && /- docs \(pending\)/.test(rec) && !/model/.test(rec),
  rec,
);

// 8. Only blocked units: the stop is allowed and lists them.
p = project("blocked");
activate(p);
ledger(p, "scaffold", { "internal/orders/repository": { status: "blocked" }, "internal/orders/model": { status: "done" } });
r = run("stop", { cwd: p });
check("stop with only blocked units: allowed", r.code === 0 && r.err === "", `code=${r.code}`);
check("stop lists the blocked units", /blocked — the operator's answer is needed: internal\/orders\/repository/.test(ctxOf(r) || ""), ctxOf(r));

// 9. `verify` is armed too; `off` releases until the skill is named again.
ledger(p, "verify", { "internal/orders/model": { status: "done" } });
r = gate(p, "git push");
check("phase verify: push denied", r.code === 2, `code=${r.code}`);
say(p, "$golang-project-init off");
r = gate(p, "git push");
check("off: push passes", r.code === 0 && r.err === "", r.err);
r = run("stop", { cwd: p });
check("off: stop silent", silent(r), r.err);
r = run("session-start", { cwd: p });
check("off: session-start silent", silent(r), r.out);
say(p, "use $golang-project-init again");
r = gate(p, "git push");
check("named again: the gate re-arms", r.code === 2, `code=${r.code}`);

// 10. `done` releases and ends the contract.
ledger(p, "done", { "internal/orders/model": { status: "done" } });
r = gate(p, "git push origin main");
check("phase done: push passes", r.code === 0 && r.err === "", r.err);
r = run("stop", { cwd: p });
check("phase done: the contract is released", /the scaffold is done — the contract is released/.test(ctxOf(r) || ""), ctxOf(r));
check("phase done: state cleared", !fs.existsSync(stateFile(p)));
r = run("session-start", { cwd: p });
check("phase done: session-start silent", silent(r), r.out);

// 11. A ledger without branch names falls back to init/ and main|master.
p = project("fallback");
ledger(p, "scaffold", { docs: { status: "pending" } }, { init_branch: undefined, default_branch: undefined });
r = gate(p, "git merge init/orders");
check("fallback: merge into init/ denied", r.code === 2, `code=${r.code}`);
r = gate(p, "git merge main");
check("fallback: merge into main denied", r.code === 2, `code=${r.code}`);
r = gate(p, "git merge trunk");
check("fallback: merge into an unnamed branch passes", r.code === 0, `code=${r.code}`);

// 12. Fail open on malformed input.
p = project("malformed");
r = run("stop", { cwd: p, raw: "not json" });
check("malformed stdin: silent", silent(r), `code=${r.code}`);
r = run("pretool-use", { cwd: p, raw: "not json" });
check("malformed stdin: ship-gate passes", r.code === 0 && r.err === "", `code=${r.code}`);

console.log(`\n${n - failures}/${n} passed`);
process.exit(failures ? 1 : 0);
