import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import pg from "pg";

const { Client } = pg;
const root = process.cwd();

function readEnvFile(filePath) {
  const env = {};
  const content = fs.readFileSync(filePath, "utf8");

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) continue;

    const index = line.indexOf("=");
    const key = line.slice(0, index).trim();
    let value = line.slice(index + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    env[key] = value;
  }

  return env;
}

function parseMigrationFile(filename) {
  const match = filename.match(/^([^_]+)_(.+)\.sql$/);
  if (!match) {
    throw new Error(`Unexpected migration filename: ${filename}`);
  }

  return {
    version: match[1],
    name: match[2],
  };
}

async function ensureMigrationTable(client) {
  await client.query("create schema if not exists supabase_migrations");
  await client.query(`
    create table if not exists supabase_migrations.schema_migrations (
      version text primary key,
      statements text[],
      name text
    )
  `);
}

async function getAppliedVersions(client) {
  const result = await client.query(
    "select version from supabase_migrations.schema_migrations"
  );
  return new Set(result.rows.map((row) => row.version));
}

async function main() {
  const env = readEnvFile(path.join(root, ".env.local"));
  const connectionString = env.DIRECT_URL || env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DIRECT_URL or DATABASE_URL is required in .env.local.");
  }

  if (/\[YOUR-PASSWORD\]|YOUR_PASSWORD|YOUR-PASSWORD/.test(connectionString)) {
    throw new Error("Connection string still contains a password placeholder.");
  }

  const migrationsDir = path.join(root, "supabase", "migrations");
  const migrationFiles = fs
    .readdirSync(migrationsDir)
    .filter((filename) => filename.endsWith(".sql"))
    .sort();

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();

  try {
    await ensureMigrationTable(client);
    const appliedVersions = await getAppliedVersions(client);

    for (const filename of migrationFiles) {
      const { version, name } = parseMigrationFile(filename);

      if (appliedVersions.has(version)) {
        console.log(`skip ${filename}`);
        continue;
      }

      const sql = fs.readFileSync(path.join(migrationsDir, filename), "utf8");
      console.log(`apply ${filename}`);
      await client.query("begin");
      try {
        await client.query(sql);
        await client.query(
          `
            insert into supabase_migrations.schema_migrations
              (version, statements, name)
            values ($1, $2, $3)
            on conflict (version) do update
              set statements = excluded.statements,
                  name = excluded.name
          `,
          [version, [sql], name]
        );
        await client.query("commit");
      } catch (error) {
        await client.query("rollback");
        throw new Error(`${filename}: ${error.message}`);
      }
    }

    const verification = await client.query(`
      select
        to_regclass('public.workspaces') as workspaces_table,
        to_regclass('public.workspace_invites') as workspace_invites_table,
        exists(select 1 from storage.buckets where id = 'documents') as documents_bucket
    `);

    console.log(JSON.stringify(verification.rows[0], null, 2));
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
