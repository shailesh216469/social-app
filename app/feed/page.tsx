"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function FeedPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const getUser = async () => {
      const { data } = await supabase.auth.getUser();

      if (!data.user) {
        router.push("/login");
      } else {
        setUser(data.user);
      }
    };

    getUser();
  }, [router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <div className="min-h-screen p-6">
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

      <div className="border p-4">
        <p>Post feature coming next...</p>
      </div>
    </div>
  );
}