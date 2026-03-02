"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import CreatePost from "@/components/CreatePost";
import PostCard from "@/components/PostCard";
import SearchUsers from "@/components/SearchUsers";
import FeedHeader from "@/components/FeedHeader";

type NotificationType = {
  id: string;
  type: string;
  actor_username: string;
  is_read: boolean;
};

export default function FeedPage() {
  const router = useRouter();

  const [user, setUser] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [notificationCount, setNotificationCount] = useState(0);
  const [notifications, setNotifications] = useState<NotificationType[]>([]);

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
        comments(id)
      `)
      .order("created_at", { ascending: false });

    if (!data) return;

    const formatted = data.map((post: any) => ({
      ...post,
      profiles: Array.isArray(post.profiles)
        ? post.profiles[0]
        : post.profiles,
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
    const { data } = await supabase
      .from("notifications")
      .select(`
        id,
        type,
        is_read,
        actor_id,
        profiles:actor_id(username)
      `)
      .eq("user_id", currentUser.id)
      .order("created_at", { ascending: false });

    if (!data) return;

    const formatted = data.map((n: any) => ({
      id: n.id,
      type: n.type,
      is_read: n.is_read,
      actor_username: Array.isArray(n.profiles)
        ? n.profiles[0]?.username
        : n.profiles?.username,
    }));

    setNotifications(formatted);
    setNotificationCount(
      formatted.filter((n) => !n.is_read).length
    );
  };

  /* ---------------- REALTIME ---------------- */

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

  /* ---------------- LIKE ---------------- */

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

  /* ---------------- COMMENT ---------------- */

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

  const markNotificationsRead = async (id?: string) => {
    if (!user) return;

    if (id) {
      await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("id", id);
    } else {
      await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("user_id", user.id);
    }

    await fetchNotifications(user);
  };

  return (
    <div className="min-h-screen p-6 max-w-xl mx-auto">
      {user && (
        <FeedHeader
          pendingCount={pendingCount}
          notificationCount={notificationCount}
          notifications={notifications}
          onLogout={handleLogout}
          onMarkRead={markNotificationsRead}
        />
      )}

      {posts.map((post) => (
        <PostCard
          key={post.id}
          post={post}
          currentUserId={user?.id}
          onLikeToggle={toggleLike}
          onAddComment={addComment}
          onDeleteComment={() => {}}
        />
      ))}
    </div>
  );
}