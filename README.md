# ConsulTent ai-skills

AI agent skills from [ConsulTent Pte. Ltd.](https://consultent.ltd) — installable as a
Claude Code plugin, a ZCode plugin, or copied into any agent that supports the
[SKILL.md](https://code.claude.com/docs/en/plugins) convention.

## Skills

| Skill | What it does |
|---|---|
| `homebrew-publishing` | Publish, update, or debug Homebrew packages: taps, formula authoring (Go CLIs and others), tap CI with `brew test-bot`, version bumps, homebrew-core eligibility and submission, the AI/LLM disclosure policy |

## Install

### Claude Code

```
/plugin marketplace add ConsulTent/ai-skills
/plugin install ai-skills@consultent-ai-skills
```

### ZCode

Settings → Plugin Management → Discover → **+** → paste
`https://github.com/ConsulTent/ai-skills` → add the marketplace → install **ai-skills**.

### Generic agents

Copy `plugins/ai-skills/skills/*` into your agent's skills directory (for example
`~/.agents/skills/`). Each skill is a folder with a `SKILL.md` and optional
`references/` — no runtime or manifests required.

## Contributing

Skills must be generic: no project-specific paths, credentials, or environment
assumptions — placeholder names (`OWNER/REPO`) and portable commands only.

## License

[MIT](LICENSE) — Copyright (c) 2026 ConsulTent Pte. Ltd.
