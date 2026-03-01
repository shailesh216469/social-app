"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function CreatePost({
  userId,
  onPostCreated,
}: {
  userId: string;
  onPostCreated: () => void;
}) {
  const [content, setContent] = useState<string>("");

  const handleCreatePost = async () => {
    if (!content.trim()) return;

    await supabase.from("posts").insert({
      content,
      user_id: userId,
    });

    setContent("");
    onPostCreated(); // notify parent to refresh feed
  };

  return (
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
  );
}