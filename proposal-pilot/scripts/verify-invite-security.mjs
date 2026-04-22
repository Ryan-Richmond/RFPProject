import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import pg from "pg";

const { Client } = pg;

function readEnvFile(filePath) {
  const env = {};
  const content = fs.readFileSync(filePath, "utf8");

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const index = line.indexOf("=");
    let value = line.slice(index + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    env[line.slice(0, index).trim()] = value;
  }

  return env;
}

async function main() {
  const env = readEnvFile(path.join(process.cwd(), ".env.local"));
  const connectionString = env.DIRECT_URL || env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DIRECT_URL or DATABASE_URL is required in .env.local.");
  }

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  try {
    const result = await client.query(`
      select
        (
          select qual
          from pg_policies
          where schemaname = 'public'
            and tablename = 'workspace_members'
            and policyname = 'workspace_members_admin_update'
        ) as update_policy_using,
        to_regprocedure('public.validate_workspace_invite(text,text)') is not null
          as has_validate_workspace_invite,
        exists (
          select 1
          from information_schema.routine_privileges
          where routine_schema = 'public'
            and routine_name = 'validate_workspace_invite'
            and grantee = 'anon'
            and privilege_type = 'EXECUTE'
        ) as anon_can_validate
    `);

    console.log(JSON.stringify(result.rows[0], null, 2));
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
