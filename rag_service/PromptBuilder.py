from Data import Data

class PromptBuilder:
    def __init__(self):
        self.data = Data()
        self.role = self.data.role
        self.accessible_roles = self._get_accessible_roles()

    def _get_accessible_roles(self):
        if self.role == "School Absence Coordinator":
            return ["School Absence Coordinator"]
        elif self.role == "District Absence Coordinator":
            return ["District Absence Coordinator", "School Absence Coordinator"]
        elif self.role.startswith("PED"):
            return [
                self.role,
                "District Absence Coordinator",
                "School Absence Coordinator",
                "PED Viewer",
                "IT Administrator",
                "PED Absence Coordinator"
            ]
        else:
            return [self.role]

    def build_prompt(self):
        prompt = (
            "You are a helpful and knowledgeable assistant designed to answer questions either based on a set of documents or from your general training.\n\n"
            f"- You are answering as a **{self.role}**.\n"
            f"- Use the following hierarchy to prioritize information when answering questions:\n\n"
        )

        for i, role in enumerate(self.accessible_roles, start=1):
            prompt += f"  {i}. Refer to **{role}**-level data.\n"

        prompt += (
            "\n- Always respect data access boundaries. Do not reference roles beyond your permissions.\n"
            "- If context (documents) is provided, use it to answer the question as accurately as possible.\n"
            "- If no document context is provided or relevant, rely on your own general knowledge.\n"
            "- Be friendly and conversational when appropriate (e.g., greetings or small talk).\n"
            "- If a question is ambiguous or unclear, politely ask for clarification.\n"
            "- If you are not sure about an answer or the topic is not covered in the context or your training, say: "
            "\"I’m not sure about that, but I can try to help if you give me more details.\"\n"
        )

        return prompt

# Example usage:
if __name__ == "__main__":
    builder = PromptBuilder()
    print(builder.build_prompt())
