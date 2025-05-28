from rag_service.utils.data import Data
from rag_service.utils.retrieve import Retrieve
from rag_service.utils.generate import Generation
from rag_service.utils.memory import Memory
from rag_service.utils.context_manager import HistoryIndex
from rag_service.utils.tokens import count_tokens

MAX_TOKENS_HISTORY = 1200

from pydantic import BaseModel
import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import uuid


app = FastAPI()
app.add_middleware(
    CORSMiddleware, 
    allow_origins = ["*"], 
    allow_headers = ["*"], 
    allow_methods = ["*"]
    )

def total_tokens(msgs):
    return sum(count_tokens(m["content"]) for m in msgs)


class Query(BaseModel):
    question: str
    session_id: str | None = None

@app.post('/chat')
async def ask_question(request: Query):
    session_id = request.session_id or str(uuid.uuid4())
    history_msgs = Memory.load(session_id=session_id)
    hist_index = HistoryIndex(session_id) if Memory.turn_number(session_id) >= 5 else None

    retriever = Retrieve(query=request.question)
    retrieved_docs = retriever.rerank(retriever.hybrid_retrieve())

    recent_turns=history_msgs[-5:]
    hist_chunks=[]

    if hist_index:
        raw_hits=hist_index.retrieve(request.question,k=10)
        hist_chunks=retriever.rerank(raw_hits)[:3]

    ctx_msgs = recent_turns + [
    {"role": "system", "content": "Older context:\n" + doc.page_content}
    for doc in hist_chunks
    ]
    while total_tokens(ctx_msgs) > MAX_TOKENS_HISTORY and ctx_msgs:
        ctx_msgs.pop(0)

    generator = Generation(query=request.question, docs=retrieved_docs, history=ctx_msgs)
    answer = generator.generate_answer()

    Memory.add(session_id,{"role": "user", "content": request.question})
    Memory.add(session_id,{"role": "assistant", "content": answer})

    if Memory.turn_number(session_id) >= 6:
        if hist_index is None:
            hist_index = HistoryIndex(session_id)
        turn_id=Memory.turn_number(session_id) // 2
        hist_index.upsert_turn(f"Q: {request.question}\nA: {answer}",turn_id)

    return {"session_id":session_id,"question":request.question,"answer":answer}



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



if __name__ == '__main__':
    uvicorn.run(app, host='127.0.0.1', port=8000)
   