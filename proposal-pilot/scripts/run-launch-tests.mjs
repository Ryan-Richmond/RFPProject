import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import ts from "typescript";

const require = createRequire(import.meta.url);
const root = resolve(dirname(new URL(import.meta.url).pathname), "..");
const moduleCache = new Map();

function loadTs(relativePath) {
  const filename = resolve(root, relativePath);
  if (moduleCache.has(filename)) return moduleCache.get(filename).exports;

  const source = readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;

  const cjsModule = { exports: {} };
  moduleCache.set(filename, cjsModule);

  function localRequire(specifier) {
    if (specifier.startsWith("./") || specifier.startsWith("../")) {
      const target = resolve(dirname(filename), specifier);
      return loadTs(target.startsWith(root) ? target.slice(root.length + 1) : target);
    }
    if (specifier.startsWith("@/")) {
      return loadTs(`src/${specifier.slice(2)}.ts`);
    }
    return require(specifier);
  }

  const fn = new Function("require", "module", "exports", "__filename", "__dirname", output);
  fn(localRequire, cjsModule, cjsModule.exports, filename, dirname(filename));
  return cjsModule.exports;
}

const {
  computeOnboardingReadinessSnapshot,
} = loadTs("src/services/onboarding/readiness-core.ts");
const {
  parseLegacyProposalArtifactsFromResponse,
} = loadTs("src/services/knowledge-base/legacy-proposal.ts");
const {
  buildSamEntityRequestUrl,
  normalizeEntityPayload,
} = loadTs("src/services/onboarding/sam-entity-core.ts");
const { getMockAgentResponse } = loadTs("src/lib/ai/mock.ts");

const now = new Date("2026-05-26T12:00:00Z");
const fresh = "2026-05-20T12:00:00Z";
const stale = "2024-01-01T12:00:00Z";
const completeProfile = {
  company_name: "Northstar Digital Services",
  business_description:
    "Northstar delivers secure cloud modernization, DevSecOps, cybersecurity, and data analytics services for federal mission systems.",
  core_capabilities: ["Cloud Migration", "Cybersecurity", "DevSecOps"],
  naics_codes: ["541512"],
  certifications: ["Small Business"],
};

const tests = [];
function test(name, fn) {
  tests.push({ name, fn });
}

function readiness(overrides = {}) {
  return computeOnboardingReadinessSnapshot({
    profile: null,
    latestResearch: null,
    chunks: [],
    proposals: [],
    requirements: [],
    now,
    ...overrides,
  });
}

test("empty workspace starts at public baseline", () => {
  const result = readiness();
  assert.equal(result.currentRung, "public_baseline");
  assert.equal(result.nextAction.kind, "run_public_research");
  assert.equal(result.goodEnoughToStart, false);
});

test("public baseline alone stays non-citable and does not satisfy minimum evidence", () => {
  const result = readiness({
    latestResearch: {
      id: "research-1",
      status: "complete",
      trust_level: "public_unverified",
    },
    chunks: [
      {
        artifact_type: "past_performance",
        category: "past_performance",
        trust_level: "public_unverified",
        created_at: fresh,
      },
    ],
  });
  assert.equal(result.publicBaseline.status, "complete");
  assert.equal(result.evidence.totalChunks, 0);
  assert.equal(result.evidence.minimumReady, false);
});

test("complete profile without documents points to minimum evidence upload", () => {
  const result = readiness({ profile: completeProfile });
  assert.equal(result.currentRung, "minimum_evidence");
  assert.equal(result.nextAction.kind, "upload_minimum_evidence");
});

test("fresh minimum evidence unlocks good enough status", () => {
  const result = readiness({
    profile: completeProfile,
    chunks: [
      { artifact_type: "capability_statement", category: "corporate_overview", trust_level: "user_verified", created_at: fresh },
      { artifact_type: "past_performance", category: "past_performance", trust_level: "user_verified", created_at: fresh },
      { artifact_type: "key_personnel", category: "key_personnel", trust_level: "user_verified", created_at: fresh },
    ],
  });
  assert.equal(result.evidence.minimumReady, true);
  assert.equal(result.goodEnoughToStart, true);
  assert.equal(result.nextAction.kind, "discover_opportunities");
});

test("stale minimum evidence is visible but not ready", () => {
  const result = readiness({
    profile: completeProfile,
    chunks: [
      { artifact_type: "capability_statement", category: "corporate_overview", trust_level: "user_verified", created_at: stale },
      { artifact_type: "past_performance", category: "past_performance", trust_level: "user_verified", created_at: stale },
      { artifact_type: "key_personnel", category: "key_personnel", trust_level: "user_verified", created_at: stale },
    ],
  });
  assert.equal(result.evidence.minimumReady, false);
  assert.equal(result.nextAction.kind, "upload_minimum_evidence");
  assert.equal(result.evidence.items.filter((item) => item.stale).length >= 3, true);
});

test("analyzed RFP gaps move the ladder to RFP-specific gaps", () => {
  const result = readiness({
    profile: completeProfile,
    chunks: [
      { artifact_type: "capability_statement", category: "corporate_overview", trust_level: "user_verified", created_at: fresh },
      { artifact_type: "past_performance", category: "past_performance", trust_level: "user_verified", created_at: fresh },
      { artifact_type: "key_personnel", category: "key_personnel", trust_level: "user_verified", created_at: fresh },
    ],
    proposals: [{ id: "proposal-1", solicitation_id: "sol-1", solicitationTitle: "Cloud RFP" }],
    requirements: [
      { solicitation_id: "sol-1", category: "technical", readiness_score: "red" },
      { solicitation_id: "sol-1", category: "compliance", readiness_score: "yellow" },
    ],
  });
  assert.equal(result.currentRung, "rfp_specific_gaps");
  assert.equal(result.nextAction.kind, "fill_rfp_gaps");
  assert.deepEqual(result.activeProposalGap?.categories.sort(), ["compliance", "technical"]);
  assert.equal(
    result.evidence.items.some((item) => item.id === "cybersecurity_posture" && item.neededForCurrentRfp),
    true
  );
});

test("mock public research returns cited, applyable profile suggestions", () => {
  const response = getMockAgentResponse({
    input: "Research this government contractor: Northstar Digital Services",
  });
  const payload = JSON.parse(response.outputText);
  assert.equal(response.citations.length > 0, true);
  assert.equal(payload.suggestions.core_capabilities.length >= 3, true);
  assert.equal(payload.suggestions.naics_codes[0].code, "541512");
});

test("legacy proposal mock extracts five-plus readiness artifacts", () => {
  const response = getMockAgentResponse({
    input: "Extract reusable proposal evidence sections from this legacy proposal.",
  });
  const artifacts = parseLegacyProposalArtifactsFromResponse(response.outputText);
  assert.equal(artifacts.length >= 5, true);
  assert.equal(new Set(artifacts.map((artifact) => artifact.artifact_type)).has("past_performance"), true);

  const result = readiness({
    profile: completeProfile,
    chunks: artifacts.map((artifact) => ({
      artifact_type: artifact.artifact_type,
      category: artifact.category,
      trust_level: "user_verified",
      created_at: fresh,
    })),
  });
  assert.equal(result.evidence.items.filter((item) => item.ready).length >= 5, true);
});

test("SAM entity helper builds public GET URL and normalizes entity payload", () => {
  const url = buildSamEntityRequestUrl({ uei: "RV56IG5JM6G9" }, "test-key");
  assert.equal(url.startsWith("https://api.sam.gov/entity-information/v2/entities?"), true);
  assert.equal(url.includes("ueiSAM=RV56IG5JM6G9"), true);
  assert.equal(url.includes("includeSections="), true);

  const normalized = normalizeEntityPayload(
    {
      entityData: [
        {
          entityRegistration: {
            legalBusinessName: "Example Federal LLC",
            ueiSAM: "RV56IG5JM6G9",
            cageCode: "00000",
          },
          assertions: {
            goodsAndServices: {
              primaryNaics: "541512",
              naicsList: [{ naicsCode: "541519" }],
            },
            businessTypes: [{ businessTypeDesc: "Small Business" }],
          },
        },
      ],
    },
    { uei: "RV56IG5JM6G9" }
  );
  assert.equal(normalized?.legalName, "Example Federal LLC");
  assert.deepEqual(normalized?.suggestions.naics_codes?.map((item) => item.code), ["541512", "541519"]);
  assert.equal(normalized?.suggestions.certifications?.[0].value, "Small Business");
});

let failed = 0;
for (const { name, fn } of tests) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`not ok - ${name}`);
    console.error(error);
  }
}

if (failed > 0) {
  process.exitCode = 1;
} else {
  console.log(`\n${tests.length} launch tests passed.`);
}
