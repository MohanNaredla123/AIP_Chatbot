import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, map, throwError, of } from 'rxjs';
import { Message } from '../models/chat.model';

interface RAGRequest {
  question: string;
  user_id?: string;
  session_id?: {
    session_id: string;
    time_initialized: string;
  };
  tab_id?: string;
}

interface RAGResponse {
  session_id: {
    session_id: string;
    time_initialized: string;
  };
  question: string;
  answer: string;
}

interface ChatHistoryResponse {
  session_id: {
    session_id: string;
    time_initialized: string;
  };
  messages: Array<{
    content: string;
    role: 'user' | 'assistant';
    timestamp: string;
  }>;
  tab_id: string;
}

interface WelcomeMessage {
  content: string;
  timestamp: string;
}

@Injectable({
  providedIn: 'root',
})
export class ChatService {
  private apiUrl = 'http://localhost:8000';
  private sessionInfo?: {
    session_id: string;
    time_initialized: string;
  };
  private userId?: string;
  private tabId = '';
  private readonly WELCOME_MSG_KEY_PREFIX = 'chatbot_welcome_msg_';

  constructor(private http: HttpClient) {
    this.initializeTabId();
  }

  private getWelcomeMsgKey(tabId: string): string {
    return `${this.WELCOME_MSG_KEY_PREFIX}${tabId}`;
  }

  private initializeTabId(): void {
    let tabId = this.getTabIdFromWindowName();

    if (!tabId) {
      try {
        tabId = window.sessionStorage.getItem('chatbot_tab_id') || '';
      } catch (_) {}
    }

    if (!tabId) {
      tabId = `tab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    this.setTabIdInWindowName(tabId);
    try {
      window.sessionStorage.setItem('chatbot_tab_id', tabId);
    } catch (_) {}

    this.tabId = tabId;
    this.createAndStoreWelcomeMessage(this.tabId);
  }

  private createAndStoreWelcomeMessage(tabId: string): void {
    const key = this.getWelcomeMsgKey(tabId);
    if (window.sessionStorage.getItem(key)) return;

    const welcomeMsg: WelcomeMessage = {
      content: `Hey! 👋 I'm best at answering questions related to the AIP website and FAQs. If you need help navigating the site or have questions about common topics, feel free to ask! I'm here to help.`,
      timestamp: new Date().toISOString(),
    };

    try {
      window.sessionStorage.setItem(key, JSON.stringify(welcomeMsg));
    } catch (_) {}
  }

  getStoredWelcomeMessage(tabId: string): Message | null {
    try {
      const raw = window.sessionStorage.getItem(this.getWelcomeMsgKey(tabId));
      if (!raw) return null;
      const { content, timestamp } = JSON.parse(raw) as WelcomeMessage;
      return {
        content,
        sender: 'bot',
        timestamp: new Date(timestamp),
      };
    } catch (_) {
      return null;
    }
  }

  public getOrCreateWelcomeMessage(): Message {
    const stored = this.getStoredWelcomeMessage(this.tabId);
    if (stored) return stored;
    this.createAndStoreWelcomeMessage(this.tabId);
    return this.getStoredWelcomeMessage(this.tabId)!;
  }

  private getTabIdFromWindowName(): string | null {
    if (typeof window === 'undefined' || !window.name) return null;
    try {
      const match = window.name.match(/chatbot_tab_id:([^;]+)/);
      return match ? match[1] : null;
    } catch (_) {
      return null;
    }
  }

  private setTabIdInWindowName(tabId: string): void {
    if (typeof window === 'undefined') return;
    let currentName = window.name || '';
    currentName = currentName.replace(/chatbot_tab_id:[^;]+;?/, '');
    window.name =
      currentName + (currentName ? ';' : '') + `chatbot_tab_id:${tabId}`;
  }

  private clearTabId(): void {
    try {
      window.sessionStorage.removeItem('chatbot_tab_id');
      window.sessionStorage.removeItem(this.getWelcomeMsgKey(this.tabId));
    } catch (_) {}
    if (typeof window !== 'undefined' && window.name) {
      window.name = window.name.replace(/chatbot_tab_id:[^;]+;?/, '');
    }
  }

  setApiBase(base: string): void {
    this.apiUrl = base.replace(/\/+$/, '');
  }

  setUserId(userId: string): void {
    if (!userId) return;
    const previousUserId = this.userId;
    if (previousUserId && previousUserId !== userId) {
      this.clearTabId();
      this.initializeTabId();
    }
    this.userId = userId;
  }

  loadChatHistory(): Observable<ChatHistoryResponse> {
    if (!this.userId) return throwError(() => new Error('User ID not set'));

    return this.http
      .get<ChatHistoryResponse>(
        `${this.apiUrl}/chat/history/${this.userId}/${this.tabId}`
      )
      .pipe(
        map((response) => {
          if (response.session_id) this.sessionInfo = response.session_id;
          const welcomeMsg = this.getStoredWelcomeMessage(this.tabId);
          if (
            welcomeMsg &&
            (response.messages.length === 0 ||
              response.messages[0].content !== welcomeMsg.content)
          ) {
            response.messages.unshift({
              content: welcomeMsg.content,
              role: 'assistant' as const,
              timestamp: welcomeMsg.timestamp.toISOString(),
            });
          }
          return response;
        }),
        catchError(() =>
          of({
            session_id: this.sessionInfo || {
              session_id: '',
              time_initialized: new Date().toISOString(),
            },
            messages: [],
            tab_id: this.tabId,
          })
        )
      );
  }

  sendMessage(message: string): Observable<Message> {
    const payload: RAGRequest = {
      question: message,
      user_id: this.userId,
      session_id: this.sessionInfo,
      tab_id: this.tabId,
    };

    return this.http.post<RAGResponse>(`${this.apiUrl}/chat`, payload).pipe(
      map((response): Message => {
        this.sessionInfo = response.session_id;
        return {
          content: response.answer,
          sender: 'bot',
          timestamp: new Date(),
        };
      }),
      catchError(this.handleError)
    );
  }

  private handleError(error: HttpErrorResponse) {
    return throwError(() => error);
  }

  clearChat(): Observable<any> {
    if (!this.userId) return throwError(() => new Error('User ID not set'));
    return this.http.delete(`${this.apiUrl}/chat/${this.userId}/${this.tabId}`);
  }

  checkBackendHealth(): Observable<boolean> {
    return this.http.get<{ ok: boolean }>(`${this.apiUrl}/ping`).pipe(
      map((response) => response.ok === true),
      catchError(() => throwError(() => new Error('Backend unavailable')))
    );
  }

  checkRedisHealth(): Observable<boolean> {
    return this.http
      .get<{ redis_connected: boolean }>(`${this.apiUrl}/redis/health`)
      .pipe(
        map((response) => response.redis_connected),
        catchError(() => of(false))
      );
  }

  getUserId(): string | undefined {
    return this.userId;
  }

  getTabId(): string {
    return this.tabId;
  }
}
