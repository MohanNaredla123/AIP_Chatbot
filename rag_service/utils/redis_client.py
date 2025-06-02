import redis
import json
import os
from dotenv import load_dotenv
from typing import Dict, Optional

load_dotenv()


class RedisClient:
    def __init__(self) -> None:
        self.client = redis.Redis(
            host = os.getenv('REDIS_HOST', 'localhost'),
            port = int(os.getenv('REDIS_PORT', 6379)),
            db = 0,
            decode_responses = True
        )
        self.ttl = 3600


    def get_chat_key(self, user_id: str, session_id: str, tab_id: str) -> str:
        return f"chat:{user_id}:{session_id}:{tab_id}"
    

    def get_session_key(self, user_id: str) -> str:
        return f"session:{user_id}"
    

    def store_chat_data(
            self, 
            user_id: str, 
            session_id: str, 
            tab_id: str, 
            data: Dict
    ) -> None:
        key = self.get_chat_key(user_id, session_id, tab_id)
        existing_ttl = self.client.ttl(key)

        if existing_ttl is not None and existing_ttl > 0:  # type: ignore
            self.client.set(key, json.dumps(data, default=str))
        else:
            self.client.setex(key, self.ttl, json.dumps(data, default=str))

    
    def get_chat_data(
            self, 
            user_id: str,
            session_id: str,
            tab_id: str,
    ) -> Optional[Dict]: 
        key = self.get_chat_key(user_id, session_id, tab_id)
        data = self.client.get(key)
        return json.loads(data) if data else None # type: ignore
    

    def delete_chat_data(
            self,
            user_id: str,
            session_id: str,
            tab_id: str,
    ) -> None:
        key = self.get_chat_key(user_id, session_id, tab_id)
        self.client.delete(key)

    
    def refresh_ttl(
            self, 
            user_id: str,
            session_id: str,
            tab_id: str
    ) -> None:
        key = self.get_chat_key(user_id, session_id, tab_id)
        self.client.expire(key, self.ttl)


    def store_session_info(self, user_id: str, session_info: Dict) -> None:
        key = self.get_session_key(user_id)
        self.client.setex(key, self.ttl, json.dumps(session_info, default=str))


    def get_session_info(self, user_id: str) -> Optional[Dict]:
        key = self.get_session_key(user_id)
        data = self.client.get(key)
        return json.loads(data) if data else None  # type: ignore
    

    def check_health(self) -> bool:
        try:
            self.client.ping()
            return True
        
        except:
            return False
