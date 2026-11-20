import os
import uuid
import logging
from typing import Optional, List
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from dotenv import load_dotenv
import google.generativeai as genai
from supabase import create_client, Client

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("bizbot-saas")

load_dotenv()

# Environment configurations
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "")

# Initialize Gemini
if GEMINI_API_KEY and not GEMINI_API_KEY.startswith("your_"):
    genai.configure(api_key=GEMINI_API_KEY)
    logger.info("Gemini AI successfully configured.")
else:
    logger.warning("GEMINI_API_KEY is not set or using placeholder.")

# Initialize Supabase
supabase: Optional[Client] = None
if SUPABASE_URL and SUPABASE_KEY and not SUPABASE_KEY.startswith("your_"):
    try:
        supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
        logger.info("Supabase client successfully initialized.")
    except Exception as e:
        logger.error(f"Failed to initialize Supabase client: {e}")

# Models in order of fallback
MODELS_TO_TRY: List[str] = [
    "gemini-3.8-flash",
    "gemini-3.5-flash-lite",
    "gemini-flash-latest",
]

app = FastAPI(
    title="BizBot SaaS API",
    description="Multi-tenant AI Chatbot SaaS platform backend engine",
    version="0.2.0",
)

# CORS setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Request & Response Schemas
class ChatRequest(BaseModel):
    public_token: str = Field(..., description="Unique 32-hex public token of the bot")
    question: str = Field(..., min_length=1, description="Visitor's question")
    session_id: Optional[str] = Field(None, description="Visitor session ID")


@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "BizBot SaaS Backend",
        "version": "0.2.0",
        "gemini_active": bool(GEMINI_API_KEY and not GEMINI_API_KEY.startswith("your_")),
        "supabase_connected": bool(supabase is not None),
    }


@app.get("/api/bot/{public_token}")
def get_public_bot(public_token: str):
    """Retrieve public metadata for a bot to render client chat widgets."""
    if not supabase:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database service not configured.",
        )

    try:
        response = (
            supabase.table("bots")
            .select("id, name, branding_color, is_active, public_token")
            .eq("public_token", public_token)
            .execute()
        )
        if not response.data or len(response.data) == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Bot not found.",
            )

        bot = response.data[0]
        if not bot.get("is_active", True):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This chatbot is currently inactive.",
            )

        return bot
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching bot: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error retrieving bot configuration.",
        )


@app.post("/api/chat", status_code=status.HTTP_200_OK)
def chat_with_bot(payload: ChatRequest):
    """Generate grounded AI answer using the bot's custom prompt & knowledge, and log chat message."""
    if not supabase:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database service not configured.",
        )
    if not GEMINI_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="AI service API key not configured.",
        )

    # 1. Lookup Bot by public_token
    try:
        bot_res = (
            supabase.table("bots")
            .select("id, name, system_prompt, branding_color, is_active")
            .eq("public_token", payload.public_token)
            .execute()
        )
    except Exception as e:
        logger.error(f"Database error during bot lookup: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to query bot knowledge base.",
        )

    if not bot_res.data or len(bot_res.data) == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No chatbot found for token '{payload.public_token}'.",
        )

    bot = bot_res.data[0]
    if not bot.get("is_active", True):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This chatbot has been deactivated by the business owner.",
        )

    bot_name = bot.get("name", "Assistant")
    knowledge_prompt = bot.get("system_prompt", "You are a helpful customer support assistant.")
    branding_color = bot.get("branding_color", "#3B82F6")
    session_id = payload.session_id or str(uuid.uuid4())
    question = payload.question.strip()

    # 2. Construct grounded Gemini prompt
    grounded_prompt = (
        f"You are '{bot_name}', an AI customer support assistant for a business.\n"
        f"Here is your business context, instructions, and knowledge base:\n"
        f"---------------------\n"
        f"{knowledge_prompt}\n"
        f"---------------------\n\n"
        f"Operating Rules:\n"
        f"1. Answer the customer question accurately based on the business context above.\n"
        f"2. If the answer cannot be determined from the provided context, state politely that you do not have that information and advise contacting customer support.\n"
        f"3. Keep the tone courteous, concise, and helpful.\n\n"
        f"Customer Question: {question}"
    )

    # 3. Call Gemini
    answer = ""
    model_used = ""
    last_error = None

    for model_name in MODELS_TO_TRY:
        try:
            model = genai.GenerativeModel(model_name)
            response = model.generate_content(grounded_prompt)
            if response and response.text:
                answer = response.text.strip()
                model_used = model_name
                break
        except Exception as e:
            logger.warning(f"Model {model_name} failed: {e}. Trying fallback...")
            last_error = e

    if not answer:
        logger.error(f"All Gemini models failed: {last_error}")
        answer = "I apologize, but I am having trouble connecting to my service right now. Please try again in a few moments."
        model_used = "error-fallback"

    # Approximate token usage (4 chars ~ 1 token)
    tokens_estimated = max(1, (len(grounded_prompt) + len(answer)) // 4)

    # 4. Asynchronously log message in Supabase
    try:
        supabase.table("messages").insert(
            {
                "bot_id": bot["id"],
                "session_id": session_id,
                "question": question,
                "answer": answer,
                "token_usage": tokens_estimated,
            }
        ).execute()
    except Exception as e:
        logger.error(f"Failed to log chat message: {e}")
        # Don't fail the response if message logging encounters a transient DB error

    return {
        "answer": answer,
        "bot_name": bot_name,
        "branding_color": branding_color,
        "session_id": session_id,
        "model_used": model_used,
        "token_usage": tokens_estimated,
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="127.0.0.1", port=8000, reload=True)
