from __future__ import annotations
import datetime, pathlib, pickle, shutil
from typing import List, Optional

from langchain.docstore import InMemoryDocstore
from langchain.embeddings import SentenceTransformerEmbeddings
from langchain.schema import Document
from langchain.vectorstores import FAISS
from langchain_community.retrievers import BM25Retriever
from langchain.retrievers.ensemble import EnsembleRetriever


BASE_DIR = pathlib.Path("rag_service/data/indexHistory")
BASE_DIR.mkdir(exist_ok=True)
RAW_FILE = "raw_texts.pkl"
EMB = SentenceTransformerEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")


class HistoryIndex:

    def __init__(self, session_id: str) -> None:
        self.session_id = session_id
        self.dir = BASE_DIR / session_id
        self.dir.mkdir(parents=True, exist_ok=True)

        if any(self.dir.iterdir()):
            self.vector_store: Optional[FAISS] = FAISS.load_local(
                str(self.dir), EMB, allow_dangerous_deserialization=True
            )
        else:
            self.vector_store = None                       

        raw_path = self.dir / RAW_FILE
        if raw_path.exists():
            with raw_path.open("rb") as f:
                self._texts: List[str] = pickle.load(f)
        else:
            self._texts = []


    def upsert_turn(self, text: str, turn_id: int) -> None:
        meta = {
            "session_id": self.session_id,
            "turn_id": turn_id,
            "ts": datetime.datetime.now(datetime.UTC).isoformat(timespec='seconds'),
        }

        if self.vector_store is None:                         
            self.vector_store = FAISS.from_texts(texts=[text], embedding=EMB, metadatas=[meta])
        else:
            self.vector_store.add_texts(texts=[text], metadatas=[meta])

        self.vector_store.save_local(str(self.dir))

        self._texts.append(text)
        with (self.dir / RAW_FILE).open("wb") as f:
            pickle.dump(self._texts, f)


    def retrieve(self, query: str, k: int = 10) -> List[Document]:
        if self.vector_store is None:          
            return []

        dense = self.vector_store.as_retriever(search_kwargs={"k": k})
        sparse = BM25Retriever.from_texts(self._texts)
        sparse.k = k

        hybrid = EnsembleRetriever(
            retrievers=[dense, sparse],
            weights=[0.5, 0.5],              
        )
        return hybrid.get_relevant_documents(query)


    def delete(self) -> None:
        d = BASE_DIR / self.session_id
        if d.exists():
            shutil.rmtree(d, ignore_errors=True)
