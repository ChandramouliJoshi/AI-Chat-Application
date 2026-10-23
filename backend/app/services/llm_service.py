import os
from google import genai


client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

MODEL = "gemini-2.5-flash"


def generate_response(messages: list[dict[str, str]]) -> str:
    response = client.models.generate_content(
        model=MODEL,
        contents=messages,
    )

    return response.text


def stream_response(messages: list[dict[str, str]]):
    response = client.models.generate_content_stream(
        model=MODEL,
        contents=messages,
    )

    for chunk in response:
        if chunk.text:
            yield chunk.text