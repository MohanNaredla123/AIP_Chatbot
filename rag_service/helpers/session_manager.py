import hashlib
from datetime import datetime as dt, timezone
from pydantic import BaseModel
from typing import Tuple, Dict, Optional

from rag_service.utils.memory import Memory
from rag_service.helpers.context_manager import HistoryIndex


class SessionInfo(BaseModel):
    session_id: str
    time_initialised: dt
    user_id: str


    def is_expired(self, timeout_seconds: int) -> bool:
        age = (dt.now(timezone.utc) - self.time_initialised).total_seconds()
        return age > timeout_seconds
    


class SessionManager:
    _session_metadata: Dict[str, SessionInfo] = {}


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

        if session_id in cls._session_metadata:
            session_info = cls._session_metadata[session_id]

            if session_info.is_expired(timeout_seconds):
                cls.cleanup_session(session_id)

                session_info = SessionInfo(
                    user_id = user_id,
                    session_id = session_id,
                    time_initialised = dt.now(timezone.utc)
                )
                cls._session_metadata[session_id] = session_info
                return session_info, True
            
            else:
                return session_info, False
            
        else:
            if Memory.has_session(session_id):
                session_info = SessionInfo(
                    user_id = user_id,
                    session_id = session_id,
                    time_initialised = dt.now(timezone.utc)
                )
                cls._session_metadata[session_id] = session_info
                return session_info, False
            
            else:
                session_info = SessionInfo(
                    user_id = user_id,
                    session_id = session_id,
                    time_initialised = dt.now(timezone.utc)
                )
                cls._session_metadata[session_id] = session_info
                return session_info, True

    
    @classmethod
    def cleanup_session(cls, session_id: str) -> None:
        Memory.reset(session_id)
        index = HistoryIndex(session_id)
        index.delete()
        cls._session_metadata.pop(session_id, None)
