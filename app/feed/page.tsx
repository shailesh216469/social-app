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

  /* ---------------- INIT ---------------- */

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getUser();

      if (!data.user) {
        router.push("/login");
        return;
      }

      setUser(data.user);
      await fetchPosts(data.user);
      await fetchPendingRequests(data.user);
    };

    init();
  }, [router]);

  /* ---------------- FETCH POSTS ---------------- */

  const fetchPosts = async (currentUser: any) => {
    const { data } = await supabase
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
      .order("created_at", { ascending: false })
      .limit(PAGE_SIZE);

    if (!data) return;

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

    setPosts(formatted);
  };

  /* ---------------- REALTIME LIKES ---------------- */

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("likes-channel")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "post_likes" },
        async (payload: any) => {
          const postId =
            payload.eventType === "DELETE"
              ? payload.old?.post_id
              : payload.new?.post_id;

          if (!postId) return;

          const { data } = await supabase.rpc(
            "get_post_like_stats",
            {
              post_uuid: postId,
              current_user_uuid: user.id,
            }
          );

          if (!data || data.length === 0) return;

          const stats = data[0];

          setPosts((prev) =>
            prev.map((post) =>
              post.id === postId
                ? {
                    ...post,
                    likeCount: Number(stats.like_count),
                    likedByMe: stats.liked_by_me,
                  }
                : post
            )
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  /* ---------------- TOGGLE LIKE ---------------- */

  const toggleLike = async (postId: string, liked: boolean) => {
    if (!user) return;

    // Optimistic update
    setPosts((prev) =>
      prev.map((post) =>
        post.id === postId
          ? {
              ...post,
              likedByMe: !liked,
              likeCount: liked
                ? Math.max(post.likeCount - 1, 0)
                : post.likeCount + 1,
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
        .insert({
          post_id: postId,
          user_id: user.id,
        });
    }
  };

  /* ---------------- ADD COMMENT ---------------- */

  const addComment = async (postId: string, text: string) => {
    if (!user || !text.trim()) return;

    await supabase.from("comments").insert({
      post_id: postId,
      user_id: user.id,
      content: text,
    });
  };

  /* ---------------- DELETE COMMENT ---------------- */

  const deleteComment = async (commentId: string) => {
    if (!user) return;
    await supabase.from("comments").delete().eq("id", commentId);
  };

  /* ---------------- FRIEND REQUEST COUNT ---------------- */

  const fetchPendingRequests = async (currentUser: any) => {
    const { count } = await supabase
      .from("friend_requests")
      .select("*", { count: "exact", head: true })
      .eq("receiver_id", currentUser.id)
      .eq("status", "pending");

    setPendingCount(count || 0);
  };

  /* ---------------- LOGOUT ---------------- */

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
          onPostCreated={() => fetchPosts(user)}
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
    </div>
  );
}