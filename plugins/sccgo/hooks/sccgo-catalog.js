// The samber-cc golang catalog as of 2026-11-08 — the full-mode seed inventory.
// EXPECTED 46 — keep in sync with the SKILL.md battery and vendor/cc-skills-golang.
// shortcut: the installed plugin cache ships vendor submodules unpopulated, so the
// hook cannot read the catalog at runtime; upstream growth syncs manually here
// until a machine-readable catalog exists.
const CATALOG = [
  "golang-benchmark",
  "golang-cli",
  "golang-code-style",
  "golang-concurrency",
  "golang-context",
  "golang-continuous-integration",
  "golang-data-structures",
  "golang-database",
  "golang-dependency-injection",
  "golang-dependency-management",
  "golang-design-patterns",
  "golang-documentation",
  "golang-error-handling",
  "golang-google-wire",
  "golang-gopls",
  "golang-graphql",
  "golang-grpc",
  "golang-how-to",
  "golang-lint",
  "golang-modernize",
  "golang-naming",
  "golang-observability",
  "golang-performance",
  "golang-pkg-go-dev",
  "golang-popular-libraries",
  "golang-project-layout",
  "golang-refactoring",
  "golang-safety",
  "golang-samber-do",
  "golang-samber-hot",
  "golang-samber-lo",
  "golang-samber-mo",
  "golang-samber-oops",
  "golang-samber-ro",
  "golang-samber-slog",
  "golang-security",
  "golang-spf13-cobra",
  "golang-spf13-viper",
  "golang-stay-updated",
  "golang-stretchr-testify",
  "golang-structs-interfaces",
  "golang-swagger",
  "golang-testing",
  "golang-troubleshooting",
  "golang-uber-dig",
  "golang-uber-fx",
];

// Orchestrator, never seeded as its own review run (SKILL.md battery).
const SEED_EXCLUDE = ["golang-how-to"];

module.exports = { CATALOG, SEED_EXCLUDE };
