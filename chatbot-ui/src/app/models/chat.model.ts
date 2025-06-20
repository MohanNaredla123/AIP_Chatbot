export interface Message {
  content: string;
  sender: 'user' | 'bot';
  timestamp: Date;
}

export interface ChatRequest {
  question: string;
  user_id?: string;
  session_id?: {
    session_id: string;
    time_initialized: string;
  };
}

export interface ChatResponse {
  session_id: {
    session_id: string;
    time_initialized: string;
  };
  question: string;
  answer: string;
}

export interface RoleUpdateRequest {
  role: string;
}

export interface RoleUpdateResponse {
  status: string;
  message: string;
}
