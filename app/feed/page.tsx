"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import CreatePost from "@/components/CreatePost";
import PostCard from "@/components/PostCard";
import SearchUsers from "@/components/SearchUsers";

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
  post_likes: { user_id: string }[];
  comments: CommentType[];
  likeCount: number;
  likedByMe: boolean;
};

export default function FeedPage() {
  const router = useRouter();

  const [user, setUser] = useState<any>(null);
  const [posts, setPosts] = useState<PostType[]>([]);
  const [pendingCount, setPendingCount] = useState<number>(0);

  /* ---------------- INITIAL LOAD ---------------- */

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
      .in("user_id", friendIds)
      .order("created_at", { ascending: false });

    if (!data) return;

    const formatted: PostType[] = data.map((post: any) => ({
      ...post,
      comments: post.comments || [],
      likeCount: post.post_likes?.length || 0,
      likedByMe:
        post.post_likes?.some(
          (like: any) => like.user_id === currentUser.id
        ) || false,
    }));

    setPosts(formatted);
  };

  /* ---------------- REALTIME ---------------- */

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("social-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "comments" },
        () => fetchPosts(user)
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "post_likes" },
        () => fetchPosts(user)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  /* ---------------- ACTION HANDLERS ---------------- */

  const toggleLike = async (postId: string, liked: boolean) => {
    if (!user) return;

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

  /* ---------------- UI ---------------- */

  return (
    <div className="min-h-screen p-6 max-w-xl mx-auto">

      {/* HEADER */}
      <div className="flex justify-between mb-6">
        <h1 className="text-2xl font-bold">Feed</h1>

        <div className="flex gap-4 items-center">
          <Link href="/friends" className="text-blue-600 relative">
            Friends
            {pendingCount > 0 && (
              <span className="ml-1 bg-red-600 text-white text-xs px-2 py-1 rounded-full">
                {pendingCount}
              </span>
            )}
          </Link>

          <button
            onClick={handleLogout}
            className="bg-black text-white px-4 py-2"
          >
            Logout
          </button>
        </div>
      </div>

      {/* CREATE POST */}
      {user && (
        <CreatePost
          userId={user.id}
          onPostCreated={() => fetchPosts(user)}
        />
      )}

      {/* SEARCH USERS COMPONENT */}
      {user && <SearchUsers currentUserId={user.id} />}

      {/* POSTS */}
      <div className="space-y-6">
        {user &&
          posts.map((post) => (
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