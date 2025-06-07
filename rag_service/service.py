from rag_service.utils.data import Data
from rag_service.helpers.retrieve import Retrieve
from rag_service.helpers.generate import Generation
from rag_service.utils.memory import Memory
from rag_service.helpers.context_manager import HistoryIndex
from rag_service.utils.tokens import count_tokens
from rag_service.helpers.session_manager import SessionManager, SessionInfo
from rag_service.utils.redis_client import RedisClient

from datetime import datetime as dt
from dotenv import load_dotenv
from pydantic import BaseModel
import uvicorn
import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional, List

load_dotenv()
API_HOST = os.getenv('API_HOST', 'localhost')
API_PORT = int(os.getev('API_PORT', 8000))

app = FastAPI()
app.add_middleware(
    CORSMiddleware, 
    allow_origins = ["*"], 
    allow_headers = ["*"], 
    allow_methods = ["*"]
    )


class SessionId(BaseModel):
    session_id: str
    time_initialized: dt


class Query(BaseModel):
    question: str
    user_id: Optional[str] = None
    session_id: Optional[SessionId] = None
    tab_id: Optional[str] = None


MAX_TOKENS_HISTORY = 1200
SESSION_TIMEOUT = 3600


def total_tokens(msgs):
    return sum(count_tokens(m["content"]) for m in msgs)



@app.post('/chat')
async def ask_question(request: Query):
    if not request.user_id:
        return {
            'session_id': '',
            'question': request.question,
            'answer': 'Please login into the application to access the chatbot'
        }
    
    try:
        
        if not request.tab_id:
            raise HTTPException(
                status_code=400,
                detail="Tab ID is required"
            )
        
        session_info, is_new = SessionManager.get_or_create_session(
            user_id=request.user_id,
            timeout_seconds=SESSION_TIMEOUT
        )
        
        session_id = SessionId(
            session_id=session_info.session_id,
            time_initialized=session_info.time_initialized
        )
        
        id = session_info.session_id
        
        history_msgs = Memory.load(id, request.user_id, request.tab_id)
        turn_count = Memory.turn_count(id, request.user_id, request.tab_id)
        
        Memory.update_session_info(user_id=request.user_id, session_id=id, tab_id=request.tab_id, session_info={
            'session_id': session_info.session_id,
            'time_initialized': session_info.time_initialized.isoformat()
        })
        
        hist_index = HistoryIndex(id) if turn_count >= 5 else None

        retriever = Retrieve(query=request.question)
        retrieved_docs = retriever.rerank(retriever.hybrid_retrieve())

        recent_turns = history_msgs[-5:]
        hist_chunks = []

        if hist_index:
            raw_hits = hist_index.retrieve(request.question, k=10)
            hist_chunks = retriever.rerank(raw_hits)[:3]

        ctx_msgs = recent_turns + [
            {"role": "system", "content": "Older context:\n" + doc.page_content}
            for doc in hist_chunks
        ]
        
        while total_tokens(ctx_msgs) > MAX_TOKENS_HISTORY and ctx_msgs:
            ctx_msgs.pop(0)

        generator = Generation(query=request.question, docs=retrieved_docs, history=ctx_msgs)
        answer = generator.generate_answer()

        Memory.append(session_id=id, user_id=request.user_id, tab_id=request.tab_id, msg={
            "role": "user", 
            "content": request.question,
            "timestamp": dt.now().isoformat()
        })
        Memory.append(session_id=id, user_id=request.user_id, tab_id=request.tab_id, msg={
            "role": "assistant", 
            "content": answer,
            "timestamp": dt.now().isoformat()
        })

        new_turn_count = Memory.turn_count(id, request.user_id, request.tab_id)
        
        if new_turn_count >= 6:
            if hist_index is None:
                hist_index = HistoryIndex(id)
            turn_id = new_turn_count // 2
            hist_index.upsert_turn(f"Q: {request.question}\nA: {answer}", turn_id)

        return {
            "session_id": session_id,
            "question": request.question,
            "answer": answer
        }
    
    except Exception as e:
        print(f"Error in chat endpoint: {e}")
        return {
            "session_id": session_id if 'session_id' in locals() else None,
            "question": request.question,
            "answer": 'Sorry, I was not able to understand your question, could you please rephrase it?'
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
    


@app.get('/chat/history/{user_id}/{tab_id}')
async def get_chat_history(user_id: str, tab_id: str):
        session_info, is_new = SessionManager.get_or_create_session(
            user_id=user_id,
            timeout_seconds=SESSION_TIMEOUT
        )
        
        messages = Memory.load(session_id=session_info.session_id, user_id=user_id, tab_id=tab_id)
        
        formatted_messages = []
        for msg in messages:
            formatted_messages.append({
                'content': msg['content'],
                'role': msg['role'],
                'timestamp': msg.get('timestamp', dt.now().isoformat())
            })
        
        return {
            "session_id": {
                "session_id": session_info.session_id,
                "time_initialized": session_info.time_initialized
            },
            "messages": formatted_messages,
            "tab_id": tab_id
        }
    


@app.delete('/chat/{user_id}/{tab_id}')
async def clear_chat(user_id: str, tab_id: str):
    try:
        session_info, _ = SessionManager.get_or_create_session(
            user_id=user_id,
            timeout_seconds=SESSION_TIMEOUT
        )
        
        Memory.reset(session_info.session_id, user_id, tab_id)
        
        return {"status": "success", "message": f"Chat cleared for tab {tab_id}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    


@app.get("/redis/health")
async def redis_health():
    redis_client = RedisClient()
    is_connected = redis_client.check_health()
    return {"redis_connected": is_connected}



@app.get("/ping")
def ping():
    return {"ok": True}


if __name__ == '__main__':
    uvicorn.run(app, host=API_HOST, port=API_PORT)