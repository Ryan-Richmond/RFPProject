/**
 * SAM.gov → Supabase Sync Script
 * Pulls all active opportunities from SAM.gov and upserts into sam_opportunities table.
 *
 * Usage: node scripts/sync-sam-opportunities.mjs
 *
 * SAM.gov API limits: 1,000 results per request, so we paginate with offset.
 * Rate limit: ~1,000 requests/day on free tier.
 */
import pg from 'pg';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Load env
// ---------------------------------------------------------------------------
const envFile = readFileSync(resolve(__dirname, '../.env.local'), 'utf-8');
const env = {};
for (const line of envFile.split('\n')) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const eqIdx = t.indexOf('=');
  if (eqIdx > 0) {
    const key = t.substring(0, eqIdx);
    env[key] = t.substring(eqIdx + 1).replace(/^["']|["']$/g, '');
  }
}

const SAM_API_KEY = env.SAM_GOV_API_KEY;
const DIRECT_URL = env.DIRECT_URL;

if (!SAM_API_KEY) { console.error('❌  SAM_GOV_API_KEY missing'); process.exit(1); }
if (!DIRECT_URL) { console.error('❌  DIRECT_URL missing'); process.exit(1); }

// ---------------------------------------------------------------------------
// SAM.gov fetch with pagination
// ---------------------------------------------------------------------------
const BASE_URL = 'https://api.sam.gov/opportunities/v2/search';
const PAGE_SIZE = 1000; // SAM.gov max per request

async function fetchPage(offset) {
  const params = new URLSearchParams({
    api_key: SAM_API_KEY,
    limit: String(PAGE_SIZE),
    offset: String(offset),
    postedFrom: '01/01/2025',
    postedTo: '12/31/2025',
    ptype: 'o',
    active: 'true',
  });

  const res = await fetch(`${BASE_URL}?${params.toString()}`);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`SAM.gov HTTP ${res.status}: ${body.substring(0, 300)}`);
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Map SAM.gov record → our table columns
// ---------------------------------------------------------------------------
function mapOpp(opp) {
  return {
    notice_id: opp.noticeId,
    solicitation_number: opp.solicitationNumber || null,
    title: opp.title || '(no title)',
    full_parent_path_name: opp.fullParentPathName || null,
    full_parent_path_code: opp.fullParentPathCode || null,
    organization_type: opp.organizationType || null,
    posted_date: opp.postedDate || null,
    response_deadline: opp.responseDeadLine || null,
    archive_date: opp.archiveDate || null,
    type: opp.type || null,
    base_type: opp.baseType || null,
    archive_type: opp.archiveType || null,
    naics_code: opp.naicsCode || null,
    naics_codes: opp.naicsCodes || [],
    classification_code: opp.classificationCode || null,
    type_of_set_aside: opp.typeOfSetAside || null,
    type_of_set_aside_description: opp.typeOfSetAsideDescription || null,
    active: opp.active || 'Yes',
    award: opp.award ? JSON.stringify(opp.award) : null,
    point_of_contact: JSON.stringify(opp.pointOfContact || []),
    description_url: opp.description || null,
    office_address: opp.officeAddress ? JSON.stringify(opp.officeAddress) : null,
    place_of_performance: opp.placeOfPerformance ? JSON.stringify(opp.placeOfPerformance) : null,
    ui_link: opp.uiLink || null,
    additional_info_link: opp.additionalInfoLink || null,
    resource_links: opp.resourceLinks ? JSON.stringify(opp.resourceLinks) : null,
    raw_data: JSON.stringify(opp),
  };
}

// ---------------------------------------------------------------------------
// Upsert batch into Postgres
// ---------------------------------------------------------------------------
async function upsertBatch(client, records) {
  if (records.length === 0) return 0;

  // Build a multi-row INSERT ... ON CONFLICT (notice_id) DO UPDATE
  const columns = [
    'notice_id', 'solicitation_number', 'title',
    'full_parent_path_name', 'full_parent_path_code', 'organization_type',
    'posted_date', 'response_deadline', 'archive_date',
    'type', 'base_type', 'archive_type',
    'naics_code', 'naics_codes', 'classification_code',
    'type_of_set_aside', 'type_of_set_aside_description',
    'active', 'award', 'point_of_contact', 'description_url',
    'office_address', 'place_of_performance',
    'ui_link', 'additional_info_link', 'resource_links', 'raw_data',
  ];

  const colCount = columns.length;
  const values = [];
  const placeholders = [];

  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    const rowPlaceholders = [];
    for (let j = 0; j < colCount; j++) {
      const paramIdx = i * colCount + j + 1;
      rowPlaceholders.push(`$${paramIdx}`);
      values.push(r[columns[j]]);
    }
    placeholders.push(`(${rowPlaceholders.join(', ')})`);
  }

  // Build SET clause for upsert (update everything except notice_id)
  const updateCols = columns.filter(c => c !== 'notice_id');
  const setClause = updateCols.map(c => `${c} = EXCLUDED.${c}`).join(', ');

  const sql = `
    INSERT INTO public.sam_opportunities (${columns.join(', ')})
    VALUES ${placeholders.join(',\n       ')}
    ON CONFLICT (notice_id) DO UPDATE SET ${setClause}, synced_at = NOW(), updated_at = NOW()
  `;

  await client.query(sql, values);
  return records.length;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log('\n🚀  SAM.gov → Supabase Sync');
  console.log('═══════════════════════════════════════\n');

  // 1. Fetch total count
  const firstPage = await fetchPage(0);
  const total = firstPage.totalRecords ?? 0;
  const allOpps = firstPage.opportunitiesData ?? [];

  console.log(`📊  Total active opportunities: ${total.toLocaleString()}`);
  console.log(`📦  Page 1: fetched ${allOpps.length} records`);

  // 2. Paginate through remaining
  let offset = PAGE_SIZE;
  let pageNum = 2;
  while (offset < total) {
    console.log(`📦  Page ${pageNum}: fetching offset ${offset}...`);
    const page = await fetchPage(offset);
    const pageData = page.opportunitiesData ?? [];
    allOpps.push(...pageData);
    console.log(`    → got ${pageData.length} records (total so far: ${allOpps.length})`);

    if (pageData.length === 0) break; // no more data
    offset += PAGE_SIZE;
    pageNum++;

    // Small delay to be respectful of rate limits
    await new Promise(r => setTimeout(r, 500));
  }

  console.log(`\n✅  Fetched ${allOpps.length} opportunities from SAM.gov`);

  // 3. Map to our schema
  const mapped = allOpps.map(mapOpp);

  // 4. Connect to DB and upsert in batches
  console.log(`\n📡  Connecting to Supabase...`);
  const client = new pg.Client({ connectionString: DIRECT_URL });
  await client.connect();

  const BATCH_SIZE = 100;
  let inserted = 0;

  try {
    for (let i = 0; i < mapped.length; i += BATCH_SIZE) {
      const batch = mapped.slice(i, i + BATCH_SIZE);
      const count = await upsertBatch(client, batch);
      inserted += count;
      const pct = Math.round((inserted / mapped.length) * 100);
      process.stdout.write(`\r💾  Upserted ${inserted.toLocaleString()} / ${mapped.length.toLocaleString()} (${pct}%)`);
    }
    console.log('\n');
  } finally {
    await client.end();
  }

  // 5. Summary
  console.log('═══════════════════════════════════════');
  console.log(`✅  Sync complete!`);
  console.log(`   Fetched : ${allOpps.length.toLocaleString()} opportunities`);
  console.log(`   Upserted: ${inserted.toLocaleString()} rows into sam_opportunities`);
  console.log('═══════════════════════════════════════\n');
}

main().catch(err => {
  console.error('\n❌  Fatal error:', err.message);
  process.exit(1);
});
