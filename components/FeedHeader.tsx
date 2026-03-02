"use client";

import Link from "next/link";

export default function FeedHeader({
  pendingCount,
  notificationCount,
  onLogout,
  onOpenNotifications,
}: {
  pendingCount: number;
  notificationCount: number;
  onLogout: () => void;
  onOpenNotifications: () => void;
}) {
  return (
    <div className="flex justify-between items-center mb-6">
      <h1 className="text-xl font-bold">Social App</h1>

      <div className="flex gap-6 items-center">

        {/* Friend Requests */}
        <Link href="/friends" className="relative text-xl">
          👥
          {pendingCount > 0 && (
            <span className="absolute -top-2 -right-3 bg-red-600 text-white text-xs px-2 rounded-full">
              {pendingCount}
            </span>
          )}
        </Link>

        {/* Notifications */}
        <button
          onClick={onOpenNotifications}
          className="relative text-xl"
        >
          🔔
          {notificationCount > 0 && (
            <span className="absolute -top-2 -right-3 bg-red-600 text-white text-xs px-2 rounded-full animate-pulse">
              {notificationCount}
            </span>
          )}
        </button>

        <button
          onClick={onLogout}
          className="text-sm text-gray-600"
        >
          Logout
        </button>
      </div>
    </div>
  );
}