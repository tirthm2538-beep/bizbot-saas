"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import type { User } from "@supabase/supabase-js";

interface Bot {
  id: string;
  user_id: string;
  name: string;
  system_prompt: string;
  branding_color: string;
  public_token: string;
  is_active: boolean;
  created_at: string;
}

interface MessageLog {
  id: string;
  question: string;
  answer: string;
  token_usage: number;
  created_at: string;
}

const COLOR_PRESETS = [
  { name: "Ocean Blue", hex: "#3B82F6" },
  { name: "Emerald Green", hex: "#10B981" },
  { name: "Royal Purple", hex: "#8B5CF6" },
  { name: "Indigo", hex: "#6366F1" },
  { name: "Amber Orange", hex: "#F59E0B" },
  { name: "Rose Pink", hex: "#EC4899" },
];

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [businessName, setBusinessName] = useState<string>("My Business");
  const [planTier, setPlanTier] = useState<string>("free");

  // Bots state
  const [bots, setBots] = useState<Bot[]>([]);
  const [loadingBots, setLoadingBots] = useState(false);

  // Create Bot Modal
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newBotName, setNewBotName] = useState("");
  const [newBotPrompt, setNewBotPrompt] = useState("");
  const [newBotColor, setNewBotColor] = useState("#3B82F6");
  const [creatingBot, setCreatingBot] = useState(false);
  const [createError, setCreateError] = useState("");

  // Embed Modal
  const [embedModalBot, setEmbedModalBot] = useState<Bot | null>(null);
  const [copiedSnippet, setCopiedSnippet] = useState(false);

  // Analytics Modal
  const [analyticsBot, setAnalyticsBot] = useState<Bot | null>(null);
  const [botLogs, setBotLogs] = useState<MessageLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  const fetchBots = useCallback(async (userId: string) => {
    setLoadingBots(true);
    const { data, error } = await supabase
      .from("bots")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (!error && data) {
      setBots(data as Bot[]);
    }
    setLoadingBots(false);
  }, []);

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

      // Fetch user profile & subscription
      try {
        const { data: profile } = await supabase
          .from("users")
          .select("business_name")
          .eq("id", session.user.id)
          .single();

        if (profile?.business_name) {
          setBusinessName(profile.business_name);
        }

        const { data: sub } = await supabase
          .from("subscriptions")
          .select("plan")
          .eq("user_id", session.user.id)
          .single();

        if (sub?.plan) {
          setPlanTier(sub.plan);
        }
      } catch {
        // Fallbacks already set
      }

      await fetchBots(session.user.id);
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
  }, [router, fetchBots]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const handleCreateBot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!newBotName.trim()) {
      setCreateError("Bot name is required.");
      return;
    }
    setCreatingBot(true);
    setCreateError("");

    try {
      const { data, error } = await supabase
        .from("bots")
        .insert({
          user_id: user.id,
          name: newBotName.trim(),
          system_prompt: newBotPrompt.trim() || "You are a helpful customer support assistant for our business.",
          branding_color: newBotColor,
          is_active: true,
        })
        .select()
        .single();

      if (error) throw error;

      if (data) {
        setBots((prev) => [data as Bot, ...prev]);
        setCreateModalOpen(false);
        setNewBotName("");
        setNewBotPrompt("");
        setNewBotColor("#3B82F6");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to create bot";
      setCreateError(msg);
    } finally {
      setCreatingBot(false);
    }
  };

  const handleToggleActive = async (bot: Bot) => {
    const updatedStatus = !bot.is_active;
    const { error } = await supabase
      .from("bots")
      .update({ is_active: updatedStatus })
      .eq("id", bot.id);

    if (!error) {
      setBots((prev) =>
        prev.map((b) => (b.id === bot.id ? { ...b, is_active: updatedStatus } : b))
      );
    }
  };

  const handleDeleteBot = async (botId: string) => {
    if (!confirm("Are you sure you want to delete this chatbot? All its chat history will be deleted.")) {
      return;
    }
    const { error } = await supabase.from("bots").delete().eq("id", botId);
    if (!error) {
      setBots((prev) => prev.filter((b) => b.id !== botId));
    }
  };

  const handleOpenAnalytics = async (bot: Bot) => {
    setAnalyticsBot(bot);
    setLoadingLogs(true);
    const { data } = await supabase
      .from("messages")
      .select("id, question, answer, token_usage, created_at")
      .eq("bot_id", bot.id)
      .order("created_at", { ascending: false })
      .limit(20);

    setBotLogs((data as MessageLog[]) || []);
    setLoadingLogs(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
          <p className="text-sm text-slate-400">Verifying session & loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Navbar */}
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
          <span className="hidden sm:inline-block text-xs font-medium text-slate-600">|</span>
          <span className="hidden sm:inline-block text-xs text-slate-400 font-medium">
            Bot Studio
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

      {/* Main Container */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-10">
        {/* Welcome Header */}
        <div className="p-8 rounded-2xl bg-gradient-to-r from-blue-950/50 via-slate-900 to-slate-900 border border-blue-900/40 shadow-xl mb-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-semibold mb-3">
              🏢 {businessName} • <span className="uppercase">{planTier} Plan</span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-white">
              Welcome, <span className="text-blue-400">{user?.email}</span>
            </h1>
            <p className="mt-2 text-sm text-slate-400 max-w-xl">
              Create and manage customer-facing chatbots. Ingest business information, customize colors, copy embed snippets, and review analytics.
            </p>
          </div>

          <button
            onClick={() => setCreateModalOpen(true)}
            className="px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm shadow-lg shadow-blue-500/25 transition flex items-center gap-2"
          >
            <span>+</span>
            <span>Create New Bot</span>
          </button>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8">
          <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Active Chatbots</span>
            <div className="mt-2 text-2xl font-bold text-white">
              {bots.filter((b) => b.is_active).length} <span className="text-sm font-normal text-slate-500">/ {bots.length} total</span>
            </div>
          </div>
          <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Subscription Tier</span>
            <div className="mt-2 text-2xl font-bold text-white capitalize">
              {planTier} <span className="text-xs font-medium text-emerald-400 ml-1">● Active</span>
            </div>
          </div>
          <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">AI Model Engine</span>
            <div className="mt-2 text-2xl font-bold text-white">
              Gemini 3.8 <span className="text-xs font-normal text-slate-400">Flash</span>
            </div>
          </div>
        </div>

        {/* Bots Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white">Your Chatbots</h2>
            <span className="text-xs text-slate-500">{bots.length} configured</span>
          </div>

          {loadingBots ? (
            <div className="p-12 text-center text-slate-400">Loading chatbots...</div>
          ) : bots.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/40 p-12 text-center flex flex-col items-center">
              <div className="h-14 w-14 rounded-2xl bg-slate-800 flex items-center justify-center text-2xl text-slate-400 mb-4">
                🤖
              </div>
              <h3 className="text-lg font-semibold text-slate-200">No chatbots configured yet</h3>
              <p className="mt-1 text-sm text-slate-400 max-w-md">
                Get started by creating your first business AI assistant trained on your custom FAQs and service details.
              </p>
              <button
                onClick={() => setCreateModalOpen(true)}
                className="mt-6 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition shadow-md"
              >
                + Create your first bot
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {bots.map((bot) => (
                <div
                  key={bot.id}
                  className="rounded-2xl bg-slate-900/90 border border-slate-800 p-6 shadow-md hover:border-slate-700 transition flex flex-col justify-between"
                >
                  <div>
                    {/* Bot Card Top Header */}
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="h-10 w-10 rounded-xl flex items-center justify-center text-white text-lg shadow-sm"
                          style={{ backgroundColor: bot.branding_color || "#3B82F6" }}
                        >
                          🤖
                        </div>
                        <div>
                          <h3 className="font-bold text-base text-white">{bot.name}</h3>
                          <span className="text-[11px] text-slate-500">
                            Token: {bot.public_token.substring(0, 10)}...
                          </span>
                        </div>
                      </div>

                      {/* Active Status Badge & Toggle */}
                      <button
                        onClick={() => handleToggleActive(bot)}
                        className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition ${
                          bot.is_active
                            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20"
                            : "bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700"
                        }`}
                      >
                        {bot.is_active ? "Active" : "Paused"}
                      </button>
                    </div>

                    {/* Knowledge base summary */}
                    <div className="mt-3 p-3 rounded-lg bg-slate-950/70 border border-slate-800/80 text-xs text-slate-300 font-mono line-clamp-3">
                      {bot.system_prompt || "No custom instructions provided."}
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="mt-6 pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/chat/${bot.public_token}`}
                        target="_blank"
                        className="px-3 py-1.5 rounded-lg bg-blue-600/10 border border-blue-500/30 text-blue-400 hover:bg-blue-500/20 font-medium transition"
                      >
                        Test Chat ↗
                      </Link>
                      <button
                        onClick={() => setEmbedModalBot(bot)}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 font-medium transition"
                      >
                        Embed Code
                      </button>
                      <button
                        onClick={() => handleOpenAnalytics(bot)}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 font-medium transition"
                      >
                        Analytics 📊
                      </button>
                    </div>

                    <button
                      onClick={() => handleDeleteBot(bot.id)}
                      className="text-rose-400 hover:text-rose-300 transition text-xs font-medium"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Modal: Create Bot */}
        {createModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto">
            <div className="w-full max-w-xl rounded-2xl bg-slate-900 border border-slate-800 p-6 sm:p-8 shadow-2xl my-8">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-white">Create New AI Chatbot</h3>
                <button
                  onClick={() => setCreateModalOpen(false)}
                  className="text-slate-400 hover:text-white text-lg font-bold"
                >
                  ✕
                </button>
              </div>

              {createError && (
                <div className="p-3 mb-4 text-xs bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-lg">
                  {createError}
                </div>
              )}

              <form onSubmit={handleCreateBot} className="space-y-5">
                <div>
                  <label className="block text-xs font-medium text-slate-300 uppercase tracking-wider mb-1">
                    Bot Name <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Acme Support Assistant"
                    value={newBotName}
                    onChange={(e) => setNewBotName(e.target.value)}
                    className="w-full rounded-xl bg-slate-800 border border-slate-700 px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 uppercase tracking-wider mb-1">
                    Branding Theme Color
                  </label>
                  <div className="flex items-center gap-2 flex-wrap">
                    {COLOR_PRESETS.map((color) => (
                      <button
                        key={color.hex}
                        type="button"
                        onClick={() => setNewBotColor(color.hex)}
                        className={`h-7 w-7 rounded-full transition-transform ${
                          newBotColor === color.hex ? "ring-2 ring-white scale-110" : "opacity-80 hover:opacity-100"
                        }`}
                        style={{ backgroundColor: color.hex }}
                        title={color.name}
                      />
                    ))}
                    <input
                      type="color"
                      value={newBotColor}
                      onChange={(e) => setNewBotColor(e.target.value)}
                      className="h-8 w-8 rounded cursor-pointer bg-transparent border-0"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 uppercase tracking-wider mb-1">
                    Business Knowledge Base & Instructions
                  </label>
                  <p className="text-xs text-slate-400 mb-2">
                    Paste company FAQs, business hours, services, pricing, refund policies, and contact information. The AI answers queries grounded strictly on this text.
                  </p>
                  <textarea
                    rows={6}
                    placeholder={`e.g.\nBusiness Name: Acme Coffee\nHours: Mon-Fri 7am - 6pm, Sat 8am - 4pm\nServices: Specialty espresso, whole bean bags, local delivery.\nReturn Policy: Unopened bags can be exchanged within 14 days.`}
                    value={newBotPrompt}
                    onChange={(e) => setNewBotPrompt(e.target.value)}
                    className="w-full rounded-xl bg-slate-800 border border-slate-700 p-3 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setCreateModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creatingBot}
                    className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-500/20 transition disabled:opacity-50"
                  >
                    {creatingBot ? "Deploying..." : "Create Chatbot"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Embed Widget */}
        {embedModalBot && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
            <div className="w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-white">Embed {embedModalBot.name}</h3>
                <button
                  onClick={() => setEmbedModalBot(null)}
                  className="text-slate-400 hover:text-white"
                >
                  ✕
                </button>
              </div>

              <p className="text-xs text-slate-400 mb-3">
                Copy and paste this snippet anywhere on your website (Shopify, WordPress, Webflow, or custom HTML):
              </p>

              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs font-mono text-slate-300 break-all mb-4">
                {`<iframe src="http://localhost:3000/chat/${embedModalBot.public_token}" width="100%" height="600" style="border:none; border-radius:16px;"></iframe>`}
              </div>

              <div className="flex justify-between items-center">
                <Link
                  href={`/chat/${embedModalBot.public_token}`}
                  target="_blank"
                  className="text-xs text-blue-400 hover:underline"
                >
                  Open Direct Link ↗
                </Link>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(
                      `<iframe src="http://localhost:3000/chat/${embedModalBot.public_token}" width="100%" height="600" style="border:none; border-radius:16px;"></iframe>`
                    );
                    setCopiedSnippet(true);
                    setTimeout(() => setCopiedSnippet(false), 2000);
                  }}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition"
                >
                  {copiedSnippet ? "Copied! ✓" : "Copy Snippet"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Analytics & Message Logs */}
        {analyticsBot && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
            <div className="w-full max-w-2xl rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl max-h-[85vh] flex flex-col">
              <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
                <div>
                  <h3 className="text-lg font-bold text-white">{analyticsBot.name} — Chat History</h3>
                  <p className="text-xs text-slate-400">Recent customer conversation audit logs</p>
                </div>
                <button
                  onClick={() => setAnalyticsBot(null)}
                  className="text-slate-400 hover:text-white text-lg"
                >
                  ✕
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-3 pr-2">
                {loadingLogs ? (
                  <p className="text-xs text-slate-400 text-center py-8">Loading chat logs...</p>
                ) : botLogs.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-xs">
                    No chat conversations recorded for this bot yet.
                  </div>
                ) : (
                  botLogs.map((log) => (
                    <div
                      key={log.id}
                      className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-2"
                    >
                      <div className="flex items-center justify-between text-[11px] text-slate-500">
                        <span>{new Date(log.created_at).toLocaleString()}</span>
                        <span>{log.token_usage} tokens</span>
                      </div>
                      <div className="text-slate-200">
                        <strong className="text-blue-400">User:</strong> {log.question}
                      </div>
                      <div className="text-slate-300 bg-slate-900/60 p-2 rounded-lg">
                        <strong className="text-emerald-400">Bot:</strong> {log.answer}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
