import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit, rateLimitResponse } from "../shared/rate-limit.ts";

const VALID_OPERATIONS = ["list", "create", "rename", "delete", "set_default"] as const;
type Operation = (typeof VALID_OPERATIONS)[number];

const JSON_HEADERS = { "Content-Type": "application/json" };

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: JSON_HEADERS,
  });
}

/**
 * Validates that a collection name is 1–255 characters and contains at least
 * one non-whitespace character, as required by Requirements 9.4 and 9.9.
 */
function isValidName(name: unknown): name is string {
  if (typeof name !== "string") return false;
  const trimmed = name.trim();
  return trimmed.length >= 1 && trimmed.length <= 255;
}

serve(async (req: Request): Promise<Response> => {
  // Only accept POST requests
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  // ── Step 1: Rate limiting (Requirements 18.2, 18.3, 18.4) ────────────────
  // Extract raw JWT if present (may be absent for unauthenticated requests).
  // Fall back to forwarded IP, then a generic sentinel so every request gets
  // a bucket even before auth is verified.
  const rawAuthHeader = req.headers.get("Authorization");
  const rawJwt = rawAuthHeader?.startsWith("Bearer ")
    ? rawAuthHeader.replace("Bearer ", "")
    : null;
  const rateLimitKey = `manage-collection:${rawJwt || req.headers.get("x-forwarded-for") || "unknown"}`;
  const rateLimitResult = await checkRateLimit(rateLimitKey, {
    maxRequests: 30,
    windowSeconds: 60,
  });
  if (!rateLimitResult.allowed) {
    return rateLimitResponse(rateLimitResult.retryAfterSeconds);
  }

  // ── Step 2: Extract JWT from Authorization header ──────────────────────────
  // Requirement 9.2: verify JWT before performing any operation
  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return jsonResponse(
      { error: "Missing or malformed Authorization header" },
      401,
    );
  }
  const jwt = authHeader.replace("Bearer ", "");

  // ── Step 3: Verify JWT via Supabase Auth ───────────────────────────────────
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: "Server configuration error" }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const { data: userData, error: authError } = await supabase.auth.getUser(jwt);

  if (authError || !userData?.user) {
    // Requirement 9.7: missing/invalid/expired JWT → HTTP 401
    return jsonResponse({ error: "Invalid or expired token" }, 401);
  }

  const userId = userData.user.id;

  // ── Step 3: Parse request body ─────────────────────────────────────────────
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Request body must be valid JSON" }, 400);
  }

  const {
    operation,
    collection_id: _collection_id,
    name,
  } = body as {
    operation?: unknown;
    collection_id?: unknown;
    name?: unknown;
  };
  // _collection_id is parsed here but used in task 3.2 (rename / delete)

  // ── Step 4: Validate operation ─────────────────────────────────────────────
  // Requirement 9.11: operation not in [list, create, rename, delete] → HTTP 400
  if (!operation || !VALID_OPERATIONS.includes(operation as Operation)) {
    return jsonResponse(
      { error: `operation must be one of: ${VALID_OPERATIONS.join(", ")}` },
      400,
    );
  }

  const op = operation as Operation;

  // ── Step 5: Dispatch to operation handlers ─────────────────────────────────

  // ── list ──────────────────────────────────────────────────────────────────
  if (op === "list") {
    // 1. Own collections
    const { data: ownedCols, error: listError } = await supabase
      .from("collections")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: true });

    if (listError) {
      return jsonResponse({ error: "Failed to fetch collections" }, 500);
    }

    // 2. Collections where user is a collaborator member
    const { data: memberships } = await supabase
      .from("collection_members")
      .select("collection_id, member_role")
      .eq("member_user_id", userId)
      .eq("member_role", "collaborator");

    let sharedCols: unknown[] = [];
    if (memberships && memberships.length > 0) {
      const sharedIds = memberships.map((m: Record<string, string>) => m.collection_id);
      const { data: cols } = await supabase
        .from("collections")
        .select("*")
        .in("id", sharedIds);
      sharedCols = (cols ?? []).map((col: Record<string, unknown>) => ({
        ...col,
        is_shared: true,
        member_role: (memberships as Array<{collection_id: string; member_role: string}>)
          .find((m) => m.collection_id === col.id)?.member_role ?? "collaborator",
      }));
    }

    const collections = [
      ...(ownedCols ?? []).map((c: Record<string, unknown>) => ({ ...c, is_shared: false })),
      ...sharedCols,
    ];

    return jsonResponse({ collections }, 200);
  }

  // ── create ─────────────────────────────────────────────────────────────────
  if (op === "create") {
    // Requirement 9.9: missing or invalid name → HTTP 400
    if (!isValidName(name)) {
      return jsonResponse(
        { error: "name must be 1-255 non-empty characters" },
        400,
      );
    }

    // Auto-set is_default = true for the first collection the user creates.
    const { count: existingCount } = await supabase
      .from("collections")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId);

    const isFirst = existingCount === 0;

    // Requirement 9.4: INSERT new collection with user_id from JWT
    const { data: collection, error: insertError } = await supabase
      .from("collections")
      .insert({ user_id: userId, name: (name as string).trim(), is_default: isFirst })
      .select()
      .single();

    if (insertError) {
      return jsonResponse({ error: "Failed to create collection" }, 500);
    }

    return jsonResponse({ collection }, 201);
  }

  // ── rename ─────────────────────────────────────────────────────────────────
  if (op === "rename") {
    const { collection_id } = body as { collection_id?: unknown };

    // Requirement 9.10: collection_id is required for rename → HTTP 400 if absent
    if (!collection_id) {
      return jsonResponse({ error: "collection_id is required" }, 400);
    }

    // Requirement 9.9: new name must be 1–255 non-whitespace chars → HTTP 400 if invalid
    if (!isValidName(name)) {
      return jsonResponse(
        { error: "name must be 1-255 non-empty characters" },
        400,
      );
    }

    // Requirement 9.5: UPDATE name WHERE id = collection_id AND user_id = jwt user
    // Requirement 9.8: if no row matched (wrong owner or non-existent) → HTTP 403
    const { data: collection, error: updateError } = await supabase
      .from("collections")
      .update({ name: (name as string).trim() })
      .eq("id", collection_id as string)
      .eq("user_id", userId)
      .select()
      .single();

    if (updateError || !collection) {
      // PGRST116 = 0 rows returned by .single() — ownership check failed
      return jsonResponse(
        { error: "Collection not found or access denied" },
        403,
      );
    }

    return jsonResponse({ collection }, 200);
  }

  // ── delete ─────────────────────────────────────────────────────────────────
  if (op === "delete") {
    const { collection_id } = body as { collection_id?: unknown };

    // Requirement 9.10: collection_id is required for delete → HTTP 400 if absent
    if (!collection_id) {
      return jsonResponse({ error: "collection_id is required" }, 400);
    }

    // Requirement 9.6: DELETE WHERE id = collection_id AND user_id = jwt user
    // Requirement 9.8: if no row deleted (wrong owner or non-existent) → HTTP 403
    const { data: deleted, error: deleteError } = await supabase
      .from("collections")
      .delete()
      .eq("id", collection_id as string)
      .eq("user_id", userId)
      .select()
      .single();

    if (deleteError || !deleted) {
      // PGRST116 = 0 rows returned by .single() — ownership check failed
      return jsonResponse(
        { error: "Collection not found or access denied" },
        403,
      );
    }

    return jsonResponse({ deleted_id: collection_id }, 200);
  }

  // ── set_default ──────────────────────────────────────────────────────────
  if (op === "set_default") {
    const { collection_id } = body as { collection_id?: unknown };

    if (!collection_id) {
      return jsonResponse({ error: "collection_id is required" }, 400);
    }

    // Clear all existing defaults for this user, then set the new one.
    // Done as two sequential queries (not a transaction) — acceptable here
    // because there is at most one default row per user at any time.
    const { error: clearError } = await supabase
      .from("collections")
      .update({ is_default: false })
      .eq("user_id", userId)
      .eq("is_default", true);

    if (clearError) {
      return jsonResponse({ error: "Failed to clear existing default" }, 500);
    }

    const { data: collection, error: setError } = await supabase
      .from("collections")
      .update({ is_default: true })
      .eq("id", collection_id as string)
      .eq("user_id", userId)
      .select()
      .single();

    if (setError || !collection) {
      return jsonResponse({ error: "Collection not found or access denied" }, 403);
    }

    return jsonResponse({ collection }, 200);
  }

  // Unreachable, but satisfies TypeScript exhaustiveness
  return jsonResponse({ error: "Unexpected error" }, 500);
});
