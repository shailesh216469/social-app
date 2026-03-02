"use client";

import Link from "next/link";
import { useState } from "react";

type CommentType = {
  id: string;
  content: string;
  user_id: string;
  created_at: string;
  profiles: { username: string } | null;
  optimistic?: boolean;
};

type PostType = {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  profiles: { username: string } | null;
  likeCount: number;
  likedByMe: boolean;
  comments: CommentType[];
};

export default function PostCard({
  post,
  currentUserId,
  onLikeToggle,
  onAddComment,
  onDeleteComment,
}: {
  post: PostType;
  currentUserId: string;
  onLikeToggle: (postId: string, liked: boolean) => void;
  onAddComment: (postId: string, text: string) => void;
  onDeleteComment: (commentId: string) => void;
}) {
  const [commentText, setCommentText] = useState<string>("");

  return (
    <div className="border p-4 rounded-lg shadow-sm bg-white">

      {/* USERNAME */}
      <Link
        href={`/profile/${post.profiles?.username}`}
        className="font-bold text-blue-600 hover:underline"
      >
        {post.profiles?.username}
      </Link>

      {/* POST CONTENT */}
      <p className="mt-2">{post.content}</p>

      {/* LIKE SECTION */}
<div className="flex items-center gap-4 mt-3">
  <button
    onClick={() => onLikeToggle(post.id, post.likedByMe)}
    className="relative px-3 py-1 rounded transition"
  >
    <span
      className={`inline-block transition-transform duration-300 ${
        post.likedByMe
          ? "text-red-600 scale-125 animate-heartPop"
          : "text-gray-600"
      }`}
    >
      {post.likedByMe ? "❤️" : "🤍"}
    </span>
  </button>

  <span className="text-gray-600 text-sm">
    {post.likeCount} likes
  </span>
</div>

      {/* COMMENTS */}
      <div className="mt-4 space-y-3">

        {post.comments?.map((comment) => (
          <div
            key={comment.id}
            className={`p-2 rounded bg-gray-100 transition ${
              comment.optimistic ? "opacity-50 italic" : ""
            }`}
          >
            <div className="flex justify-between items-center">
              <span className="font-bold text-sm">
                {comment.profiles?.username}
              </span>

              {!comment.optimistic &&
                currentUserId === comment.user_id && (
                  <button
                    onClick={() => onDeleteComment(comment.id)}
                    className="text-red-500 text-xs hover:underline"
                  >
                    Delete
                  </button>
                )}
            </div>

            <p className="text-sm">{comment.content}</p>

            {comment.optimistic && (
              <p className="text-xs text-gray-400 mt-1">
                Sending...
              </p>
            )}
          </div>
        ))}

        {/* ADD COMMENT */}
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Write a comment..."
            className="border p-2 flex-1 text-sm rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
          />

          <button
            onClick={() => {
              if (!commentText.trim()) return;
              onAddComment(post.id, commentText);
              setCommentText("");
            }}
            className="bg-blue-600 text-white px-3 text-sm rounded hover:bg-blue-700 transition"
          >
            Post
          </button>
        </div>
      </div>

      {/* TIME */}
      <small className="text-gray-500 block mt-3">
        {new Date(post.created_at).toLocaleString()}
      </small>
    </div>
  );
}