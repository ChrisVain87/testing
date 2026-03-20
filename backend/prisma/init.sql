-- PostgreSQL initialization script
-- Enables required extensions

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- Optional: Create indexes for pgvector similarity search
-- These are applied after Prisma migrations run
