// sccgo-update-skills — maintain the skill families the sccgo factory loads.
// A family recorded in ~/.agents/.skill-lock.json (the vercel-labs skills CLI) is
// updated through that CLI (`npx skills update` — hash-tracked, agent symlinks
// re-wired for us); anything else falls back to raw git clone + copy into the
// canonical store. git drives the git path; PowerShell drives the file ops —
// world.run spawns raw executables, and on Windows there is no mkdir/cp on PATH
// while find.exe is the wrong find, and npx is a .cmd shim (spawn ENOENT).
//
// ponytail: no pruning — upstream-removed files linger locally; add pruning when
//   that matters. No auto-adoption: adopting (npx skills add) stays a manual,
//   one-time step — this workflow only updates.
// ponytail: impeccable/ponytail also exist as ZCode plugins; the standalone copies
//   here are what the factory reads (SKILL.md files directly), never the Skill tool.

interface SyncResult {
  family: string;
  /** "skills-cli", the upstream HEAD sha, or a short failure note. */
  head: string;
  /** golang dirs synced (samber-cc) or files in the synced dir (others). */
  units: number;
  ok: boolean;
  /** Non-empty when something degraded or the route is worth knowing. */
  note: string;
}

interface WorkflowReport {
  /** Two or three sentences answering what the run did. */
  conclusion: string;
  findings: SyncResult[];
  /** What the run checked and how. */
  verified: string[];
  /** What it did not do, and why. */
  notCovered: string[];
}

const HOME = "C:/Users/alexe";
const SCRATCH = `${HOME}/.zcode/skills-upstream`;
const SKILLS = `${HOME}/.agents/skills`;
/** The samber-cc catalog as of 2026-11-07; update when upstream publishes more skills. */
const EXPECTED_GOLANG_DIRS = 46;

const SOURCES = [
  { name: "samber-cc", repo: "https://github.com/samber/cc-skills-golang", from: "skills", dest: "golang" },
  { name: "impeccable", repo: "https://github.com/pbakaus/impeccable", from: "plugin/skills/impeccable", dest: "impeccable" },
  { name: "ponytail", repo: "https://github.com/DietrichGebert/ponytail", from: "skills/ponytail", dest: "ponytail" },
  { name: "hallmark", repo: "https://github.com/Nutlope/hallmark", from: "skills/hallmark", dest: "hallmark" },
];

function lines(out: string): string[] {
  return out.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
}

/** Copy-merge every golang-* dir of the samber clone into the store; prints COPIED <dirs>. */
function golangCopyScript(clone: string): string {
  return `$ErrorActionPreference = 'Stop'
try {
  $dst = '${SKILLS}'
  $dirs = @(Get-ChildItem -LiteralPath '${clone}/skills' -Directory -Filter 'golang-*')
  foreach ($d in $dirs) {
    $t = Join-Path $dst $d.Name
    New-Item -ItemType Directory -Force -Path $t | Out-Null
    Copy-Item -Path (Join-Path $d.FullName '*') -Destination $t -Recurse -Force
  }
  "COPIED $($dirs.Count)"
} catch {
  "ERROR $($_.Exception.Message)"
  exit 1
}`;
}

/** Copy-merge one skill dir into the store; prints COPIED <files>. */
function oneCopyScript(from: string, to: string): string {
  return `$ErrorActionPreference = 'Stop'
try {
  New-Item -ItemType Directory -Force -Path '${to}' | Out-Null
  Copy-Item -Path '${from}/*' -Destination '${to}' -Recurse -Force
  "COPIED $((Get-ChildItem -LiteralPath '${to}' -Recurse -File).Count)"
} catch {
  "ERROR $($_.Exception.Message)"
  exit 1
}`;
}

/** Count golang dirs and check each synced skill's SKILL.md. */
function verifyScript(): string {
  return `$g = @(Get-ChildItem -LiteralPath '${SKILLS}' -Directory -Filter 'golang-*')
"GOLANG_DIRS $($g.Count)"
foreach ($n in @('impeccable','ponytail','hallmark')) {
  "SKILL $n $(Test-Path -LiteralPath ('${SKILLS}/' + $n + '/SKILL.md'))"
}`;
}

phase("Update adopted families via the skills CLI, git for the rest");
const lockRead = await world.run("powershell", ["-NoProfile", "-NonInteractive", "-Command",
  `$l = Get-Content -Raw -LiteralPath '${HOME}/.agents/.skill-lock.json' | ConvertFrom-Json
$l.skills.PSObject.Properties.Name | ForEach-Object { "TRACKED $_" }`]);
const tracked = new Set(
  lines(lockRead.stdout)
    .filter((l) => l.startsWith("TRACKED "))
    .map((l) => l.slice("TRACKED ".length).trim()),
);

const synced: SyncResult[] = [];
for (const src of SOURCES) {
  // The route decision: a family rides the CLI only when FULLY lock-tracked —
  // no mixed sync. Skill names for the update come straight from the lock.
  const names = src.dest === "golang"
    ? [...tracked].filter((n) => n.startsWith("golang-")).sort()
    : tracked.has(src.dest) ? [src.dest] : [];
  const expected = src.dest === "golang" ? EXPECTED_GOLANG_DIRS : 1;
  const adoptCmd = `npx skills add ${src.repo.replace("https://github.com/", "")} -s '${src.dest === "golang" ? "*" : src.dest}' -g -a zcode -a claude-code -y`;
  let gitNote = "";
  if (names.length !== expected) {
    gitNote = `not fully CLI-tracked (${names.length}/${expected}) — synced via git; adopt: ${adoptCmd}. `;
    log(`${src.name}: ${gitNote}`);
  }

  if (names.length === expected) {
    const upd = await world.run("powershell", ["-NoProfile", "-NonInteractive", "-Command",
      `npx -y skills update ${names.join(" ")} -g -y`], { timeoutMs: 600000, output: { tail: 4096 } });
    if (upd.exitCode === 0) {
      const result: SyncResult = { family: src.name, head: "skills-cli", units: names.length, ok: true, note: "updated via npx skills CLI" };
      synced.push(result);
      report(result);
      continue;
    }
    gitNote = `npx skills update failed (exit ${upd.exitCode}: ${upd.stderr.slice(-200)}) — synced via git. `;
    log(`${src.name}: ${gitNote}`);
  }

  // Git fallback: clone/pull the upstream, copy-merge into the store.
  const dir = `${SCRATCH}/${src.name}`;
  let head = await world.run("git", ["-C", dir, "rev-parse", "HEAD"]);
  let staleNote = "";
  if (head.exitCode !== 0) {
    log(`Cloning ${src.repo} into ${dir}`);
    const cloned = await world.run("git", ["clone", "--depth", "1", src.repo, dir], { output: { tail: 4096 } });
    if (cloned.exitCode !== 0) {
      report({ family: src.name, head: "clone failed", units: 0, ok: false, note: cloned.stderr.slice(-500) });
      continue;
    }
  } else {
    const pulled = await world.run("git", ["-C", dir, "pull", "--ff-only"], { output: { tail: 4096 } });
    if (pulled.exitCode !== 0) {
      staleNote = `pull failed — syncing the STALE clone; delete ${dir} to force a re-clone. ${pulled.stderr.slice(-300)}`;
      log(`${src.name}: ${staleNote}`);
    }
  }
  head = await world.run("git", ["-C", dir, "rev-parse", "HEAD"]);
  const sha = head.stdout.trim();

  const ps = src.dest === "golang" ? golangCopyScript(dir) : oneCopyScript(`${dir}/${src.from}`, `${SKILLS}/${src.dest}`);
  const copied = await world.run("powershell", ["-NoProfile", "-NonInteractive", "-Command", ps], { output: { tail: 4096 } });
  const out = lines(copied.stdout).join(" ");
  if (copied.exitCode !== 0 || out.includes("ERROR")) {
    report({ family: src.name, head: sha, units: 0, ok: false, note: out.slice(-500) });
    continue;
  }
  const parsed = Number(out.replace("COPIED ", "").trim());
  const result: SyncResult = {
    family: src.name,
    head: sha,
    units: Number.isFinite(parsed) ? parsed : 0,
    ok: true,
    note: (gitNote + staleNote + (Number.isFinite(parsed) ? "" : `COPIED count unparsable: ${out.slice(-200)}`)).trim(),
  };
  synced.push(result);
  report(result);
}

phase("Verify the synced catalog");
const ver = await world.run("powershell", ["-NoProfile", "-NonInteractive", "-Command", verifyScript()]);
let dirCount = -1;
const failures: SyncResult[] = [];
for (const line of lines(ver.stdout)) {
  if (line.startsWith("GOLANG_DIRS ")) dirCount = Number(line.slice("GOLANG_DIRS ".length).trim());
  if (line.startsWith("SKILL ") && line.endsWith(" False")) {
    failures.push({ family: line.split(" ")[1], head: "", units: 0, ok: false, note: "SKILL.md missing after sync" });
  }
}
if (dirCount !== EXPECTED_GOLANG_DIRS) {
  failures.push({
    family: "samber-cc",
    head: "",
    units: dirCount,
    ok: false,
    note: `expected ${EXPECTED_GOLANG_DIRS} golang-* dirs in the store, found ${dirCount} — if upstream grew, update EXPECTED_GOLANG_DIRS`,
  });
}

const cliCount = synced.filter((r) => r.note.includes("skills CLI")).length;
return {
  conclusion: `Synced ${synced.filter((r) => r.ok).length} of ${SOURCES.length} skill families (${cliCount} via the npx skills CLI, the rest via git); the store holds ${dirCount} golang-* samber-cc skills.`,
  findings: [...synced, ...failures],
  verified: [
    "the .skill-lock.json tracked set read once via PowerShell ConvertFrom-Json",
    "upstream HEAD sha recorded per git-synced family via git rev-parse",
    `golang-* dir count in the store checked via PowerShell Get-ChildItem (expected ${EXPECTED_GOLANG_DIRS})`,
    "SKILL.md presence checked for impeccable, ponytail, hallmark via Test-Path",
  ],
  notCovered: [
    "no pruning: files removed upstream stay in the store",
    "skill content not reviewed — an upstream copy, not a curation pass",
    "legacy copies under ~/.claude/skills left untouched",
  ],
};
