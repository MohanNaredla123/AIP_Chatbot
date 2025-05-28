import os
from dotenv import load_dotenv
import openai


load_dotenv()
OPENAI_KEY = os.getenv('OPENAI_API_KEY')
MODEL = os.getenv('MODEL')


class Generation:
    def __init__(self, query, docs, history=None):
        self.query = query
        self.docs = docs
        self.model = MODEL
        self.temperature = 0.5
        self.max_tokens = 2000
        self.history = history or []
        self.system_prompt =  """You are a helpful assistant that provides accurate answers based on the given context.
        If the answer cannot be found in the context, say "I don't have enough information to answer this question.
        Do not make up information. Base your answer solely on the provided context."""


    def process_context(self):
        messages=[{"role": "system", "content": self.system_prompt}]
        messages.extend(self.history)

        content = ''
        for i, doc in enumerate(self.docs):
            metadata = doc.metadata
            section = metadata.get('section', '')
            sub_section = metadata.get('subsection', '')
            header = f'{section}: {sub_section}' if section and sub_section else section or sub_section or ''
            content += f"\n\n### Document {i+1}: {header}\n{doc.page_content}"

        user_msg=f"Context:\n{content}\n\nQuestion: {self.query}"
        messages.append({"role": "user", "content": user_msg})
        
        return messages
    
    def generate_answer(self):
        openai.api_key = OPENAI_KEY

        messages = self.process_context()
        llm = openai.ChatCompletion.create(
            model=self.model,
            temperature=self.temperature,
            max_tokens=self.max_tokens,
            messages=messages
        )

        return llm.choices[0].message.content #type: ignore

