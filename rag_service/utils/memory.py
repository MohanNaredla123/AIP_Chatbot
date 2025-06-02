from rag_service.utils.redis_client import RedisClient

from typing import List, Dict, Optional


class Memory:
    store = RedisClient()

    @classmethod
    def append(
        cls,
        user_id: str,
        session_id: str,
        tab_id: str,
        msg: Dict[str, str]
    ) -> None:
        data = cls.store.get_chat_data(user_id, session_id, tab_id) or {
            'messages': [],
            'session_info': None,
            'turn_count': 0
        }

        data['messages'].append(msg)
        data['turn_count'] = len([m for m in data['messages'] if m['role'] == 'user'])

        cls.store.store_chat_data(user_id, session_id, tab_id, data)


    @classmethod
    def turn_count(cls, user_id: str, session_id: str, tab_id: str) -> int:
        data = cls.store.get_chat_data(user_id, session_id, tab_id)
        return data.get('turn_count', 0) if data else 0
    

    @classmethod
    def load(cls, user_id: str, session_id: str, tab_id: str) -> List[Dict]:
        data = cls.store.get_chat_data(user_id, session_id, tab_id)
        return data['messages'] if data else []
    

    @classmethod
    def reset(cls, user_id: str, session_id: str, tab_id: str) -> None:
        cls.store.delete_chat_data(user_id, session_id, tab_id)
    

    @classmethod
    def has_session(cls, user_id: str, session_id: str) -> bool:
        session_info = cls.store.get_session_info(user_id)
        return session_info is not None and session_info.get('session_id') == session_id
    

    @classmethod
    def update_session_info(cls, user_id: str, session_id: str, tab_id: str, session_info: Dict) -> None:
        data = cls.store.get_chat_data(user_id, session_id, tab_id) or {
            'messages': [],
            'session_info': None,
            'turn_count': 0
        }

        data['session_info'] = session_info
        cls.store.store_chat_data(user_id, session_id, tab_id, data)


    