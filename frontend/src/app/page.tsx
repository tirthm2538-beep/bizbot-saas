"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function Home() {
  const [backendStatus, setBackendStatus] = useState<string>("checking...");
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("http://localhost:8000/health")
      .then((res) => res.json())
      .then((data) => {
        if (data.status === "healthy") {
          setBackendStatus("Online (FastAPI :8000)");
          setBackendOnline(true);
        } else {
          setBackendStatus("Unexpected response");
          setBackendOnline(false);
        }
      })
      .catch(() => {
        setBackendStatus("Offline / Unreachable");
        setBackendOnline(false);
      });
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center font-bold text-white text-lg shadow-lg shadow-blue-500/20">
            🤖
          </div>
          <div>
            <span className="font-bold text-xl tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
              BizBot SaaS
            </span>
            <span className="ml-2 text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
              v0.1.0
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 text-sm">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700">
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                backendOnline === true
                  ? "bg-emerald-400 animate-pulse"
                  : backendOnline === false
                  ? "bg-rose-500"
                  : "bg-amber-400 animate-pulse"
              }`}
            />
            <span className="text-xs text-slate-300">
              Backend: <strong className="font-medium text-slate-100">{backendStatus}</strong>
            </span>
          </div>
          <Link
            href="/login"
            className="px-3.5 py-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs transition"
          >
            Sign In
          </Link>
          <Link
            href="/signup"
            className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs transition shadow-sm"
          >
            Get Started
          </Link>
        </div>
      </header>

      {/* Hero */}
      <main className="max-w-5xl mx-auto px-6 py-16 flex flex-col items-center text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-900/30 border border-blue-700/50 text-blue-300 text-xs font-medium mb-6">
          ✨ Multi-Tenant AI Chatbot Platform for Modern Businesses
        </div>

        <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight max-w-3xl leading-tight">
          Supercharge your business with{" "}
          <span className="bg-gradient-to-r from-blue-400 via-indigo-300 to-purple-400 bg-clip-text text-transparent">
            Custom AI Chatbots
          </span>
        </h1>

        <p className="mt-6 text-lg text-slate-400 max-w-2xl leading-relaxed">
          Create, train, and embed custom Gemini-powered chatbots trained on your business data.
          Manage multiple bots, inspect real-time customer conversations, and monitor conversion metrics.
        </p>

        <div className="mt-8 flex flex-wrap gap-4 justify-center">
          <Link
            href="/signup"
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-sm shadow-lg shadow-blue-500/25 transition"
          >
            Launch Bot Studio
          </Link>
          <a
            href="http://localhost:8000/health"
            target="_blank"
            rel="noreferrer"
            className="px-6 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 font-semibold text-sm transition"
          >
            Check API Health ↗
          </a>
        </div>

        {/* Feature Cards Grid */}
        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6 w-full text-left">
          <div className="p-6 rounded-2xl bg-slate-900/70 border border-slate-800 hover:border-slate-700 transition">
            <div className="text-3xl mb-3">🏢</div>
            <h3 className="font-semibold text-lg text-slate-100">Multi-Bot Multi-Tenancy</h3>
            <p className="mt-2 text-sm text-slate-400">
              Isolate each business tenant securely with Supabase RLS. Manage dedicated customer support, sales, and internal bots.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-slate-900/70 border border-slate-800 hover:border-slate-700 transition">
            <div className="text-3xl mb-3">⚡</div>
            <h3 className="font-semibold text-lg text-slate-100">Instant Embed Widget</h3>
            <p className="mt-2 text-sm text-slate-400">
              Generate a one-line script tag or shareable chat URL to deploy on any Shopify, WordPress, or custom web application.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-slate-900/70 border border-slate-800 hover:border-slate-700 transition">
            <div className="text-3xl mb-3">📊</div>
            <h3 className="font-semibold text-lg text-slate-100">Conversational Analytics</h3>
            <p className="mt-2 text-sm text-slate-400">
              Track message volume, token consumption, sentiment, and user feedback with complete conversation audit trails.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 px-6 py-6 text-center text-xs text-slate-500">
        © 2026 BizBot SaaS. Built with Next.js, Tailwind CSS, FastAPI, Google Gemini & Supabase.
      </footer>
    </div>
  );
}
