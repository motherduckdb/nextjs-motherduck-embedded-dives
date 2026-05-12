// Simple migration runner for Postgres.
// Reads .sql files from migrations/ in sorted order, tracks applied
// migrations in a `_migrations` table, and runs any that are new.

import { readdir, readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, "..", "migrations");

async function loadLocalEnv() {
  for (const file of [".env.local", ".env"]) {
    try {
      const content = await readFile(join(__dirname, "..", file), "utf-8");
      for (const line of content.split(/\r?\n/)) {
        const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)\s*$/);
        if (!match || process.env[match[1]] !== undefined) continue;
        process.env[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, "");
      }
    } catch {
      // Optional local env file.
    }
  }
}

await loadLocalEnv();

const POSTGRES_URL = process.env.POSTGRES_URL;
if (!POSTGRES_URL) {
  console.error("POSTGRES_URL is required to run Postgres migrations.");
  process.exit(1);
}

const sql = postgres(POSTGRES_URL);

try {
  await sql.begin(async (tx) => {
    await tx`SELECT pg_advisory_xact_lock(hashtext('motherduck_embedded_dives_migrations'))`;

    // Ensure tracking table exists.
    await tx`
      CREATE TABLE IF NOT EXISTS _migrations (
        name TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ DEFAULT now()
      )
    `;

    const applied = new Set(
      (await tx`SELECT name FROM _migrations ORDER BY name`).map((r) => r.name)
    );

    const files = (await readdir(MIGRATIONS_DIR))
      .filter((f) => f.endsWith(".sql"))
      .sort();

    let ran = 0;
    for (const file of files) {
      if (applied.has(file)) continue;
      const content = await readFile(join(MIGRATIONS_DIR, file), "utf-8");
      console.log(`Running migration: ${file}`);
      await tx.unsafe(content);
      await tx`INSERT INTO _migrations (name) VALUES (${file})`;
      ran++;
    }

    if (ran === 0) {
      console.log("All migrations already applied.");
    } else {
      console.log(`Applied ${ran} migration(s).`);
    }
  });
} finally {
  await sql.end();
}
