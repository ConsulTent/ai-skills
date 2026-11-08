# ConsulTent ai-skills

AI agent skills from [ConsulTent Pte. Ltd.](https://consultent.ltd) — installable as a
Claude Code plugin, a ZCode plugin, or copied into any agent that supports the
[SKILL.md](https://code.claude.com/docs/en/plugins) convention.

## Skills

| Skill | What it does |
|---|---|
| `homebrew-publishing` | Publish, update, or debug Homebrew packages: taps, formula authoring (Go CLIs and others), tap CI with `brew test-bot`, version bumps, homebrew-core eligibility and submission, the AI/LLM disclosure policy |
| `sccgo` | **SCCGO — Software Convergence Crafting for Go.** The golang software factory: drive a golang plan from root-caused intent to a CONVERGED, reviewed state via the used-skills protocol, then hand off to SDD execution. Ships `workflows/update-skills.dwf.ts` — a ZCode dynamic workflow that syncs its skill families (samber-cc golang, impeccable, ponytail, hallmark) from their upstream git repos |
| `mobile-convergence` | The Android software factory: drive a Flutter/Dart plan from root-caused intent to a CONVERGED, reviewed state via the used-skills protocol, then hand off to SDD execution. Battery: the official 25 flutter/dart skills from [flutter/agent-plugins](https://github.com/flutter/agent-plugins) and [dart-lang/skills](https://github.com/dart-lang/skills) |

### Factory modes and vendored batteries

The sccgo plugin ships two skills: `$sccgo` (full — every samber-cc golang skill is seeded
into USED_SKILLS.json; each seeded skill's own run reports its fit) and `$sccgo-partial`
(the samber/* core runs always; the rest join as the plan's surfaces demand). Claude Code
qualifies with `:` (`sccgo:sccgo`, `sccgo:sccgo-partial`); ZCode flattens with `-`.

The mobile-convergence plugin ships the same pair for Android: `$mobile-convergence`
(full — all 25 official flutter/dart skills seeded) and `$mobile-convergence-partial`
(the flutter/* core runs always; the dart/* skills join as the plan's surfaces demand) —
`mobile-convergence:mobile-convergence` and `mobile-convergence:mobile-convergence-partial`
in Claude Code; `-` in ZCode.

The batteries' upstream repos are vendored as git submodules (`plugins/sccgo/vendor/`,
`plugins/mobile-convergence/vendor/`) — provenance reference only, not installed as plugin
skills; clone with `--recurse-submodules`. A weekly workflow
(`.github/workflows/update-3p-skills.yml`) bumps the submodule pins to upstream tips and
patch-bumps the moved plugin's version.

## Install

### Claude Code

```
/plugin marketplace add ConsulTent/ai-skills
/plugin install ai-skills@consultent-ai-skills
/plugin install sccgo@consultent-ai-skills
/plugin install mobile-convergence@consultent-ai-skills
```

### ZCode

Settings → Plugin Management → Discover → **+** → paste
`https://github.com/ConsulTent/ai-skills` → add the marketplace → install **ai-skills**,
**sccgo** and/or **mobile-convergence**.

### Generic agents

Copy `plugins/ai-skills/skills/*`, `plugins/sccgo/skills/*` and/or
`plugins/mobile-convergence/skills/*` into your agent's
skills directory (for example `~/.agents/skills/`). Each skill is a folder with a
`SKILL.md` and optional `references/` — no runtime or manifests required.

### npx skills (any agent)

```
npx skills add ConsulTent/ai-skills -s homebrew-publishing -g -a <agent> -y
```

The [skills CLI](https://github.com/vercel-labs/skills) indexes the repo's first `skills/`
directory, which covers `homebrew-publishing`. `sccgo` sits one plugin deeper than the scan
reaches — add it from a local clone:

```
git clone https://github.com/ConsulTent/ai-skills && npx skills add ./ai-skills/plugins/sccgo/skills/sccgo -g -a <agent> -y
```

Pick your agent(s) with `-a` (`zcode`, `claude-code`, …); drop `-g` to install project-local.

## Contributing

Skills must be generic: no project-specific paths, credentials, or environment
assumptions — placeholder names (`OWNER/REPO`) and portable commands only.

## License

[MIT](LICENSE) — Copyright (c) 2026 ConsulTent Pte. Ltd.
