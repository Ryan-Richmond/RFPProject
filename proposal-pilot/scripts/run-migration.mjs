/**
 * Run a SQL migration file against the Supabase database.
 * Usage: node scripts/run-migration.mjs <path-to-sql-file>
 */
import pg from 'pg';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load env
const envFile = readFileSync(resolve(__dirname, '../.env.local'), 'utf-8');
let DIRECT_URL = '';
for (const line of envFile.split('\n')) {
  const t = line.trim();
  if (t.startsWith('DIRECT_URL=')) {
    DIRECT_URL = t.split('=').slice(1).join('=').replace(/^["']|["']$/g, '');
  }
}

if (!DIRECT_URL) {
  console.error('❌  DIRECT_URL not found in .env.local');
  process.exit(1);
}

const sqlFile = process.argv[2];
if (!sqlFile) {
  console.error('Usage: node scripts/run-migration.mjs <path-to-sql-file>');
  process.exit(1);
}

const sql = readFileSync(resolve(process.cwd(), sqlFile), 'utf-8');

console.log(`\n📄  Running migration: ${sqlFile}`);
console.log(`📡  Connecting to Supabase...`);

const client = new pg.Client({ connectionString: DIRECT_URL });
await client.connect();

try {
  await client.query(sql);
  console.log(`✅  Migration applied successfully!\n`);
} catch (err) {
  console.error(`❌  Migration failed:`, err.message);
  process.exit(1);
} finally {
  await client.end();
}
