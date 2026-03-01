"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function FeedPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [content, setContent] = useState("");
  const [posts, setPosts] = useState<any[]>([]);

  useEffect(() => {
    const getUser = async () => {
      const { data } = await supabase.auth.getUser();

      if (!data.user) {
        router.push("/login");
      } else {
        setUser(data.user);
        fetchPosts();
      }
    };

    getUser();
  }, [router]);

  const fetchPosts = async () => {
    const { data } = await supabase
      .from("posts")
      .select("*")
      .order("created_at", { ascending: false });

    if (data) setPosts(data);
  };

  const handleCreatePost = async () => {
    if (!content.trim()) return;

    await supabase.from("posts").insert([
      {
        content,
        user_id: user.id,
      },
    ]);

    setContent("");
    fetchPosts();
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <div className="min-h-screen p-6 max-w-xl mx-auto">
      <div className="flex justify-between mb-6">
        <h1 className="text-2xl font-bold">Feed</h1>
        <button
          onClick={handleLogout}
          className="bg-black text-white px-4 py-2"
        >
          Logout
        </button>
      </div>

      {user && (
        <p className="mb-4">
          Logged in as: <strong>{user.email}</strong>
        </p>
      )}

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