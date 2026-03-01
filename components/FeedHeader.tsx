"use client";

import Link from "next/link";

export default function FeedHeader({
  pendingCount,
  onLogout,
}: {
  pendingCount: number;
  onLogout: () => void;
}) {
  return (
    <div className="flex justify-between mb-6">
      <h1 className="text-2xl font-bold">Feed</h1>

      <div className="flex gap-4 items-center">
        <Link href="/friends" className="text-blue-600 relative">
          Friends
          {pendingCount > 0 && (
            <span className="ml-1 bg-red-600 text-white text-xs px-2 py-1 rounded-full">
              {pendingCount}
            </span>
          )}
        </Link>

        <button
          onClick={onLogout}
          className="bg-black text-white px-4 py-2"
        >
          Logout
        </button>
      </div>
    </div>
  );
}