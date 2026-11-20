"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { useParams } from "next/navigation";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

interface BotInfo {
  id: string;
  name: string;
  branding_color: string;
  is_active: boolean;
  public_token: string;
}

function ChatInterface() {
  const params = useParams();
  const token = params?.token as string;

  const [bot, setBot] = useState<BotInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sessionId, setSessionId] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!token) return;

    // Generate or retrieve visitor session id
    const storedSession = localStorage.getItem(`bizbot_session_${token}`);
    if (storedSession) {
      setSessionId(storedSession);
    } else {
      const newSession = "sess_" + Math.random().toString(36).substring(2, 12);
      localStorage.setItem(`bizbot_session_${token}`, newSession);
      setSessionId(newSession);
    }

    // Fetch bot metadata from backend
    fetch(`http://127.0.0.1:8000/api/bot/${token}`)
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.detail || "Chatbot not found or inactive.");
        }
        return res.json();
      })
      .then((data: BotInfo) => {
        setBot(data);
        setMessages([
          {
            role: "assistant",
            content: `Hello! I am ${data.name}. How can I assist you with our business today?`,
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          },
        ]);
        setLoading(false);
      })
      .catch((err) => {
        setErrorMsg(err.message);
        setLoading(false);
      });
  }, [token]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = inputMessage.trim();
    if (!query || sending || !bot) return;

    setInputMessage("");
    const userMsg: Message = {
      role: "user",
      content: query,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
    setMessages((prev) => [...prev, userMsg]);
    setSending(true);

    try {
      const res = await fetch("http://127.0.0.1:8000/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          public_token: token,
          question: query,
          session_id: sessionId,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || "Failed to generate answer.");
      }

      const data = await res.json();
      const botMsg: Message = {
        role: "assistant",
        content: data.answer,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error connecting to AI assistant.";
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `⚠️ ${msg}`,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  const primaryColor = bot?.branding_color || "#3B82F6";

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
          <p className="text-sm text-slate-400">Loading Assistant...</p>
        </div>
      </div>
    );
  }

  if (errorMsg || !bot) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full p-8 rounded-2xl bg-slate-900 border border-slate-800 text-center shadow-xl">
          <div className="text-4xl mb-3">🤖</div>
          <h2 className="text-xl font-bold text-white mb-2">Chatbot Unavailable</h2>
          <p className="text-sm text-slate-400 mb-4">{errorMsg || "Bot not found"}</p>
          <a
            href="/"
            className="inline-block px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition"
          >
            Powered by BizBot SaaS
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between">
      {/* Bot Chat Header */}
      <header
        className="px-6 py-4 border-b border-slate-800/80 shadow-md flex items-center justify-between"
        style={{
          background: `linear-gradient(to right, ${primaryColor}15, #0f172a 80%)`,
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="h-10 w-10 rounded-full flex items-center justify-center text-white text-lg shadow"
            style={{ backgroundColor: primaryColor }}
          >
            🤖
          </div>
          <div>
            <h1 className="font-bold text-base text-white tracking-tight flex items-center gap-2">
              {bot.name}
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            </h1>
            <p className="text-xs text-slate-400">Online • AI Customer Support</p>
          </div>
        </div>

        <a
          href="/"
          target="_blank"
          rel="noreferrer"
          className="text-[11px] text-slate-500 hover:text-slate-400 transition hidden sm:inline"
        >
          Powered by <strong className="text-slate-400">BizBot SaaS</strong>
        </a>
      </header>

      {/* Messages Scroll Area */}
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-6 overflow-y-auto space-y-4">
        {messages.map((m, idx) => (
          <div
            key={idx}
            className={`flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}
          >
            <div
              className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
                m.role === "user"
                  ? "text-white font-normal"
                  : "bg-slate-900 border border-slate-800 text-slate-200"
              }`}
              style={
                m.role === "user"
                  ? { backgroundColor: primaryColor }
                  : undefined
              }
            >
              <div className="whitespace-pre-wrap">{m.content}</div>
            </div>
            <span className="text-[10px] text-slate-500 mt-1 px-1">{m.timestamp}</span>
          </div>
        ))}

        {sending && (
          <div className="flex flex-col items-start">
            <div className="rounded-2xl px-4 py-3 text-sm bg-slate-900 border border-slate-800 text-slate-400 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-slate-400 animate-ping" />
              <span>{bot.name} is thinking...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </main>

      {/* Input Bar */}
      <footer className="border-t border-slate-800 bg-slate-900/80 backdrop-blur p-4">
        <form
          onSubmit={handleSendMessage}
          className="max-w-3xl mx-auto flex items-center gap-2"
        >
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder={`Ask ${bot.name} anything about our business...`}
            disabled={sending}
            className="flex-1 rounded-xl bg-slate-800/90 border border-slate-700 px-4 py-3 text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={sending || !inputMessage.trim()}
            className="px-5 py-3 rounded-xl font-semibold text-sm text-white transition shadow-md disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
            style={{ backgroundColor: primaryColor }}
          >
            <span>Send</span>
            <span>↗</span>
          </button>
        </form>
      </footer>
    </div>
  );
}

export default function PublicChatPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
        </div>
      }
    >
      <ChatInterface />
    </Suspense>
  );
}
