import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://dkilxbixmfxdplclqqen.supabase.co";
const SUPABASE_KEY = "sb_publishable_39iD996q1Zec3LXbjo3iNA_l6mMPOAV";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function run() {
  const email = process.argv[2] || `test_founder_${Date.now()}@gmail.com`;
  const password = process.argv[3] || "Password123!";

  console.log("==================================================");
  console.log("BizBot SaaS - End-to-End Auth Test");
  console.log("==================================================");
  console.log(`Target: ${SUPABASE_URL}`);
  console.log(`Testing with Email: ${email}`);

  // Step 1: Sign up
  console.log("\n[1] Testing Signup...");
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        business_name: "Test Corp AI",
      },
    },
  });

  if (signUpError) {
    console.error("❌ Signup Error:", signUpError.message);
  } else {
    console.log("✅ Signup Succeeded!");
    console.log("   User ID:", signUpData.user?.id);
    console.log("   Email:", signUpData.user?.email);
    console.log("   Session created on signup:", !!signUpData.session);
  }

  // Step 2: Sign in
  console.log("\n[2] Testing Sign In...");
  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (signInError) {
    console.log("ℹ️ Sign in notice:", signInError.message);
    if (signInError.message.includes("Email not confirmed")) {
      console.log(
        "\n👉 Tip: In Supabase Dashboard > Authentication > Providers > Email, turn off 'Confirm email' for instant logins without email verification."
      );
    }
    return;
  }

  console.log("✅ Sign In Succeeded!");
  console.log("   Logged in user ID:", signInData.user.id);

  // Step 3: Verify public.users table (RLS test)
  console.log("\n[3] Verifying public.users table via authenticated client...");
  const { data: users, error: userError } = await supabase
    .from("users")
    .select("*")
    .eq("id", signInData.user.id);

  if (userError) {
    console.error("❌ Error fetching user profile:", userError.message);
  } else {
    console.log("✅ Found user profile in public.users:", users);
  }

  // Step 4: Verify public.subscriptions table
  console.log("\n[4] Verifying public.subscriptions table (free tier)...");
  const { data: subs, error: subError } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", signInData.user.id);

  if (subError) {
    console.error("❌ Error fetching subscription:", subError.message);
  } else {
    console.log("✅ Found subscription:", subs);
  }

  // Step 5: Test Sign out
  console.log("\n[5] Testing Sign Out...");
  const { error: signOutError } = await supabase.auth.signOut();
  if (signOutError) {
    console.error("❌ Sign Out Error:", signOutError.message);
  } else {
    console.log("✅ Successfully signed out!");
  }

  console.log("\n==================================================");
  console.log("All Auth & Multi-Tenant Schema Checks Completed!");
  console.log("==================================================");
}

run();
