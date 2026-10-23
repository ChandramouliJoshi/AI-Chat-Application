import json
from collections.abc import Iterator
from typing import Literal

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from ..services.llm_service import generate_response, stream_response

router = APIRouter(prefix="/chat", tags=["Chat"])


class ChatMessage(BaseModel):
    role: Literal["user", "assistant", "system"]
    content: str


class ChatRequest(BaseModel):
    message: str | None = None
    messages: list[ChatMessage] | None = None

    def model_messages(self) -> list[dict[str, str]]:
        if self.messages:
            return [message.model_dump() for message in self.messages]
        if self.message and self.message.strip():
            return [{"role": "user", "content": self.message}]
        raise HTTPException(status_code=422, detail="Provide a message or conversation history.")


def stream_events(messages: list[dict[str, str]]) -> Iterator[str]:
    try:
        for token in stream_response(messages):
            yield json.dumps({"token": token}) + "\n"
        yield json.dumps({"done": True}) + "\n"
    except Exception as error:
        yield json.dumps({"error": str(error)}) + "\n"


@router.post("/")
def chat(request: ChatRequest):
    reply = generate_response(request.model_messages())
    return {"response": reply}


@router.post("/stream")
def chat_stream(request: ChatRequest):
    return StreamingResponse(
        stream_events(request.model_messages()),
        media_type="application/x-ndjson",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
