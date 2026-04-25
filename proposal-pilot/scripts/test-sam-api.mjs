/**
 * SAM.gov API Key Smoke Test
 * Run: node scripts/test-sam-api.mjs
 *
 * Hits the SAM.gov Opportunities API and prints 3 active opportunities.
 * Verifies: key is valid, API is reachable, and response shape is as expected.
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// ---------------------------------------------------------------------------
// Load .env.local manually (no dotenv dependency needed)
// ---------------------------------------------------------------------------
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '../.env.local');

let SAM_GOV_API_KEY = '';
try {
  const envFile = readFileSync(envPath, 'utf-8');
  for (const line of envFile.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('SAM_GOV_API_KEY=')) {
      SAM_GOV_API_KEY = trimmed.split('=').slice(1).join('=').trim();
    }
  }
} catch {
  console.error('❌  Could not read .env.local — make sure you are running from the proposal-pilot directory.');
  process.exit(1);
}

if (!SAM_GOV_API_KEY) {
  console.error('❌  SAM_GOV_API_KEY is empty in .env.local. Paste your key and try again.');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// SAM.gov Opportunities API — fetch 3 active posted opportunities
// ---------------------------------------------------------------------------
const BASE_URL = 'https://api.sam.gov/opportunities/v2/search';

const params = new URLSearchParams({
  api_key: SAM_GOV_API_KEY,
  limit: '3',
  postedFrom: '01/01/2025',
  postedTo: '12/31/2025',
  ptype: 'o',          // presolicitation + solicitation
  active: 'true',
});

console.log('\n🔍  Testing SAM.gov Opportunities API...\n');

try {
  const res = await fetch(`${BASE_URL}?${params.toString()}`);

  if (!res.ok) {
    const body = await res.text();
    console.error(`❌  HTTP ${res.status} — ${res.statusText}`);
    console.error('Response body:', body);
    process.exit(1);
  }

  const data = await res.json();

  const total = data.totalRecords ?? data.total ?? '(unknown)';
  const opps = data.opportunitiesData ?? data.data ?? [];

  console.log(`✅  API key is valid!`);
  console.log(`📊  Total matching opportunities: ${total.toLocaleString()}\n`);

  if (opps.length === 0) {
    console.log('⚠️  No opportunities returned — try widening the date range.');
  } else {
    console.log(`─────────────────────────────────────────────────────────────`);
    opps.forEach((opp, i) => {
      console.log(`\n[${i + 1}] ${opp.title ?? '(no title)'}`);
      console.log(`    Notice ID  : ${opp.solicitationNumber ?? opp.noticeId ?? '—'}`);
      console.log(`    Agency     : ${opp.fullParentPathName ?? opp.organizationName ?? '—'}`);
      console.log(`    NAICS      : ${opp.naicsCode ?? '—'}`);
      console.log(`    Posted     : ${opp.postedDate ?? '—'}`);
      console.log(`    Due        : ${opp.responseDeadLine ?? opp.archiveDate ?? '—'}`);
      console.log(`    Type       : ${opp.type ?? '—'}`);
      console.log(`    Active     : ${opp.active ?? '—'}`);
    });
    console.log(`\n─────────────────────────────────────────────────────────────`);
  }

  console.log('\n✅  SAM.gov API integration is ready to wire into ProposalPilot.\n');

} catch (err) {
  console.error('❌  Network error:', err.message);
  process.exit(1);
}
