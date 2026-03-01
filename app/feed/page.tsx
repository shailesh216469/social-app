"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import CreatePost from "@/components/CreatePost";
import PostCard from "@/components/PostCard";
import SearchUsers from "@/components/SearchUsers";
import FeedHeader from "@/components/FeedHeader";

type CommentType = {
  id: string;
  content: string;
  user_id: string;
  created_at: string;
  profiles: { username: string } | null;
};

type PostType = {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  profiles: { username: string } | null;
  likeCount: number;
  likedByMe: boolean;
  comments: CommentType[];
};

const PAGE_SIZE = 5;

export default function FeedPage() {
  const router = useRouter();

  const [user, setUser] = useState<any>(null);
  const [posts, setPosts] = useState<PostType[]>([]);
  const [pendingCount, setPendingCount] = useState(0);

  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  /* ---------------- INITIAL LOAD ---------------- */

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        router.push("/login");
        return;
      }

      setUser(data.user);
      await fetchPosts(data.user, false);
      await fetchPendingRequests(data.user);
    };

    init();
  }, [router]);

  /* ---------------- FETCH POSTS ---------------- */

  const fetchPosts = async (currentUser: any, append: boolean) => {
    const { data: friendships } = await supabase
      .from("friendships")
      .select("*")
      .or(`user_id_1.eq.${currentUser.id},user_id_2.eq.${currentUser.id}`);

    let friendIds: string[] = [];

    if (friendships) {
      friendIds = friendships.map((f: any) =>
        f.user_id_1 === currentUser.id ? f.user_id_2 : f.user_id_1
      );
    }

    friendIds.push(currentUser.id);

    let query = supabase
      .from("posts")
      .select(`
        id,
        content,
        created_at,
        user_id,
        profiles(username),
        post_likes(user_id),
        comments(
          id,
          content,
          user_id,
          created_at,
          profiles(username)
        )
      `)
      .in("user_id", friendIds)
      .order("created_at", { ascending: false })
      .limit(PAGE_SIZE);

    if (cursor && append) {
      query = query.lt("created_at", cursor);
    }

    const { data } = await query;

    if (!data || data.length === 0) {
      setHasMore(false);
      return;
    }

    const formatted: PostType[] = data.map((post: any) => ({
      id: post.id,
      content: post.content,
      created_at: post.created_at,
      user_id: post.user_id,
      profiles: Array.isArray(post.profiles)
        ? post.profiles[0] || null
        : post.profiles,
      comments: (post.comments || []).map((c: any) => ({
        id: c.id,
        content: c.content,
        user_id: c.user_id,
        created_at: c.created_at,
        profiles: Array.isArray(c.profiles)
          ? c.profiles[0] || null
          : c.profiles,
      })),
      likeCount: post.post_likes?.length || 0,
      likedByMe:
        post.post_likes?.some(
          (like: any) => like.user_id === currentUser.id
        ) || false,
    }));

    if (append) {
      setPosts((prev) => [...prev, ...formatted]);
    } else {
      setPosts(formatted);
    }

    const lastPost = formatted[formatted.length - 1];
    setCursor(lastPost.created_at);

    if (data.length < PAGE_SIZE) {
      setHasMore(false);
    }
  };

  /* ---------------- INFINITE SCROLL ---------------- */

  const loadMore = async () => {
    if (!user || !hasMore || loadingMore) return;
    setLoadingMore(true);
    await fetchPosts(user, true);
    setLoadingMore(false);
  };

  useEffect(() => {
    const handleScroll = () => {
      if (
        window.innerHeight + window.scrollY >=
        document.body.offsetHeight - 200
      ) {
        loadMore();
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [cursor, hasMore, loadingMore, user]);

  /* ---------------- REALTIME ---------------- */

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("social-realtime")

      // 🔥 LIKE EVENTS (Safe + Stable)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "post_likes" },
        async (payload: any) => {
          const postId =
            payload.eventType === "DELETE"
              ? payload.old?.post_id
              : payload.new?.post_id;

          const eventUserId =
            payload.eventType === "DELETE"
              ? payload.old?.user_id
              : payload.new?.user_id;

          if (!postId) return;
          if (eventUserId === user.id) return;

          const { data, error } = await supabase
            .from("post_likes")
            .select("user_id")
            .eq("post_id", postId);

          if (error) return;

          const totalLikes = data?.length || 0;
          const likedByMe =
            data?.some((like) => like.user_id === user.id) || false;

          setPosts((prev) =>
            prev.map((post) =>
              post.id === postId
                ? {
                    ...post,
                    likeCount: totalLikes,
                    likedByMe,
                  }
                : post
            )
          );
        }
      )

      // COMMENT EVENTS
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "comments" },
        async (payload: any) => {
          const postId =
            payload.eventType === "DELETE"
              ? payload.old?.post_id
              : payload.new?.post_id;

          if (!postId) return;

          if (payload.eventType === "INSERT") {
            const { data } = await supabase
              .from("comments")
              .select(`
                id,
                content,
                user_id,
                created_at,
                profiles(username)
              `)
              .eq("id", payload.new.id)
              .single();

            if (!data) return;

            const normalized: CommentType = {
              id: data.id,
              content: data.content,
              user_id: data.user_id,
              created_at: data.created_at,
              profiles: Array.isArray(data.profiles)
                ? data.profiles[0] || null
                : data.profiles,
            };

            setPosts((prev) =>
              prev.map((post) =>
                post.id === postId
                  ? {
                      ...post,
                      comments: [...post.comments, normalized],
                    }
                  : post
              )
            );
          }

          if (payload.eventType === "DELETE") {
            setPosts((prev) =>
              prev.map((post) =>
                post.id === postId
                  ? {
                      ...post,
                      comments: post.comments.filter(
                        (c) => c.id !== payload.old.id
                      ),
                    }
                  : post
              )
            );
          }
        }
      )

      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  /* ---------------- OPTIMISTIC LIKE ---------------- */

  const toggleLike = async (postId: string, liked: boolean) => {
    if (!user) return;

    // Optimistic update
    setPosts((prev) =>
      prev.map((post) =>
        post.id === postId
          ? {
              ...post,
              likeCount: liked
                ? Math.max(post.likeCount - 1, 0)
                : post.likeCount + 1,
              likedByMe: !liked,
            }
          : post
      )
    );

    if (liked) {
      await supabase
        .from("post_likes")
        .delete()
        .match({ post_id: postId, user_id: user.id });
    } else {
      await supabase
        .from("post_likes")
        .insert({ post_id: postId, user_id: user.id });
    }
  };

  const addComment = async (postId: string, text: string) => {
    if (!user || !text.trim()) return;

    await supabase.from("comments").insert({
      post_id: postId,
      user_id: user.id,
      content: text,
    });
  };

  const deleteComment = async (commentId: string) => {
    if (!user) return;
    await supabase.from("comments").delete().eq("id", commentId);
  };

  const fetchPendingRequests = async (currentUser: any) => {
    const { count } = await supabase
      .from("friend_requests")
      .select("*", { count: "exact", head: true })
      .eq("receiver_id", currentUser.id)
      .eq("status", "pending");

    setPendingCount(count || 0);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <div className="min-h-screen p-6 max-w-xl mx-auto">
      {user && (
        <FeedHeader
          pendingCount={pendingCount}
          onLogout={handleLogout}
        />
      )}

      {user && (
        <CreatePost
          userId={user.id}
          onPostCreated={() => {
            setCursor(null);
            setHasMore(true);
            fetchPosts(user, false);
          }}
        />
      )}

      {user && <SearchUsers currentUserId={user.id} />}

      <div className="space-y-6">
        {posts.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            currentUserId={user.id}
            onLikeToggle={toggleLike}
            onAddComment={addComment}
            onDeleteComment={deleteComment}
          />
        ))}
      </div>

      {loadingMore && (
        <p className="text-center mt-4 text-gray-500">
          Loading more...
        </p>
      )}

      {!hasMore && (
        <p className="text-center mt-4 text-gray-400">
          No more posts
        </p>
      )}
    </div>
  );
}