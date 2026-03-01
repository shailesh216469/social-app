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
  const [isFriend, setIsFriend] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);

      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("username", username)
        .single();

      if (!data) return;

      setProfile(data);

      // Load posts
      const { data: userPosts } = await supabase
        .from("posts")
        .select("*")
        .eq("user_id", data.id)
        .order("created_at", { ascending: false });

      if (userPosts) setPosts(userPosts);

      // 🔥 Correct friendship check
      if (user) {
        const { data: friendships } = await supabase
          .from("friendships")
          .select("*")
          .or(`user_id_1.eq.${user.id},user_id_2.eq.${user.id}`);

        if (friendships) {
          const match = friendships.some(
            (f: any) =>
              (f.user_id_1 === user.id && f.user_id_2 === data.id) ||
              (f.user_id_1 === data.id && f.user_id_2 === user.id)
          );

          if (match) setIsFriend(true);
        }
      }
    };

    fetchData();
  }, [username]);

  // ✅ SAFE UNFRIEND (NO LOGIC TREE ERROR)
  const handleUnfriend = async () => {
    if (!currentUser) return;

    // Try delete A -> B
    await supabase
      .from("friendships")
      .delete()
      .match({
        user_id_1: currentUser.id,
        user_id_2: profile.id,
      });

    // Try delete B -> A
    await supabase
      .from("friendships")
      .delete()
      .match({
        user_id_1: profile.id,
        user_id_2: currentUser.id,
      });

    alert("Unfriended successfully");
    setIsFriend(false);
  };

  // ✅ SAFE ADD FRIEND
  const handleAddFriend = async () => {
    if (!currentUser) {
      alert("Login first");
      return;
    }

    if (currentUser.id === profile.id) {
      alert("You cannot add yourself");
      return;
    }

    // Check if already friends
    const { data: friendships } = await supabase
      .from("friendships")
      .select("*")
      .or(`user_id_1.eq.${currentUser.id},user_id_2.eq.${currentUser.id}`);

    if (friendships) {
      const match = friendships.some(
        (f: any) =>
          (f.user_id_1 === currentUser.id && f.user_id_2 === profile.id) ||
          (f.user_id_1 === profile.id && f.user_id_2 === currentUser.id)
      );

      if (match) {
        alert("You are already friends");
        return;
      }
    }

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

        {/* Edit own profile */}
        {currentUser && currentUser.id === profile.id && (
          <Link
            href="/edit-profile"
            className="inline-block mt-2 text-sm text-blue-600"
          >
            Edit Profile
          </Link>
        )}

        {/* Show Unfriend if friends */}
        {currentUser &&
          currentUser.id !== profile.id &&
          isFriend && (
            <button
              onClick={handleUnfriend}
              className="mt-3 bg-red-600 text-white px-4 py-2 rounded"
            >
              Unfriend
            </button>
          )}

        {/* Show Add Friend if not friends */}
        {currentUser &&
          currentUser.id !== profile.id &&
          !isFriend && (
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