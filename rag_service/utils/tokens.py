import tiktoken
import os
from dotenv import load_dotenv

load_dotenv()
_enc_cache = {}
MODEL = os.getenv("MODEL", "gpt-4.1-mini")

def count_tokens(text: str, model: str = MODEL) -> int:
    if model not in _enc_cache:
        _enc_cache[model] = tiktoken.get_encoding('o200k_base')
    
    return len(_enc_cache[model].encode(text))