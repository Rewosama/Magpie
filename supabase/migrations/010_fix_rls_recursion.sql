-- Migration 010: Fix infinite recursion in RLS policies
--
-- Problem:
--   collections.collections_member_select queries collection_members
--   collection_members.cm_owner_select queries collections
--   → infinite recursion when any SELECT is run on collections
--
-- Fix: replace cm_owner_select with a SECURITY DEFINER function
--   that bypasses RLS for the ownership check, breaking the cycle.

-- Helper function: checks collection ownership without triggering RLS
CREATE OR REPLACE FUNCTION is_collection_owner(p_collection_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM collections
    WHERE id = p_collection_id
      AND user_id = auth.uid()
  );
$$;

-- Rebuild cm_owner_select using the SECURITY DEFINER function
DROP POLICY IF EXISTS cm_owner_select ON collection_members;

CREATE POLICY cm_owner_select ON collection_members
  FOR SELECT
  USING (is_collection_owner(collection_id));
