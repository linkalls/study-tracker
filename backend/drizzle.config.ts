import type { Config } from 'drizzle-kit';

export default {
  schema: './db/schema.ts', // Path to your schema file, relative to this config file (backend/)
  out: './drizzle',      // Directory for migrations, relative to this config file (backend/)
  driver: 'better-sqlite', // bun:sqlite is compatible with better-sqlite driver for Drizzle Kit
  dbCredentials: {
    url: './db.sqlite',    // Path to your SQLite database file, relative to this config file (backend/)
  },
  // verbose: true, // Optional
  // strict: true,  // Optional
} satisfies Config;
