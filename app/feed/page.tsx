"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import CreatePost from "@/components/CreatePost";
import PostCard from "@/components/PostCard";
import SearchUsers from "@/components/SearchUsers";
import FeedHeader from "@/components/FeedHeader";

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

const PAGE_SIZE = 5;

export default function FeedPage() {
  const router = useRouter();

  const [user, setUser] = useState<any>(null);
  const [posts, setPosts] = useState<PostType[]>([]);
  const [pendingCount, setPendingCount] = useState<number>(0);

  const [page, setPage] = useState<number>(0);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);

  /* ---------------- INITIAL LOAD ---------------- */

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        router.push("/login");
        return;
      }

      setUser(data.user);
      await fetchPosts(data.user, 0, false);
      await fetchPendingRequests(data.user);
    };

    init();
  }, [router]);

  /* ---------------- FETCH POSTS WITH PAGINATION ---------------- */

  const fetchPosts = async (
    currentUser: any,
    pageNumber: number = 0,
    append: boolean = false
  ) => {
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

    const from = pageNumber * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

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
      .order("created_at", { ascending: false })
      .range(from, to);

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

    if (data.length < PAGE_SIZE) {
      setHasMore(false);
    }

    if (append) {
      setPosts((prev) => [...prev, ...formatted]);
    } else {
      setPosts(formatted);
    }
  };

  /* ---------------- LOAD MORE ---------------- */

  const loadMore = async () => {
    if (!user || !hasMore || loadingMore) return;

    setLoadingMore(true);
    const nextPage = page + 1;

    await fetchPosts(user, nextPage, true);

    setPage(nextPage);
    setLoadingMore(false);
  };

  /* ---------------- SCROLL DETECTION ---------------- */

  useEffect(() => {
    const handleScroll = () => {
      if (
        window.innerHeight + window.scrollY >=
        document.body.offsetHeight - 200
      ) {
        loadMore();
      }
    };

    window.addEventListener("scroll", handleScroll);

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, [page, hasMore, loadingMore, user]);

  /* ---------------- REALTIME ---------------- */

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("social-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "comments" },
        () => fetchPosts(user, 0, false)
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "post_likes" },
        () => fetchPosts(user, 0, false)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  /* ---------------- ACTIONS ---------------- */

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

  const fetchPendingRequests = async (currentUser: any) => {
    const { count } = await supabase
      .from("friend_requests")
      .select("*", { count: "exact", head: true })
      .eq("receiver_id", currentUser.id)
      .eq("status", "pending");

    setPendingCount(count || 0);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  /* ---------------- UI ---------------- */

  return (
    <div className="min-h-screen p-6 max-w-xl mx-auto">

      {user && (
        <FeedHeader
          pendingCount={pendingCount}
          onLogout={handleLogout}
        />
      )}

      {user && (
        <CreatePost
          userId={user.id}
          onPostCreated={() => {
            setPage(0);
            setHasMore(true);
            fetchPosts(user, 0, false);
          }}
        />
      )}

      {user && <SearchUsers currentUserId={user.id} />}

      <div className="space-y-6">
        {user &&
          posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              currentUserId={user.id}
              onLikeToggle={toggleLike}
              onAddComment={addComment}
              onDeleteComment={deleteComment}
            />
          ))}
      </div>

      {loadingMore && (
        <p className="text-center mt-4 text-gray-500">
          Loading more...
        </p>
      )}

      {!hasMore && (
        <p className="text-center mt-4 text-gray-400">
          No more posts
        </p>
      )}
    </div>
  );
}