import ollama


def generate_response(messages: list[dict[str, str]]) -> str:
    response = ollama.chat(model="phi3", messages=messages)
    return response["message"]["content"]


def stream_response(messages: list[dict[str, str]]):
    for chunk in ollama.chat(model="phi3", messages=messages, stream=True):
        content = chunk.get("message", {}).get("content", "")
        if content:
            yield content