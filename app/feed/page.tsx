"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

export default function FeedPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [pendingCount, setPendingCount] = useState(0);

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

  const fetchPendingRequests = async (currentUser: any) => {
    const { count } = await supabase
      .from("friend_requests")
      .select("*", { count: "exact", head: true })
      .eq("receiver_id", currentUser.id)
      .eq("status", "pending");

    setPendingCount(count || 0);
  };

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
        profiles(username),
        post_likes(user_id)
      `)
      .in("user_id", friendIds)
      .order("created_at", { ascending: false });

    if (data) {
      const formatted = data.map((post: any) => ({
        ...post,
        likeCount: post.post_likes.length,
        likedByMe: post.post_likes.some(
          (like: any) => like.user_id === currentUser.id
        ),
      }));

      setPosts(formatted);
    }
  };

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

    fetchPosts(user);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <div className="min-h-screen p-6 max-w-xl mx-auto">
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

      <div className="space-y-4">
        {posts.map((post) => (
          <div key={post.id} className="border p-4">
            <Link
              href={`/profile/${post.profiles?.username}`}
              className="font-bold text-blue-600"
            >
              {post.profiles?.username}
            </Link>

            <p className="mt-2">{post.content}</p>

            <div className="flex items-center gap-4 mt-3">
              <button
                onClick={() => toggleLike(post.id, post.likedByMe)}
                className={`px-3 py-1 rounded ${
                  post.likedByMe
                    ? "bg-red-600 text-white"
                    : "bg-gray-200"
                }`}
              >
                {post.likedByMe ? "Unlike ❤️" : "Like 🤍"}
              </button>

              <span className="text-gray-600 text-sm">
                {post.likeCount} likes
              </span>
            </div>

            <small className="text-gray-500 block mt-2">
              {new Date(post.created_at).toLocaleString()}
            </small>
          </div>
        ))}
      </div>
    </div>
  );
}