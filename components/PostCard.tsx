"use client";

import Link from "next/link";
import { useState } from "react";

type CommentType = {
  id: string;
  content: string;
  user_id: string;
  created_at: string;
  profiles: { username: string } | null;
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
  const [commentText, setCommentText] = useState("");

  return (
    <div
      id={`post-${post.id}`}
      className="border p-4 rounded-lg shadow-sm bg-white transition-all duration-500"
    >
      {/* USERNAME */}
      <Link
        href={`/profile/${post.profiles?.username}`}
        className="font-bold text-blue-600 hover:underline"
      >
        {post.profiles?.username}
      </Link>

      {/* CONTENT */}
      <p className="mt-2">{post.content}</p>

      {/* LIKE */}
      <div className="flex items-center gap-4 mt-3">
        <button
          onClick={() => onLikeToggle(post.id, post.likedByMe)}
          className="px-3 py-1 rounded bg-gray-200 hover:bg-gray-300"
        >
          {post.likedByMe ? "Unlike ❤️" : "Like 🤍"}
        </button>

        <span className="text-gray-600 text-sm">
          {post.likeCount} likes
        </span>
      </div>

      {/* COMMENTS */}
      <div className="mt-4 space-y-3">
        {post.comments?.map((comment) => (
          <div key={comment.id} className="p-2 rounded bg-gray-100">
            <div className="flex justify-between">
              <span className="font-bold text-sm">
                {comment.profiles?.username}
              </span>

              {currentUserId === comment.user_id && (
                <button
                  onClick={() => onDeleteComment(comment.id)}
                  className="text-red-500 text-xs"
                >
                  Delete
                </button>
              )}
            </div>

            <p className="text-sm">{comment.content}</p>
          </div>
        ))}

        {/* ADD COMMENT */}
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Write a comment..."
            className="border p-2 flex-1 text-sm rounded"
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
          />

          <button
            onClick={() => {
              if (!commentText.trim()) return;
              onAddComment(post.id, commentText);
              setCommentText("");
            }}
            className="bg-blue-600 text-white px-3 text-sm rounded"
          >
            Post
          </button>
        </div>
      </div>

      <small className="text-gray-500 block mt-3">
        {new Date(post.created_at).toLocaleString()}
      </small>
    </div>
  );
}