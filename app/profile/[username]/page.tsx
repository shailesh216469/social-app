"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function ProfilePage() {
  const params = useParams();
  const username = params.username as string;

  const [profile, setProfile] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    const fetchData = async () => {
      // Get logged in user
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);

      // Get profile by username
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("username", username)
        .single();

      if (data) {
        setProfile(data);

        // Get posts
        const { data: userPosts } = await supabase
          .from("posts")
          .select("*")
          .eq("user_id", data.id)
          .order("created_at", { ascending: false });

        if (userPosts) setPosts(userPosts);
      }
    };

    fetchData();
  }, [username]);

  // 🔥 UPDATED SAFE FRIEND LOGIC
  const handleAddFriend = async () => {
    if (!currentUser) {
      alert("Login first");
      return;
    }

    if (currentUser.id === profile.id) {
      alert("You cannot add yourself");
      return;
    }

    // 1️⃣ Check if already friends
    const { data: existingFriendship } = await supabase
      .from("friendships")
      .select("*")
      .or(
        `and(user_id_1.eq.${currentUser.id},user_id_2.eq.${profile.id}),
         and(user_id_1.eq.${profile.id},user_id_2.eq.${currentUser.id})`
      )
      .maybeSingle();

    if (existingFriendship) {
      alert("You are already friends");
      return;
    }

    // 2️⃣ Check if request already sent
    const { data: existingRequest } = await supabase
      .from("friend_requests")
      .select("*")
      .eq("sender_id", currentUser.id)
      .eq("receiver_id", profile.id)
      .maybeSingle();

    if (existingRequest) {
      alert("Friend request already sent");
      return;
    }

    // 3️⃣ Send new request
    const { error } = await supabase.from("friend_requests").insert({
      sender_id: currentUser.id,
      receiver_id: profile.id,
    });

    if (error) {
      alert(error.message);
    } else {
      alert("Friend request sent!");
    }
  };

  if (!profile) return <p className="p-6">Loading...</p>;

  return (
    <div className="min-h-screen p-6 max-w-xl mx-auto">
      <div className="border p-4 mb-6">
        <h1 className="text-2xl font-bold">@{profile.username}</h1>

        {/* Show Edit on own profile */}
        {currentUser && currentUser.id === profile.id && (
          <Link
            href="/edit-profile"
            className="inline-block mt-2 text-sm text-blue-600"
          >
            Edit Profile
          </Link>
        )}

        {/* Show Add Friend on other profiles */}
        {currentUser && currentUser.id !== profile.id && (
          <button
            onClick={handleAddFriend}
            className="mt-3 bg-blue-600 text-white px-4 py-2 rounded"
          >
            Add Friend
          </button>
        )}

        <p className="mt-2">{profile.full_name}</p>
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