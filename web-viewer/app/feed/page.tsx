import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase";
import CollectionFilter from "@/components/CollectionFilter";
import MobileSidebar from "@/components/MobileSidebar";
import PostCardList from "@/components/PostCardList";
import type {
  Collection,
  FeedPost,
  PostCursor,
  SharedCollection,
  Tag,
  TagWithCount,
} from "@/lib/types";

interface FeedPageProps {
  searchParams: {
    collection?: string;
    q?: string;
    tag?: string;
    platform?: "instagram" | "x" | "threads";
  };
}

const PAGE_SIZE = 24;

const FEED_SELECT =
  "id, user_id, post_url, post_type, platform, " +
  "author_username, author_display_name, author_avatar_url, " +
  "content_text, media_urls, post_timestamp, saved_at, " +
  "collection_id, raw_metadata, thumbnail_url, canonical_url, note, public_note, " +
  "collections(name)";

export default async function FeedPage({ searchParams }: FeedPageProps) {
  const supabase = createServerClient();

  // Use getUser() instead of getSession() - it validates JWT with Supabase
  // and won't return stale data after logout
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const collectionId = searchParams.collection;
  const trimmedQ = searchParams.q?.trim();
  const tagId = searchParams.tag;
  const platformFilter = searchParams.platform;

  // ── Get platform counts first ───────────────────────────────────────────────
  let platformCountsQuery = supabase.from("saved_posts").select("platform");

  if (collectionId)
    platformCountsQuery = platformCountsQuery.eq("collection_id", collectionId);

  const { data: allPostsForCounts } = await platformCountsQuery;

  const platformCounts = {
    all: allPostsForCounts?.length ?? 0,
    instagram:
      allPostsForCounts?.filter((p) => p.platform === "instagram").length ?? 0,
    x: allPostsForCounts?.filter((p) => p.platform === "x").length ?? 0,
    threads:
      allPostsForCounts?.filter((p) => p.platform === "threads").length ?? 0,
  };

  // ── Build the posts query ───────────────────────────────────────────────────
  let postsPromise;

  if (trimmedQ) {
    postsPromise = supabase.rpc("search_saved_posts", {
      p_query: trimmedQ,
      p_collection_id: collectionId ?? null,
      p_limit: 100,
    });
  } else if (tagId) {
    postsPromise = (async () => {
      const { data: postTagRows } = await supabase
        .from("post_tags")
        .select("post_id")
        .eq("tag_id", tagId);

      const postIds = (postTagRows ?? []).map((pt) => pt.post_id);

      if (postIds.length === 0) {
        return { data: [], error: null };
      }

      let q = supabase
        .from("saved_posts")
        .select(FEED_SELECT)
        .in("id", postIds)
        .order("saved_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(PAGE_SIZE + 1);

      if (collectionId) q = q.eq("collection_id", collectionId);
      if (platformFilter) q = q.eq("platform", platformFilter);

      return q;
    })();
  } else {
    let q = supabase
      .from("saved_posts")
      .select(FEED_SELECT)
      .order("saved_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(PAGE_SIZE + 1);

    if (collectionId) q = q.eq("collection_id", collectionId);
    if (platformFilter) q = q.eq("platform", platformFilter);

    postsPromise = q;
  }

  const [
    postsResult,
    { data: ownedCollections },
    { data: sharedCollections },
    { data: tagsData },
  ] = await Promise.all([
    postsPromise,
    supabase
      .from("collections")
      .select("id, name, is_default")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true }),
    supabase.rpc("get_shared_collections_with_owner", {
      p_user_id: user.id,
    }),
    supabase
      .from("tags")
      .select("id, user_id, name, created_at")
      .eq("user_id", user.id)
      .order("name", { ascending: true }),
  ]);

  // ── Get tag counts ──────────────────────────────────────────────────────────
  const tagIds = (tagsData ?? []).map((t) => t.id);
  const { data: tagCounts } = await supabase
    .from("post_tags")
    .select("tag_id")
    .in(
      "tag_id",
      tagIds.length > 0 ? tagIds : ["00000000-0000-0000-0000-000000000000"],
    );

  const tagCountMap = new Map<string, number>();
  (tagCounts ?? []).forEach((pt) => {
    tagCountMap.set(pt.tag_id, (tagCountMap.get(pt.tag_id) ?? 0) + 1);
  });

  const tags: TagWithCount[] = (tagsData ?? []).map((t) => ({
    ...t,
    post_count: tagCountMap.get(t.id) ?? 0,
  }));

  // ── Process posts result ────────────────────────────────────────────────────
  let posts: FeedPost[];
  let nextCursor: PostCursor | null;

  if (trimmedQ) {
    type SearchRow = Omit<FeedPost, "collections"> & {
      collection_name: string | null;
    };
    let searchPosts = ((postsResult.data ?? []) as SearchRow[]).map(
      ({ collection_name, ...rest }) => ({
        ...rest,
        collections: collection_name ? { name: collection_name } : null,
      }),
    );
    if (platformFilter) {
      searchPosts = searchPosts.filter((p) => p.platform === platformFilter);
    }
    posts = searchPosts;
    nextCursor = null;
  } else {
    const rows = (postsResult.data ?? []) as unknown as FeedPost[];
    const hasMore = rows.length > PAGE_SIZE;
    posts = hasMore ? rows.slice(0, PAGE_SIZE) : rows;
    const last = posts[posts.length - 1];
    nextCursor =
      hasMore && last ? { saved_at: last.saved_at, id: last.id } : null;
  }

  // ── Fetch tags for posts ────────────────────────────────────────────────────
  const postIds = posts.map((p) => p.id);
  const { data: postTagsData } = await supabase
    .from("post_tags")
    .select("post_id, tags(id, user_id, name, created_at)")
    .in(
      "post_id",
      postIds.length > 0 ? postIds : ["00000000-0000-0000-0000-000000000000"],
    );

  const postTagsMap = new Map<string, Tag[]>();
  (postTagsData ?? []).forEach((pt) => {
    const tag = pt.tags as unknown as Tag;
    if (!tag) return;
    if (!postTagsMap.has(pt.post_id)) postTagsMap.set(pt.post_id, []);
    postTagsMap.get(pt.post_id)!.push(tag);
  });

  posts = posts.map((p) => ({
    ...p,
    tags: postTagsMap.get(p.id) ?? [],
  }));

  // ── Determine collaborative view ────────────────────────────────────────────
  const isCollaborativeView = !!(
    collectionId &&
    (
      (sharedCollections as { collection_id: string; member_role: string }[]) ??
      []
    ).find(
      (c) =>
        c.collection_id === collectionId && c.member_role === "collaborator",
    )
  );

  return (
    <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-6 flex gap-8 items-start">
      {/* Desktop Sidebar - hidden on mobile */}
      <Suspense fallback={null}>
        <div className="w-48 shrink-0 sticky top-[calc(3rem+1.5rem)] hidden md:block">
          <CollectionFilter
            ownedCollections={(ownedCollections as Collection[]) ?? []}
            sharedCollections={(sharedCollections as SharedCollection[]) ?? []}
            activeId={collectionId}
            tags={tags}
            activeTagId={tagId}
          />
        </div>
      </Suspense>

      {/* Mobile Sidebar - hidden on desktop */}
      <MobileSidebar
        ownedCollections={(ownedCollections as Collection[]) ?? []}
        sharedCollections={(sharedCollections as SharedCollection[]) ?? []}
        activeCollectionId={collectionId}
        tags={tags}
        activeTagId={tagId}
      />

      {/* Main */}
      <div className="flex-1 min-w-0 flex flex-col gap-4">
        {/* Platform Filter + Select Toolbar wrapper */}
        <PostCardList
          posts={posts}
          currentUserId={user.id}
          currentUserEmail={user.email ?? ""}
          isCollaborativeView={isCollaborativeView}
          initialCursor={nextCursor}
          collectionId={collectionId}
          searchQuery={trimmedQ}
          ownedCollections={(ownedCollections as Collection[]) ?? []}
          allTags={(tagsData as Tag[]) ?? []}
          activeTagId={tagId}
          activePlatform={platformFilter}
          platformCounts={platformCounts}
        />
      </div>
    </div>
  );
}
