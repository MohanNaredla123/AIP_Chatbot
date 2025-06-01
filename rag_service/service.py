# rag_service/service.py
from rag_service.utils.data import Data
from rag_service.helpers.retrieve import Retrieve
from rag_service.helpers.generate import Generation
from rag_service.utils.memory import Memory
from rag_service.helpers.context_manager import HistoryIndex
from rag_service.utils.tokens import count_tokens
from rag_service.helpers.session_manager import SessionManager, SessionInfo

from datetime import datetime as dt
from pydantic import BaseModel
import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional


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
    user_id: Optional[str] = None
    session_id: Optional[SessionId] = None


MAX_TOKENS_HISTORY = 1200
SESSION_TIMEOUT = 3600


def total_tokens(msgs):
    return sum(count_tokens(m["content"]) for m in msgs)


@app.post('/chat')
async def ask_question(request: Query):
    try:
        if not request.user_id:
            raise HTTPException(
                status_code=401, 
                detail="Authentication required. Please log in to use the chatbot."
            )
        
        session_info, is_new = SessionManager.get_or_create_session(
            user_id=request.user_id,
            timeout_seconds=SESSION_TIMEOUT
        )
        
        session_id = SessionId(
            session_id=session_info.session_id,
            time_initialised=session_info.time_initialised
        )
        
        id = session_info.session_id
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
        print(f"Not able to fetch answer, {e}")
        return {"session_id": session_id,
                "question": request.question,
                "answer":'Sorry, I was not able to understand your question, could you please rephrase it?'
            }


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


@app.get("/session/{session_id}/info")
async def get_session_info(session_id: str):
    try:
        messages = Memory.load(session_id)
        turn_count = Memory.turn_count(session_id)
        has_session = Memory.has_session(session_id)
        
        return {
            "session_id": session_id,
            "exists": has_session,
            "turn_count": turn_count,
            "message_count": len(messages)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/session/{session_id}")
async def clear_session(session_id: str):
    try:
        Memory.reset(session_id)
        index = HistoryIndex(session_id)
        index.delete()
        
        return {"status": "success", "message": f"Session {session_id} cleared"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == '__main__':
    uvicorn.run(app, host='127.0.0.1', port=8000)