"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

export default function FeedPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [content, setContent] = useState("");
  const [posts, setPosts] = useState<any[]>([]);

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getUser();

      if (!data.user) {
        router.push("/login");
        return;
      }

      setUser(data.user);
      await fetchPosts(data.user);
    };

    init();
  }, [router]);

  const fetchPosts = async (currentUser: any) => {
    if (!currentUser) return;

    // 1️⃣ Get friendships
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

    // Include self
    friendIds.push(currentUser.id);

    // 2️⃣ Fetch posts from friends + self
    const { data } = await supabase
      .from("posts")
      .select(`
        id,
        content,
        created_at,
        profiles (
          username
        )
      `)
      .in("user_id", friendIds)
      .order("created_at", { ascending: false });

    if (data) setPosts(data);
  };

  const handleCreatePost = async () => {
    if (!content.trim() || !user) return;

    const { error } = await supabase.from("posts").insert({
      content,
      user_id: user.id,
    });

    if (error) {
      alert(error.message);
      return;
    }

    setContent("");
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
        <div className="flex gap-3">
          <Link href="/friends" className="text-blue-600">
            Friends
          </Link>
          <button
            onClick={handleLogout}
            className="bg-black text-white px-4 py-2"
          >
            Logout
          </button>
        </div>
      </div>

      <div className="border p-4 mb-6">
        <textarea
          placeholder="What's on your mind?"
          className="w-full border p-2 mb-2"
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />
        <button
          onClick={handleCreatePost}
          className="bg-black text-white px-4 py-2"
        >
          Post
        </button>
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
            <p>{post.content}</p>
            <small className="text-gray-500">
              {new Date(post.created_at).toLocaleString()}
            </small>
          </div>
        ))}
      </div>
    </div>
  );
}