import 'dotenv/config';
import { pbkdf2Sync, randomBytes } from 'node:crypto';
import { Pool } from 'pg';

const email = requiredEnv('ADMIN_EMAIL');
const password = requiredEnv('ADMIN_PASSWORD');
const displayName = requiredEnv('ADMIN_DISPLAY_NAME');
const iterations = 120000;
const keyLength = 32;
const digest = 'sha256';

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is not configured.`);
  }

  return value;
}

function hashPassword(value: string) {
  const salt = randomBytes(16).toString('base64url');
  const hash = pbkdf2Sync(value, salt, iterations, keyLength, digest).toString('base64url');

  return `pbkdf2_${digest}$${iterations}$${salt}$${hash}`;
}

async function main() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('DATABASE_URL is not configured.');
  }

  const pool = new Pool({ connectionString });
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const userResult = await client.query<{ user_id: string }>(
      `
        INSERT INTO app_users (email, display_name, password_hash)
        VALUES ($1, $2, $3)
        ON CONFLICT (email)
        DO UPDATE SET
          display_name = EXCLUDED.display_name,
          password_hash = EXCLUDED.password_hash,
          is_active = TRUE,
          updated_at = NOW()
        RETURNING user_id
      `,
      [email, displayName, hashPassword(password)],
    );

    await client.query(
      `
        INSERT INTO user_roles (user_id, role_code)
        VALUES ($1, 'admin')
        ON CONFLICT (user_id, role_code) DO NOTHING
      `,
      [userResult.rows[0].user_id],
    );

    await client.query('COMMIT');
    console.log(`Seeded admin user: ${email}`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
