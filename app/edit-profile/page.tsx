"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function EditProfile() {
  const router = useRouter();

  const [user, setUser] = useState<any>(null);
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");

  useEffect(() => {
    const getProfile = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      setUser(user);

      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (data) {
        setFullName(data.full_name || "");
        setUsername(data.username || "");
        setBio(data.bio || "");
      }
    };

    getProfile();
  }, []);

  const handleUpdate = async () => {
  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: fullName,
      username: username,
      bio: bio,
    })
    .eq("id", user.id);

  if (error) {
    alert(error.message);
    return;
  }

  router.push(`/profile/${username}`);
};

  return (
    <div className="min-h-screen p-6 max-w-xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Edit Profile</h1>

      <input
        type="text"
        placeholder="Full Name"
        className="w-full border p-2 mb-4"
        value={fullName}
        onChange={(e) => setFullName(e.target.value)}
      />

      <input
        type="text"
        placeholder="Username"
        className="w-full border p-2 mb-4"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
      />

      <textarea
        placeholder="Bio"
        className="w-full border p-2 mb-4"
        value={bio}
        onChange={(e) => setBio(e.target.value)}
      />

      <button
        onClick={handleUpdate}
        className="bg-black text-white px-4 py-2"
      >
        Save Changes
      </button>
    </div>
  );
}