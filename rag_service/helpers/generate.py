from rag_service.utils.data import Data

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
        self.data = Data()
        self.role = self.data.role
        self.max_tokens = 2500
        self.history = history or []
        self.system_prompt =  f"""
            User Role = {self.role} Instructions:
            You are a helpful AIP application assistant that provides accurate answers based on the given context and solve any user queries regarding the AIP application.
            IMPORTANT: Context Usage Guidelines:
            1. For NEW questions about the AIP application (how to do something, what are the steps, etc.), use the provided document context.
            2. For FOLLOW-UP questions which do not need new information (clarifications, elaborations, "what do you mean", "can you explain", "can you modify it", "can you explain this in other way", "can you give in flow diagram" etc.), primarily use the conversation history and your previous responses. Only reference new documents if they directly add value to the clarification.
            3. For GENERAL conversation (greetings, thanks, acknowledgments), respond naturally without referencing documents.
            Key Rules:
            - If the user is asking for clarification about something you just said, DO NOT introduce new information from documents unless specifically relevant.
            - When users say things like "what do you mean", "can you explain that", "I don't understand", focus on rephrasing or elaborating your previous response.
            - If the answer cannot be found in the context, say "I don't have enough information to answer this question."
            - If the question is ambiguous please ask for clarification before answering
            - Do not make up information. Base your answer solely on the provided context.
            - Do not reference document numbers, file names, or any metadata.
            - Be clear, concise, and maintain a helpful tone in all answers.
            Provide responses using proper markdown formatting:
            - Use bullet points for sub headings.
            - Use numbered lists (1., 2., 3.) for points within the sub headings. Also use the same for steps and sequences.
            - Use paragraphs for explanations.
            Strictly follow role-based access boundaries:
            Only provide answers based on the documents accessible to the current role.
            Access is structured as follows:
            - School Absence Coordinators can access school-level information only.
            - District Absence Coordinators can access both district-level and school-level information.
            - PED roles can access PED, district, and school-level information.
            If a question is about a role outside the current access level, respond with:
            "I'm sorry, I can only answer questions related to your role. I do not have access to information for other roles such as [other role mentioned]."
        """


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

