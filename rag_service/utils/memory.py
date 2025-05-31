from collections import defaultdict, deque
from typing import List, Optional


class Memory:
    _store = defaultdict(lambda: deque(maxlen=30))

    @classmethod
    def append(cls, session_id: str, msg: dict[str, str]) -> None:
        cls._store[session_id].append(msg)

    @classmethod
    def turn_count(cls, session_id: str) -> int:
        return len(cls._store[session_id])
    
    @classmethod
    def load(cls, session_id: str) -> List[deque]:
        return list(cls._store[session_id])
    
    @classmethod
    def reset(cls, session_id: str | None) -> None:
        cls._store.clear()
        cls._store.pop(session_id, None)
