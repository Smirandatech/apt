import { Pool } from "pg";
import dotenv from "dotenv";

dotenv.config();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("DATABASE_URL is not set");
}

const isLocalhost =
  !!connectionString &&
  (/localhost|127\.0\.0\.1/i.test(connectionString));

// Vercel serverless cannot reach a DB on your laptop.
if (process.env.VERCEL && isLocalhost) {
  console.error(
    "DATABASE_URL points to localhost on Vercel. Use a hosted Postgres URL (Neon, Supabase, Railway, etc.)."
  );
}

const useSsl =
  !!connectionString &&
  !isLocalhost &&
  !/sslmode=disable/i.test(connectionString);

const pool = new Pool({
  connectionString,
  // Hosted Postgres usually requires SSL; local usually does not.
  ssl: useSsl ? { rejectUnauthorized: false } : undefined,
  // Keep pool tiny in serverless.
  max: process.env.VERCEL ? 1 : 10,
});

export default pool;
