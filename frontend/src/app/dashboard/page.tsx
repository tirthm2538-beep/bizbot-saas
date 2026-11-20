"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import type { User } from "@supabase/supabase-js";

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [businessName, setBusinessName] = useState<string>("My Business");
  const [botModalOpen, setBotModalOpen] = useState(false);

  useEffect(() => {
    const checkUser = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session || !session.user) {
        router.push("/login");
        return;
      }

      setUser(session.user);
      const metaName = session.user.user_metadata?.business_name;
      if (metaName) {
        setBusinessName(metaName);
      }

      // Try fetching profile from public.users if schema has run
      try {
        const { data } = await supabase
          .from("users")
          .select("business_name")
          .eq("id", session.user.id)
          .single();

        if (data?.business_name) {
          setBusinessName(data.business_name);
        }
      } catch {
        // Table may not have run yet, fallback to user_metadata
      }

      setLoading(false);
    };

    checkUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        router.push("/login");
      } else {
        setUser(session.user);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
          <p className="text-sm text-slate-400">Verifying session...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Dashboard Top Navbar */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center font-bold text-white text-lg shadow-lg shadow-blue-500/20">
              🤖
            </div>
            <span className="font-bold text-xl tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
              BizBot SaaS
            </span>
          </Link>
          <span className="hidden sm:inline-block text-xs font-medium text-slate-500">|</span>
          <span className="hidden sm:inline-block text-xs text-slate-400 font-medium">
            Dashboard
          </span>
        </div>

        <div className="flex items-center gap-4 text-sm">
          <div className="text-right hidden sm:block">
            <p className="text-xs text-slate-400">Signed in as</p>
            <p className="text-xs font-semibold text-slate-200">{user?.email}</p>
          </div>
          <button
            onClick={handleLogout}
            className="px-3.5 py-1.5 rounded-lg border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-xs font-medium transition"
          >
            Log Out
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-10">
        {/* Welcome Banner */}
        <div className="p-8 rounded-2xl bg-gradient-to-r from-blue-950/60 via-slate-900 to-slate-900 border border-blue-900/40 shadow-xl mb-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-semibold mb-3">
              🏢 {businessName} • Free Tier
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-white">
              Welcome, <span className="text-blue-400">{user?.email}</span>
            </h1>
            <p className="mt-2 text-sm text-slate-400 max-w-xl">
              Manage your AI chatbots, train them on custom business documents, review customer chat logs, and track conversations.
            </p>
          </div>

          <button
            onClick={() => setBotModalOpen(true)}
            className="px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm shadow-lg shadow-blue-500/25 transition flex items-center gap-2"
          >
            <span>+</span>
            <span>Create your first bot</span>
          </button>
        </div>

        {/* Placeholder Bots Section */}
        <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/30 p-12 text-center flex flex-col items-center">
          <div className="h-14 w-14 rounded-2xl bg-slate-800 flex items-center justify-center text-2xl text-slate-400 mb-4">
            🤖
          </div>
          <h3 className="text-lg font-semibold text-slate-200">No chatbots configured yet</h3>
          <p className="mt-1 text-sm text-slate-400 max-w-md">
            Click &ldquo;Create your first bot&rdquo; to launch your business chatbot builder and embed it onto your website.
          </p>
          <button
            onClick={() => setBotModalOpen(true)}
            className="mt-6 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-blue-400 border border-slate-700 text-sm font-medium transition"
          >
            Create your first bot
          </button>
        </div>

        {/* Modal placeholder */}
        {botModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-white">Create AI Chatbot</h3>
                <button
                  onClick={() => setBotModalOpen(false)}
                  className="text-slate-400 hover:text-white text-sm"
                >
                  ✕
                </button>
              </div>
              <p className="text-sm text-slate-400 mb-6">
                Bot creation studio will be connected in Step 2. Auth, routing, and database schema are ready!
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setBotModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium transition"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
