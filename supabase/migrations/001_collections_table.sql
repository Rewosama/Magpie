-- Migration 001: Create collections table
-- Requirements: 14.1

-- Enable pgcrypto for gen_random_uuid() support
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create collections table
CREATE TABLE IF NOT EXISTS collections (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  name        TEXT        NOT NULL CHECK (char_length(name) BETWEEN 1 AND 255),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
