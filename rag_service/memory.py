from collections import defaultdict, deque
from typing import List, Optional


class Memory:
    _store = defaultdict(lambda: deque(maxlen=50))

    @classmethod
    def load(cls, session_id: str) -> List[deque]:
        return list(cls._store[session_id])
    
    @classmethod
    def add(cls, session_id: str, msg: dict[str, str]) -> None:
        cls._store[session_id].append(msg)

    @classmethod
    def reset(cls, session_id: str) -> None:
        cls._store.pop(session_id, None)

    @classmethod
    def turn_number(cls, session_id: str) -> int:
        return len(cls._store[session_id])