from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .routes.chat import router as chat_router

app = FastAPI(title="CJ-AI Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "https://ai-chat-application-iota.vercel.app/"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routes
app.include_router(chat_router)

@app.get("/")
def root():
    return {"status": "CJ-AI backend running"}
