const assert = require("node:assert/strict");
const test = require("node:test");

const { validatePullRequest } = require("../scripts/validate-pr");

const validBody = `## Summary

Adds a governance workflow for pull requests.

## Why

Keeps reviews consistent and makes release risk visible.

## Changes

- Adds CI checks
- Adds PR validation

## Testing

- npm --prefix proposal-pilot run lint
- npm --prefix proposal-pilot run typecheck

## Risk and Rollback

Low risk. Revert the workflow files if checks block an emergency fix.

## Checklist

- [x] PR title uses Conventional Commits, for example \`feat: add proposal review queue\`
- [x] Tests or checks were run locally, or an explanation is included above
- [x] No secrets, credentials, or sensitive customer data are included
- [x] Documentation, environment variables, and migrations are updated or marked not needed
`;

test("accepts a complete PR body with a conventional title", () => {
  const errors = validatePullRequest({
    title: "ci: add github quality gates",
    body: validBody,
  });

  assert.deepEqual(errors, []);
});

test("rejects non-conventional titles", () => {
  const errors = validatePullRequest({
    title: "Add github quality gates",
    body: validBody,
  });

  assert.match(errors.join("\n"), /Conventional Commits/);
});

test("rejects missing required sections", () => {
  const errors = validatePullRequest({
    title: "ci: add github quality gates",
    body: validBody.replace("## Risk and Rollback", "## Risk"),
  });

  assert.match(errors.join("\n"), /Missing required section: ## Risk and Rollback/);
});

test("rejects empty template-only content", () => {
  const errors = validatePullRequest({
    title: "ci: add github quality gates",
    body: validBody.replace(
      "Keeps reviews consistent and makes release risk visible.",
      "<!-- Explain why this matters. -->"
    ),
  });

  assert.match(errors.join("\n"), /Section ## Why must be filled in/);
});

test("rejects unchecked checklist items", () => {
  const errors = validatePullRequest({
    title: "ci: add github quality gates",
    body: validBody.replace("- [x] No secrets", "- [ ] No secrets"),
  });

  assert.match(errors.join("\n"), /All PR checklist items must be checked/);
});

test("skips draft pull requests", () => {
  const errors = validatePullRequest({
    title: "WIP",
    body: "",
    draft: true,
  });

  assert.deepEqual(errors, []);
});
