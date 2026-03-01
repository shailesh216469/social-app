"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function FriendsPage() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [requests, setRequests] = useState<any[]>([]);

  useEffect(() => {
    const fetchRequests = async () => {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) return;

      setCurrentUser(user);

      const { data } = await supabase
        .from("friend_requests")
        .select(`
          id,
          sender_id,
          profiles!friend_requests_sender_id_fkey (
            username
          )
        `)
        .eq("receiver_id", user.id)
        .eq("status", "pending");

      if (data) setRequests(data);
    };

    fetchRequests();
  }, []);

  const handleAccept = async (requestId: string) => {
    const { error } = await supabase
      .from("friend_requests")
      .update({ status: "accepted" })
      .eq("id", requestId);

    if (error) {
      alert(error.message);
    } else {
      alert("Friend request accepted!");
      window.location.reload();
    }
  };

  return (
    <div className="min-h-screen p-6 max-w-xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Friend Requests</h1>

      {requests.length === 0 && <p>No pending requests</p>}

      {requests.map((req) => (
        <div key={req.id} className="border p-4 mb-4 flex justify-between items-center">
          <p>{req.profiles?.username}</p>
          <button
            onClick={() => handleAccept(req.id)}
            className="bg-green-600 text-white px-3 py-1 rounded"
          >
            Accept
          </button>
        </div>
      ))}
    </div>
  );
}