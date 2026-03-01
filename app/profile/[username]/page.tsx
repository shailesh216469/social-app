"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function ProfilePage() {
  const params = useParams();
  const username = params.username as string;

  const [profile, setProfile] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);

  useEffect(() => {
    const fetchProfile = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("username", username)
        .single();

      if (data) {
        setProfile(data);

        const { data: userPosts } = await supabase
          .from("posts")
          .select("*")
          .eq("user_id", data.id)
          .order("created_at", { ascending: false });

        if (userPosts) setPosts(userPosts);
      }
    };

    fetchProfile();
  }, [username]);

  if (!profile) return <p className="p-6">Loading...</p>;

  return (
    <div className="min-h-screen p-6 max-w-xl mx-auto">
      <div className="border p-4 mb-6">
        <h1 className="text-2xl font-bold">@{profile.username}</h1>
        <p>{profile.full_name}</p>
        <p className="text-gray-500">{profile.bio}</p>
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