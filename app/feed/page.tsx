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
  optimistic?: boolean;
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

export default function FeedPage() {
  const router = useRouter();

  const [user, setUser] = useState<any>(null);
  const [posts, setPosts] = useState<PostType[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [notificationCount, setNotificationCount] = useState(0);

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
      await fetchNotifications(data.user);
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
      .order("created_at", { ascending: false });

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

  /* ---------------- FETCH NOTIFICATIONS ---------------- */

  const fetchNotifications = async (currentUser: any) => {
    const { count } = await supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", currentUser.id)
      .eq("is_read", false);

    setNotificationCount(count || 0);
  };

  /* ---------------- REALTIME NOTIFICATIONS ---------------- */

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("notifications-channel")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        async () => {
          await fetchNotifications(user);
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

    const post = posts.find((p) => p.id === postId);
    if (!post) return;

    if (liked) {
      await supabase
        .from("post_likes")
        .delete()
        .match({ post_id: postId, user_id: user.id });
    } else {
      await supabase
        .from("post_likes")
        .insert({ post_id: postId, user_id: user.id });

      if (post.user_id !== user.id) {
        await supabase.from("notifications").insert({
          user_id: post.user_id,
          actor_id: user.id,
          post_id: postId,
          type: "like",
        });
      }
    }

    await fetchPosts(user);
  };

  /* ---------------- ADD COMMENT ---------------- */

  const addComment = async (postId: string, text: string) => {
    if (!user || !text.trim()) return;

    const post = posts.find((p) => p.id === postId);
    if (!post) return;

    await supabase.from("comments").insert({
      post_id: postId,
      user_id: user.id,
      content: text,
    });

    if (post.user_id !== user.id) {
      await supabase.from("notifications").insert({
        user_id: post.user_id,
        actor_id: user.id,
        post_id: postId,
        type: "comment",
      });
    }

    await fetchPosts(user);
  };

  const deleteComment = async (commentId: string) => {
    await supabase.from("comments").delete().eq("id", commentId);
    await fetchPosts(user);
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

  const markNotificationsRead = async () => {
    if (!user) return;

    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", user.id);

    setNotificationCount(0);
  };

  return (
    <div className="min-h-screen p-6 max-w-xl mx-auto">

      {user && (
        <FeedHeader
          pendingCount={pendingCount}
          notificationCount={notificationCount}
          onLogout={handleLogout}
          onOpenNotifications={markNotificationsRead}
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