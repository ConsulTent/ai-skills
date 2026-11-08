// The official Flutter/Dart skills catalog as of 2026-11-08 — the full-mode seed
// inventory. EXPECTED 25 — keep in sync with the SKILL.md battery and
// vendor/agent-plugins + vendor/dart-skills.
// shortcut: the installed plugin cache ships vendor submodules unpopulated, so the
// hook cannot read the catalog at runtime; upstream growth syncs manually here
// until a machine-readable catalog exists.
const CATALOG = [
  "flutter-add-integration-test",
  "flutter-add-widget-preview",
  "flutter-add-widget-test",
  "flutter-apply-architecture-best-practices",
  "flutter-build-responsive-layout",
  "flutter-fix-layout-issues",
  "flutter-implement-json-serialization",
  "flutter-setup-declarative-routing",
  "flutter-setup-localization",
  "flutter-use-http-package",
  "dart-add-unit-test",
  "dart-build-cli-app",
  "dart-collect-coverage",
  "dart-fix-runtime-errors",
  "dart-generate-test-mocks",
  "dart-migrate-to-checks-package",
  "dart-resolve-package-conflicts",
  "dart-run-static-analysis",
  "dart-setup-ffi-assets",
  "dart-use-doc-examples",
  "dart-use-ffigen",
  "dart-use-path-package",
  "dart-use-pattern-matching",
  "dart-use-primary-constructors",
  "dart-write-documentation",
];

// No orchestrator upstream — nothing excluded from the seed.
const SEED_EXCLUDE = [];

module.exports = { CATALOG, SEED_EXCLUDE };
