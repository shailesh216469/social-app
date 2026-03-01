"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import CreatePost from "@/components/CreatePost";

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
  post_likes: { user_id: string }[];
  comments: CommentType[];
  likeCount: number;
  likedByMe: boolean;
};

export default function FeedPage() {
  const router = useRouter();

  const [user, setUser] = useState<any>(null);
  const [posts, setPosts] = useState<PostType[]>([]);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [search, setSearch] = useState<string>("");
  const [results, setResults] = useState<any[]>([]);

  /* ---------------- INITIAL LOAD ---------------- */

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        router.push("/login");
        return;
      }

      setUser(data.user);
      await fetchPosts(data.user);
      await fetchPendingRequests(data.user);
    };

    init();
  }, [router]);

  /* ---------------- FETCH POSTS ---------------- */

  const fetchPosts = async (currentUser: any) => {
    const { data: friendships } = await supabase
      .from("friendships")
      .select("*")
      .or(`user_id_1.eq.${currentUser.id},user_id_2.eq.${currentUser.id}`);

    let friendIds: string[] = [];

    if (friendships) {
      friendIds = friendships.map((f: any) =>
        f.user_id_1 === currentUser.id ? f.user_id_2 : f.user_id_1
      );
    }

    friendIds.push(currentUser.id);

    const { data } = await supabase
      .from("posts")
      .select(`
        id,
        content,
        created_at,
        user_id,
        profiles(username),
        post_likes(user_id),
        comments(
          id,
          content,
          user_id,
          created_at,
          profiles(username)
        )
      `)
      .in("user_id", friendIds)
      .order("created_at", { ascending: false });

    if (!data) return;

    const formatted: PostType[] = data.map((post: any) => ({
      ...post,
      comments: post.comments || [],
      likeCount: post.post_likes?.length || 0,
      likedByMe:
        post.post_likes?.some(
          (like: any) => like.user_id === currentUser.id
        ) || false,
    }));

    setPosts(formatted);
  };

  /* ---------------- REALTIME (COMMENTS + LIKES) ---------------- */

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("social-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "comments" },
        () => fetchPosts(user)
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "post_likes" },
        () => fetchPosts(user)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  /* ---------------- LIKE ---------------- */

  const toggleLike = async (postId: string, liked: boolean) => {
    if (!user) return;

    if (liked) {
      await supabase
        .from("post_likes")
        .delete()
        .match({ post_id: postId, user_id: user.id });
    } else {
      await supabase
        .from("post_likes")
        .insert({ post_id: postId, user_id: user.id });
    }
  };

  /* ---------------- COMMENTS ---------------- */

  const addComment = async (postId: string, text: string) => {
    if (!user || !text.trim()) return;

    await supabase.from("comments").insert({
      post_id: postId,
      user_id: user.id,
      content: text,
    });
  };

  const deleteComment = async (commentId: string) => {
    if (!user) return;

    await supabase.from("comments").delete().eq("id", commentId);
  };

  /* ---------------- FRIEND REQUEST BADGE ---------------- */

  const fetchPendingRequests = async (currentUser: any) => {
    const { count } = await supabase
      .from("friend_requests")
      .select("*", { count: "exact", head: true })
      .eq("receiver_id", currentUser.id)
      .eq("status", "pending");

    setPendingCount(count || 0);
  };

  /* ---------------- SEARCH ---------------- */

  const handleSearch = async () => {
    if (!search.trim()) return;

    const { data } = await supabase
      .from("profiles")
      .select("id, username")
      .ilike("username", `%${search}%`);

    if (data) setResults(data);
  };

  const handleAddFriend = async (profileId: string) => {
    if (!user || profileId === user.id) return;

    await supabase.from("friend_requests").insert({
      sender_id: user.id,
      receiver_id: profileId,
      status: "pending",
    });

    alert("Friend request sent!");
  };

  /* ---------------- LOGOUT ---------------- */

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  /* ---------------- UI ---------------- */

  return (
    <div className="min-h-screen p-6 max-w-xl mx-auto">

      {/* HEADER */}
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
            onClick={handleLogout}
            className="bg-black text-white px-4 py-2"
          >
            Logout
          </button>
        </div>
      </div>

      {/* CREATE POST COMPONENT */}
      {user && (
        <CreatePost
          userId={user.id}
          onPostCreated={() => fetchPosts(user)}
        />
      )}

      {/* SEARCH */}
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

      {/* POSTS */}
      <div className="space-y-6">
        {posts.map((post) => (
          <div key={post.id} className="border p-4">

            <Link
              href={`/profile/${post.profiles?.username}`}
              className="font-bold text-blue-600"
            >
              {post.profiles?.username}
            </Link>

            <p className="mt-2">{post.content}</p>

            {/* LIKE */}
            <div className="flex items-center gap-4 mt-3">
              <button
                onClick={() => toggleLike(post.id, post.likedByMe)}
                className={`px-3 py-1 rounded ${
                  post.likedByMe
                    ? "bg-red-600 text-white"
                    : "bg-gray-200"
                }`}
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
                <div key={comment.id} className="bg-gray-100 p-2 rounded">
                  <div className="flex justify-between">
                    <span className="font-bold text-sm">
                      {comment.profiles?.username}
                    </span>

                    {user?.id === comment.user_id && (
                      <button
                        onClick={() => deleteComment(comment.id)}
                        className="text-red-500 text-xs"
                      >
                        Delete
                      </button>
                    )}
                  </div>

                  <p className="text-sm">{comment.content}</p>
                </div>
              ))}

              <AddCommentInput
                onSubmit={(text: string) =>
                  addComment(post.id, text)
                }
              />
            </div>

            <small className="text-gray-500 block mt-2">
              {new Date(post.created_at).toLocaleString()}
            </small>
          </div>
        ))}
      </div>
    </div>
  );
}

/* COMMENT INPUT COMPONENT */
function AddCommentInput({
  onSubmit,
}: {
  onSubmit: (text: string) => void;
}) {
  const [text, setText] = useState<string>("");

  return (
    <div className="flex gap-2">
      <input
        type="text"
        placeholder="Write a comment..."
        className="border p-2 flex-1 text-sm"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <button
        onClick={() => {
          if (!text.trim()) return;
          onSubmit(text);
          setText("");
        }}
        className="bg-blue-600 text-white px-3 text-sm"
      >
        Post
      </button>
    </div>
  );
}