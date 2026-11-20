# BizBot SaaS 🤖

A modern, multi-tenant AI Chatbot platform designed for businesses to easily create, train, embed, and monetize customized AI assistants powered by Google Gemini and Supabase.

---

## 🌟 Key Features
- **Multi-Tenant Architecture**: Business accounts with strict database isolation powered by PostgreSQL Row Level Security (RLS).
- **Multi-Bot Support**: Configure and deploy multiple bots per business (e.g., Customer Support, Sales Inquiry, Internal Helpdesk).
- **Custom Knowledge Base**: Ingest business FAQs, documentation, and product catalogs to ground LLM answers.
- **Instant Embed Widget**: Deploy a responsive floating chat widget to any website via a simple `<script>` tag.
- **Analytics & Chat History**: Real-time message logs, session tracking, token usage, and user feedback metrics.
- **Subscription Monetization**: Tiered SaaS billing integration with Stripe.

---

## 🏗️ Architecture & Tech Stack

- **Frontend**: Next.js 15+ (App Router), React, TypeScript, Tailwind CSS
- **Backend**: FastAPI (Python 3.12), Uvicorn, Pydantic, Google Generative AI (`google-generativeai`), Supabase Python SDK
- **Database & Auth**: Supabase (PostgreSQL 15+ with RLS, Supabase Auth)
- **AI Model**: Google Gemini 1.5 Flash / 2.0 Flash
- **Billing**: Stripe (Subscription lifecycle & billing portal)

---

## 🚀 Getting Started

### Prerequisites
- Python 3.10+
- Node.js 18+ and npm
- Supabase account & project
- Google Gemini API Key

---

### Backend Setup

```bash
cd backend
python -m venv venv

# Windows
.\venv\Scripts\activate
# macOS/Linux
source venv/bin/activate

pip install -r requirements.txt
cp .env.example .env
# Fill in GEMINI_API_KEY, SUPABASE_URL, and SUPABASE_KEY in .env

# Run FastAPI
uvicorn app:app --reload --port 8000
```

Verify backend health at: [http://localhost:8000/health](http://localhost:8000/health)

---

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📋 Project State & Roadmap
See [PROJECT_STATE.md](PROJECT_STATE.md) for full database schemas, RLS policies, and roadmap milestones.
