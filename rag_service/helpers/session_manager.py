from rag_service.helpers.context_manager import HistoryIndex
from rag_service.utils.redis_client import RedisClient

import hashlib
from datetime import datetime as dt, timezone
from pydantic import BaseModel
from typing import Tuple


class SessionInfo(BaseModel):
    session_id: str
    time_initialized: dt
    user_id: str


    def is_expired(self, timeout_seconds: int) -> bool:
        age = (dt.now(timezone.utc) - self.time_initialized).total_seconds()
        return age > timeout_seconds
    


class SessionManager:
    store = RedisClient()


    @classmethod
    def create_user_session_id(cls, user_id: str) -> str:
        return f"user_{user_id}_{hashlib.md5(user_id.encode()).hexdigest()}"
    

    @classmethod
    def get_or_create_session(
        cls, 
        user_id: str,
        timeout_seconds: int 
    ) -> Tuple[SessionInfo, bool]:
        
        session_id = cls.create_user_session_id(user_id)
        stored_session = cls.store.get_session_info(user_id)

        if stored_session:
            session_info = SessionInfo(
                user_id = user_id,
                time_initialized = dt.fromisoformat(stored_session['time_initialized']),
                session_id = stored_session['session_id']
            )
            if session_info.is_expired(timeout_seconds):
                cls.cleanup_session(session_id, user_id)

                session_info = SessionInfo(
                    user_id = user_id,
                    session_id = session_id,
                    time_initialized = dt.now(timezone.utc)
                )

                cls.store.store_session_info(user_id, {
                    'session_id': session_id,
                    'time_initialized': session_info.time_initialized.isoformat()
                })
                return session_info, True
            
            else:
                return session_info, False
            
        else:
            session_info = SessionInfo(
                user_id = user_id,
                time_initialized = dt.now(timezone.utc),
                session_id = session_id
            )

            cls.store.store_session_info(user_id, {
                'session_id': session_id,
                'time_initialized': session_info.time_initialized.isoformat(),
                'user_id': user_id
            })
            
            return session_info, True

    
    @classmethod
    def cleanup_session(cls, session_id: str, user_id: str) -> None:
        index = HistoryIndex(session_id)
        index.delete()
