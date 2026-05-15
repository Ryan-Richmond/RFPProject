#!/usr/bin/env node

const fs = require("node:fs");

const CONVENTIONAL_TITLE =
  /^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\([a-z0-9._-]+\))?!?: .{8,}$/i;

const REQUIRED_SECTIONS = [
  "Summary",
  "Why",
  "Changes",
  "Testing",
  "Risk and Rollback",
  "Checklist",
];

const PLACEHOLDER_PATTERNS = [
  /<!--[\s\S]*?-->/g,
  /\b(tbd|todo|placeholder)\b/i,
  /^\s*n\/a\s*$/i,
];

function sectionPattern(section) {
  return new RegExp(`^##\\s+${escapeRegExp(section)}\\s*$`, "im");
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractSection(body, section, allSections = REQUIRED_SECTIONS) {
  const startMatch = body.match(sectionPattern(section));
  if (!startMatch || startMatch.index === undefined) {
    return "";
  }

  const start = startMatch.index + startMatch[0].length;
  const nextStarts = allSections
    .filter((candidate) => candidate !== section)
    .map((candidate) => {
      const match = body.slice(start).match(sectionPattern(candidate));
      return match && match.index !== undefined ? start + match.index : null;
    })
    .filter((index) => index !== null);

  const end = nextStarts.length ? Math.min(...nextStarts) : body.length;
  return body.slice(start, end).trim();
}

function stripComments(value) {
  return value.replace(/<!--[\s\S]*?-->/g, "").trim();
}

function isPlaceholderOnly(value) {
  const cleaned = stripComments(value)
    .replace(/^[-*]\s*/gm, "")
    .replace(/^- \[[ xX]\]\s*.*/gm, "")
    .trim();

  if (!cleaned) {
    return true;
  }

  return PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(cleaned));
}

function uncheckedChecklistItems(body) {
  return body
    .split("\n")
    .map((line, index) => ({ line: line.trim(), number: index + 1 }))
    .filter(({ line }) => /^- \[ \]/.test(line));
}

function validatePullRequest({ title = "", body = "", draft = false }) {
  const errors = [];

  if (draft) {
    return errors;
  }

  if (!CONVENTIONAL_TITLE.test(title.trim())) {
    errors.push(
      "PR title must use Conventional Commits, for example `feat: add compliance dashboard`."
    );
  }

  for (const section of REQUIRED_SECTIONS) {
    if (!sectionPattern(section).test(body)) {
      errors.push(`Missing required section: ## ${section}`);
      continue;
    }

    const content = extractSection(body, section);
    if (section !== "Checklist" && isPlaceholderOnly(content)) {
      errors.push(`Section ## ${section} must be filled in before review.`);
    }
  }

  const unchecked = uncheckedChecklistItems(body);
  if (unchecked.length > 0) {
    errors.push(
      `All PR checklist items must be checked before review. Unchecked lines: ${unchecked
        .map(({ number }) => number)
        .join(", ")}.`
    );
  }

  return errors;
}

function validateEventFile(path) {
  const event = JSON.parse(fs.readFileSync(path, "utf8"));
  const pullRequest = event.pull_request;

  if (!pullRequest) {
    return [];
  }

  return validatePullRequest({
    title: pullRequest.title,
    body: pullRequest.body || "",
    draft: pullRequest.draft,
  });
}

function main() {
  const eventPath = process.argv[2];

  if (!eventPath) {
    console.error("Usage: validate-pr.js <github-event-path>");
    process.exit(2);
  }

  const errors = validateEventFile(eventPath);

  if (errors.length > 0) {
    console.error("PR governance checks failed:\n");
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exit(1);
  }

  console.log("PR governance checks passed.");
}

if (require.main === module) {
  main();
}

module.exports = {
  REQUIRED_SECTIONS,
  extractSection,
  uncheckedChecklistItems,
  validatePullRequest,
};
