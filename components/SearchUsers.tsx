"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

export default function SearchUsers({
  currentUserId,
}: {
  currentUserId: string;
}) {
  const [search, setSearch] = useState<string>("");
  const [results, setResults] = useState<any[]>([]);

  const handleSearch = async () => {
    if (!search.trim()) return;

    const { data } = await supabase
      .from("profiles")
      .select("id, username")
      .ilike("username", `%${search}%`);

    if (data) setResults(data);
  };

  const handleAddFriend = async (profileId: string) => {
    if (profileId === currentUserId) return;

    await supabase.from("friend_requests").insert({
      sender_id: currentUserId,
      receiver_id: profileId,
      status: "pending",
    });

    alert("Friend request sent!");
  };

  return (
    <div className="border p-4 mb-6">
      <input
        type="text"
        placeholder="Search users..."
        className="border p-2 w-full mb-2"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <button
        onClick={handleSearch}
        className="bg-blue-600 text-white px-4 py-2"
      >
        Search
      </button>

      {results.map((r) => (
        <div key={r.id} className="flex justify-between mt-3 border p-2">
          <Link href={`/profile/${r.username}`}>
            {r.username}
          </Link>

          <button
            onClick={() => handleAddFriend(r.id)}
            className="bg-green-600 text-white px-3 py-1"
          >
            Add
          </button>
        </div>
      ))}
    </div>
  );
}