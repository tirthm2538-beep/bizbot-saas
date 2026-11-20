-- ==============================================================================
-- BizBot SaaS: Multi-Tenant Database Schema
-- Supabase / PostgreSQL Migration
-- ==============================================================================

-- Enable pgcrypto for UUID and random token generation
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ------------------------------------------------------------------------------
-- 1. USERS / BUSINESSES TABLE
-- Linked directly to Supabase Auth (auth.users)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    business_name TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ------------------------------------------------------------------------------
-- 2. SUBSCRIPTIONS TABLE (Razorpay)
-- Tracks plan tiers and billing lifecycle per business
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE UNIQUE,
    plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'starter', 'pro')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'trialing', 'past_due', 'canceled')),
    razorpay_customer_id TEXT,
    razorpay_subscription_id TEXT,
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ------------------------------------------------------------------------------
-- 3. BOTS TABLE
-- Multi-bot management per business account
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    system_prompt TEXT DEFAULT 'You are a helpful customer support assistant for our business.',
    branding_color TEXT DEFAULT '#3B82F6',
    public_token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
    is_active BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ------------------------------------------------------------------------------
-- 4. MESSAGES TABLE
-- Chat logs and conversation history per bot for analytics
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bot_id UUID NOT NULL REFERENCES public.bots(id) ON DELETE CASCADE,
    session_id TEXT NOT NULL,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    token_usage INTEGER DEFAULT 0 NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indexes for high-performance querying
CREATE INDEX IF NOT EXISTS idx_bots_user_id ON public.bots(user_id);
CREATE INDEX IF NOT EXISTS idx_bots_public_token ON public.bots(public_token);
CREATE INDEX IF NOT EXISTS idx_messages_bot_id ON public.messages(bot_id);
CREATE INDEX IF NOT EXISTS idx_messages_session_id ON public.messages(session_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON public.subscriptions(user_id);

-- ------------------------------------------------------------------------------
-- 5. AUTOMATIC PROFILE & SUBSCRIPTION CREATION TRIGGER
-- Whenever a user signs up via Supabase Auth, automatically insert into
-- public.users and create their initial 'free' tier subscription.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- 1. Insert into public.users
    INSERT INTO public.users (id, email, business_name)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'business_name', 'My Business')
    )
    ON CONFLICT (id) DO NOTHING;

    -- 2. Create initial free subscription
    INSERT INTO public.subscriptions (user_id, plan, status)
    VALUES (
        NEW.id,
        'free',
        'active'
    )
    ON CONFLICT (user_id) DO NOTHING;

    RETURN NEW;
END;
$$;

-- Drop trigger if already exists and recreate
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- ------------------------------------------------------------------------------
-- 6. ROW LEVEL SECURITY (RLS) POLICIES
-- Strict multi-tenant isolation
-- ------------------------------------------------------------------------------

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- 6.1 USERS POLICIES
CREATE POLICY "Users can view their own profile"
    ON public.users
    FOR SELECT
    TO authenticated
    USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
    ON public.users
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- 6.2 SUBSCRIPTIONS POLICIES
CREATE POLICY "Users can view their own subscription"
    ON public.subscriptions
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

-- 6.3 BOTS POLICIES
CREATE POLICY "Users can view their own bots"
    ON public.bots
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own bots"
    ON public.bots
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own bots"
    ON public.bots
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own bots"
    ON public.bots
    FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

-- Allow public read of active bots by public_token (for embed widgets)
CREATE POLICY "Public can view active bot info by public_token"
    ON public.bots
    FOR SELECT
    TO anon, authenticated
    USING (is_active = true);

-- 6.4 MESSAGES POLICIES
CREATE POLICY "Users can view messages for their bots"
    ON public.messages
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.bots
            WHERE bots.id = messages.bot_id
              AND bots.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete messages for their bots"
    ON public.messages
    FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.bots
            WHERE bots.id = messages.bot_id
              AND bots.user_id = auth.uid()
        )
    );

-- Allow inserting chat messages from visitors (anon & authenticated)
CREATE POLICY "Allow public insert of chat messages"
    ON public.messages
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.bots
            WHERE bots.id = messages.bot_id
              AND bots.is_active = true
        )
    );
