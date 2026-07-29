#!/bin/sh
set -eu

echo "Waiting for PostgreSQL import to finish..."

node <<'NODE'
const { Client } = require('pg');

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('DATABASE_URL is not configured.');
  process.exit(1);
}

const requiredTables = [
  'animal_db_vn',
  'plant_db_vn',
  'insect_db_vn',
  'taxa',
  'taxon_closure',
  'species_taxonomy',
  'gbif_occurrences',
  'vnredlist_profiles',
  'national_parks_vn',
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function checkDatabaseReady() {
  const client = new Client({ connectionString });
  await client.connect();

  try {
    for (const table of requiredTables) {
      const result = await client.query(
        `
          SELECT EXISTS (
            SELECT 1
            FROM information_schema.tables
            WHERE table_schema = 'public'
              AND table_name = $1
          ) AS exists
        `,
        [table],
      );

      if (!result.rows[0]?.exists) {
        return { ready: false, reason: `${table} is not created yet` };
      }

      const countResult = await client.query(
        `SELECT EXISTS (SELECT 1 FROM "${table}" LIMIT 1) AS has_rows`,
      );

      if (!countResult.rows[0]?.has_rows) {
        return { ready: false, reason: `${table} has no rows yet` };
      }
    }

    return { ready: true };
  } finally {
    await client.end();
  }
}

async function main() {
  const maxAttempts = Number(process.env.DB_WAIT_ATTEMPTS || 240);
  const delayMs = Number(process.env.DB_WAIT_DELAY_MS || 5000);

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const status = await checkDatabaseReady();

      if (status.ready) {
        console.log('PostgreSQL import is ready.');
        return;
      }

      console.log(`Database not ready yet (${status.reason}). Attempt ${attempt}/${maxAttempts}`);
    } catch (error) {
      console.log(`Database not reachable yet. Attempt ${attempt}/${maxAttempts}`);
    }

    await sleep(delayMs);
  }

  console.error('Timed out waiting for PostgreSQL import.');
  process.exit(1);
}

main();
NODE

if [ -f dist/src/main.js ]; then
  exec node dist/src/main.js
fi

exec node dist/main.js
