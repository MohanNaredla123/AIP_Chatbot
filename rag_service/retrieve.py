from rag_service.utils.data import Data

import numpy as np
import torch
import pickle
from langchain.vectorstores import FAISS
from langchain.embeddings import SentenceTransformerEmbeddings
from langchain.schema import Document
from transformers.models.auto.tokenization_auto import AutoTokenizer
from transformers.models.auto.modeling_auto import AutoModelForSequenceClassification


class Retrieve:
    def __init__(self, query):
        data = Data()
        self.role = data.role
        self.faiss_dir = data.faiss_dir
        self.bm25_dir = data.bm25_dir
        self.top_k_retrieval = 8
        self.top_k_rerank = 4
        self.query = query
        
    
    def hybrid_retrieve(self):
        emb = SentenceTransformerEmbeddings(model_name='sentence-transformers/all-MiniLM-L6-v2')
        vs = FAISS.load_local(self.faiss_dir, emb, allow_dangerous_deserialization=True)
        with open(self.bm25_dir, 'rb') as f:
            bm25, texts, metas = pickle.load(f)

        dense_docs = vs.similarity_search(self.query, self.top_k_retrieval)
        dense_doc_ids = {(d.metadata.get('section', ''), d.metadata.get('sub_section'), ''):d for d in dense_docs}

        tokenized_query = self.query.split()
        bm25_scores = bm25.get_scores(tokenized_query)
        all_indices = np.argsort(bm25_scores)
        bm25_top_indices = all_indices[::-1][:self.top_k_retrieval]

        bm25_chunks = []
        for idx in bm25_top_indices:
            meta = metas[idx]
            doc_id = (meta.get('section', ''), meta.get('sub_section'), '')
            if doc_id not in dense_doc_ids:
                bm25_chunks.append(Document(page_content=texts[idx], metadata=meta))

        combined_results = list(dense_doc_ids.values()) + bm25_chunks

        if len(combined_results) <= 2 * self.top_k_retrieval:
            return combined_results
        combined_results[:2 * self.top_k_retrieval]

        return combined_results

    
    def rerank(self, docs):

        rerank_tok = AutoTokenizer.from_pretrained('BAAI/bge-reranker-base')
        if torch.backends.mps.is_available():
            rerank_mod = AutoModelForSequenceClassification.\
            from_pretrained('BAAI/bge-reranker-base', d_type='float32').to('mps')

        elif torch.cuda.is_available():
            rerank_mod = AutoModelForSequenceClassification.\
                from_pretrained('BAAI/bge-reranker-base', torch_dtype='float32', device_map='auto')

        else:
            rerank_mod = AutoModelForSequenceClassification.from_pretrained('BAAI/bge-reranker-base').to('cpu')
        rerank_mod.eval()


        if len(docs) <= self.top_k_rerank:
            return docs
        
        with torch.no_grad():
            pairs = [[self.query, d.page_content] for d in docs]
            inp = rerank_tok(
                pairs,
                padding = True,
                truncation = True,
                return_tensors = 'pt',
                max_length = 512
            )
            inp = {k: v.to(rerank_mod.device) for k, v in inp.items()}
            scores = rerank_mod(**inp).logits.view(-1).cpu().numpy()

            return [docs[i] for i in np.argsort(scores)[::-1][:self.top_k_rerank]]

