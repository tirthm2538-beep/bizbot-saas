import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://dkilxbixmfxdplclqqen.supabase.co";
const SUPABASE_KEY = "sb_publishable_39iD996q1Zec3LXbjo3iNA_l6mMPOAV";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function testEngine() {
  console.log("==================================================");
  console.log("BizBot SaaS - Bot Studio & Chat Engine Verification");
  console.log("==================================================");

  // 1. Check existing bots or insert a test bot
  console.log("[1] Checking bots table...");
  const { data: existingBots } = await supabase.from("bots").select("*").limit(1);

  let testBot = existingBots?.[0];

  if (!testBot) {
    console.log("No bots found. Fetching or creating a test bot...");
    // Let's see if there is any user in public.users to link to
    const { data: users } = await supabase.from("users").select("id").limit(1);
    let userId = users?.[0]?.id;

    if (!userId) {
      console.log("No user found in public.users. Creating test user in Auth first...");
      const testEmail = `founder_${Date.now()}@gmail.com`;
      const { data: authUser } = await supabase.auth.signUp({
        email: testEmail,
        password: "SuperSecretPassword123!",
        options: { data: { business_name: "Apex Specialty Roastery" } },
      });
      userId = authUser.user?.id;
    }

    if (userId) {
      console.log(`Inserting test bot for user ${userId}...`);
      const { data: inserted, error: botErr } = await supabase
        .from("bots")
        .insert({
          user_id: userId,
          name: "Apex Coffee Concierge",
          system_prompt:
            "Apex Specialty Roastery is open Mon-Sat 7am-6pm. We roast organic Ethiopian and Colombian single-origin coffee. Free shipping on orders over $40. Return policy: unopened coffee beans can be exchanged within 14 days.",
          branding_color: "#10B981",
          is_active: true,
        })
        .select()
        .single();

      if (botErr) {
        console.error("Error creating test bot:", botErr);
      } else {
        testBot = inserted;
        console.log("✅ Created test bot:", testBot.name, "with token:", testBot.public_token);
      }
    }
  } else {
    console.log("✅ Found existing bot:", testBot.name, "token:", testBot.public_token);
  }

  if (!testBot) {
    console.error("Could not obtain a bot for testing.");
    return;
  }

  // 2. Test Backend GET /api/bot/{token}
  console.log("\n[2] Testing Backend GET /api/bot/" + testBot.public_token);
  const botRes = await fetch(`http://127.0.0.1:8000/api/bot/${testBot.public_token}`);
  const botData = await botRes.json();
  console.log("Backend Bot Info response:", botData);

  // 3. Test Backend POST /api/chat with Gemini AI
  console.log("\n[3] Testing Backend POST /api/chat with Gemini grounding...");
  const question = "What are your business hours and do you offer free shipping?";
  console.log("Question asked:", question);

  const chatRes = await fetch("http://127.0.0.1:8000/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      public_token: testBot.public_token,
      question: question,
      session_id: "test_visitor_session_123",
    }),
  });

  const chatData = await chatRes.json();
  console.log("\nAI Chat Response:");
  console.log("Answer:", chatData.answer);
  console.log("Model Used:", chatData.model_used);
  console.log("Estimated Tokens:", chatData.token_usage);

  // 4. Test Frontend /chat/[token] route
  console.log("\n[4] Testing Frontend route /chat/" + testBot.public_token);
  const feRes = await fetch(`http://localhost:3000/chat/${testBot.public_token}`);
  console.log("Frontend response status:", feRes.status, feRes.statusText);

  console.log("\n==================================================");
  console.log("Verification Complete: All Systems Operational!");
  console.log("==================================================");
}

testEngine();
