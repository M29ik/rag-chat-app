import io
import json
import uuid

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from google import genai
from pydantic import BaseModel
from pypdf import PdfReader

load_dotenv()  # reads backend/.env into environment variables

app = FastAPI()
client = genai.Client()  # reads GEMINI_API_KEY from the environment

# Lets the React frontend (running on a different port) talk to this server.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory store: documents disappear if the server restarts. Fine for now —
# we can swap this for a real database later without changing the endpoints below.
documents: dict[str, dict] = {}


@app.get("/health")
def health():
    return {"status": "ok"}


def extract_text(filename: str, contents: bytes) -> str:
    if filename.lower().endswith(".pdf"):
        reader = PdfReader(io.BytesIO(contents))
        return "\n".join(page.extract_text() or "" for page in reader.pages)
    return contents.decode("utf-8", errors="replace")


@app.post("/documents")
async def upload_document(file: UploadFile):
    if not file.filename.lower().endswith((".pdf", ".txt", ".md")):
        raise HTTPException(status_code=400, detail="Only .pdf, .txt, and .md files are supported")

    contents = await file.read()
    text = extract_text(file.filename, contents)

    doc_id = str(uuid.uuid4())
    documents[doc_id] = {
        "id": doc_id,
        "filename": file.filename,
        "text": text,
        "size_bytes": len(contents),
    }
    return {"id": doc_id, "filename": file.filename, "size_bytes": len(contents)}


@app.get("/documents")
def list_documents():
    return [
        {"id": d["id"], "filename": d["filename"], "size_bytes": d["size_bytes"]}
        for d in documents.values()
    ]


@app.delete("/documents/{doc_id}")
def delete_document(doc_id: str):
    if doc_id not in documents:
        raise HTTPException(status_code=404, detail="Document not found")
    del documents[doc_id]
    return {"status": "deleted"}


class ChatRequest(BaseModel):
    message: str


SYSTEM_PROMPT = (
    "Answer the user's question using only the provided documents. "
    "If the documents don't contain the answer, say so clearly instead of guessing. "
    "When you use information from a document, note its title in parentheses, "
    "e.g. (Source: filename.txt)."
)


def build_context() -> str:
    return "\n\n".join(
        f"--- Document: {doc['filename']} ---\n{doc['text']}" for doc in documents.values()
    )


@app.post("/chat")
async def chat(req: ChatRequest):
    context = build_context()
    prompt = f"{context}\n\n---\n\nQuestion: {req.message}" if context else req.message

    def event_stream():
        stream = client.interactions.create(
            model="gemini-3.5-flash",
            system_instruction=SYSTEM_PROMPT,
            input=prompt,
            stream=True,
        )
        for event in stream:
            if event.event_type == "step.delta" and event.delta.type == "text":
                yield f"event: delta\ndata: {json.dumps({'text': event.delta.text})}\n\n"
        yield "event: done\ndata: {}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")
