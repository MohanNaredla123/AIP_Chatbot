from data import Data
from retrieve import Retrieve
from generate import Generation
from memory import Memory
from context_manager import HistoryIndex
from tokens import count_tokens

from datetime import datetime as dt, timezone
from pydantic import BaseModel, Field
import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import uuid
from typing import Dict, Any, Optional


app = FastAPI()
app.add_middleware(
    CORSMiddleware, 
    allow_origins = ["*"], 
    allow_headers = ["*"], 
    allow_methods = ["*"]
    )


class SessionId(BaseModel):
    session_id: str
    time_initialised: dt


class Query(BaseModel):
    question: str
    session_id: Optional[SessionId] = None


MAX_TOKENS_HISTORY = 1200
def total_tokens(msgs):
    return sum(count_tokens(m["content"]) for m in msgs)


def generate_session_id(session_id: SessionId|None, max_time: int) -> SessionId:

    if session_id is None or session_id.session_id == "string" or session_id.session_id == "" or session_id.session_id == " ":
        Memory.reset(session_id.session_id if session_id is not None else None)
        index = HistoryIndex(session_id.session_id if session_id is not None else '')
        index.delete()

        return SessionId(
            session_id=str(uuid.uuid4()),
            time_initialised=dt.now(timezone.utc)
        )
    
    
    elif session_id is not None and (dt.now(timezone.utc) - session_id.time_initialised).total_seconds() > max_time:
        Memory.reset(session_id.session_id)
        index = HistoryIndex(session_id.session_id)
        index.delete()

        return SessionId(
            session_id = str(uuid.uuid4()),
            time_initialised = dt.now(timezone.utc)
        )
    
    else:
        return session_id


@app.post('/chat')
async def ask_question(request: Query):
    try:
        session_id = generate_session_id(request.session_id, 3600)
        id = session_id.session_id
        history_msgs = Memory.load(session_id=id)
        hist_index = HistoryIndex(id) if Memory.turn_count(id) >= 5 else None

        retriever = Retrieve(query=request.question)
        retrieved_docs = retriever.rerank(retriever.hybrid_retrieve())

        recent_turns=history_msgs[-5:]
        hist_chunks=[]

        if hist_index:
            raw_hits=hist_index.retrieve(request.question,k=10)
            hist_chunks= retriever.rerank(raw_hits)[:3]

        ctx_msgs = recent_turns + [
        {"role": "system", "content": "Older context:\n" + doc.page_content}
        for doc in hist_chunks
        ]
        while total_tokens(ctx_msgs) > MAX_TOKENS_HISTORY and ctx_msgs:
            ctx_msgs.pop(0)

        generator = Generation(query=request.question, docs=retrieved_docs, history=ctx_msgs)
        answer = generator.generate_answer()

        Memory.append(id, {"role": "user", "content": request.question})
        Memory.append(id, {"role": "assistant", "content": answer})

        if Memory.turn_count(id) >= 6:
            if hist_index is None:
                hist_index = HistoryIndex(id)
            turn_id=Memory.turn_count(id) // 2
            hist_index.upsert_turn(f"Q: {request.question}\nA: {answer}",turn_id)

        return {"session_id": session_id,
                "question": request.question,
                "answer":answer
            }
    
    except Exception as e:
        raise(HTTPException(status_code=500, detail=e))



class RoleUpdate(BaseModel):
    role: str

@app.post('/update-role')
async def update_role(request: RoleUpdate):
    if not request.role:
        raise HTTPException(status_code=400, detail="Role cannot be empty")
    
    success = Data.update_role(request.role)
    if success:
        return {"status": "success", "message": f"Role updated to {request.role}"}
    else:
        raise HTTPException(status_code=500, detail="Failed to update role")


@app.get("/ping")
def ping():
    return {"ok": True}


if __name__ == '__main__':
    uvicorn.run(app, host='127.0.0.1', port=8000)