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
  private tabId: string = '';
  private readonly TAB_ID_PREFIX = 'chatbot_tab_';

  constructor(private http: HttpClient) {
    this.initializeTabId();
  }

  private initializeTabId(): void {
    let tabId = this.getTabIdFromWindowName();

    if (!tabId) {
      try {
        tabId = window.sessionStorage.getItem('chatbot_tab_id');
      } catch (e) {
        console.warn('SessionStorage access failed:', e);
      }
    }

    if (!tabId) {
      tabId = `tab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    this.setTabIdInWindowName(tabId);
    try {
      window.sessionStorage.setItem('chatbot_tab_id', tabId);
    } catch (e) {
      console.warn('Failed to store in sessionStorage:', e);
    }

    this.tabId = tabId;
    console.log('Tab ID initialized:', this.tabId);
  }

  private getTabIdFromWindowName(): string | null {
    if (typeof window === 'undefined' || !window.name) {
      return null;
    }

    try {
      const match = window.name.match(/chatbot_tab_id:([^;]+)/);
      return match ? match[1] : null;
    } catch (e) {
      return null;
    }
  }

  private setTabIdInWindowName(tabId: string): void {
    if (typeof window === 'undefined') {
      return;
    }

    let currentName = window.name || '';
    currentName = currentName.replace(/chatbot_tab_id:[^;]+;?/, '');

    window.name =
      currentName + (currentName ? ';' : '') + `chatbot_tab_id:${tabId}`;
  }

  private clearTabId(): void {
    try {
      window.sessionStorage.removeItem('chatbot_tab_id');
    } catch (e) {
      console.warn('Failed to clear from sessionStorage:', e);
    }

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
      console.log(`User changed from ${previousUserId} to ${userId}`);
      this.clearTabId();
      this.initializeTabId();
    }

    this.userId = userId;
  }

  loadChatHistory(): Observable<ChatHistoryResponse> {
    if (!this.userId) {
      console.error('User ID not set');
      return throwError(() => new Error('User ID not set'));
    }

    return this.http
      .get<ChatHistoryResponse>(
        `${this.apiUrl}/chat/history/${this.userId}/${this.tabId}`
      )
      .pipe(
        map((response) => {
          if (response.session_id) {
            this.sessionInfo = response.session_id;
          }
          return response;
        }),
        catchError((error) => {
          console.error('Failed to load chat history:', error);
          return of({
            session_id: this.sessionInfo || {
              session_id: '',
              time_initialized: new Date().toISOString(),
            },
            messages: [],
            tab_id: this.tabId,
          });
        })
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
      map((response) => {
        this.sessionInfo = response.session_id;

        const botMessage: Message = {
          content: response.answer,
          sender: 'bot',
          timestamp: new Date(),
        };

        return botMessage;
      }),
      catchError(this.handleError)
    );
  }

  private handleError(error: HttpErrorResponse) {
    console.error('An error occurred:', error);
    return throwError(() => error);
  }

  clearChat(): Observable<any> {
    if (!this.userId) {
      return throwError(() => new Error('User ID not set'));
    }

    return this.http.delete(`${this.apiUrl}/chat/${this.userId}/${this.tabId}`);
  }

  checkBackendHealth(): Observable<boolean> {
    return this.http.get<{ ok: boolean }>(`${this.apiUrl}/ping`).pipe(
      map((response) => response.ok === true),
      catchError(() => {
        return throwError(() => new Error('Backend unavailable'));
      })
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
