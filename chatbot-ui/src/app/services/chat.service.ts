import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, map, throwError } from 'rxjs';
import { Message } from '../models/chat.model';

interface RAGRequest {
  question: string;
  user_id?: string;
  session_id?: {
    session_id: string;
    time_initialised: string;
  };
}

interface RAGResponse {
  session_id: {
    session_id: string;
    time_initialised: string;
  };
  question: string;
  answer: string;
}

@Injectable({
  providedIn: 'root',
})
export class ChatService {
  private apiUrl = 'http://localhost:8000';
  private messages: Message[] = [];
  private sessionInfo?: {
    session_id: string;
    time_initialised: string;
  };
  private userId?: string;
  private tabId: string;
  private readonly MESSAGES_KEY = 'chatbot_messages';
  private readonly SESSION_KEY = 'chatbot_session';
  private readonly TAB_ID_KEY = 'chatbot_tab_id';

  constructor(private http: HttpClient) {
    this.tabId = this.getOrCreateTabId();

    const storedUserId = this.getStoredUserId();
    if (storedUserId) {
      this.userId = storedUserId;
      this.loadStoredData();
    }
  }

  private getOrCreateTabId(): string {
    let tabId = sessionStorage.getItem(this.TAB_ID_KEY);

    if (!tabId) {
      tabId = `tab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      sessionStorage.setItem(this.TAB_ID_KEY, tabId);
    }

    return tabId;
  }

  private getTabSpecificKey(baseKey: string): string {
    return `${baseKey}_${this.tabId}`;
  }

  setApiBase(base: string): void {
    this.apiUrl = base.replace(/\/+$/, '');
  }

  setUserId(userId: string): void {
    const previousUserId = this.userId;

    if (previousUserId && previousUserId !== userId) {
      console.log(
        `User changed from ${previousUserId} to ${userId}, clearing messages`
      );
      this.clearMessages();
      this.clearStoredData();
    }

    this.userId = userId;
    this.storeUserId(userId);

    if (userId) {
      this.loadStoredData();
    }
  }

  private storeUserId(userId: string): void {
    try {
      sessionStorage.setItem('chatbot_user_id', userId);
    } catch (e) {
      console.warn('Unable to store user ID:', e);
    }
  }

  private getStoredUserId(): string | null {
    try {
      return sessionStorage.getItem('chatbot_user_id');
    } catch (e) {
      return null;
    }
  }

  private loadStoredData(): void {
    try {
      const storedSession = sessionStorage.getItem(
        this.getTabSpecificKey(this.SESSION_KEY)
      );
      if (storedSession) {
        this.sessionInfo = JSON.parse(storedSession);
      }

      const storedMessages = sessionStorage.getItem(
        this.getTabSpecificKey(this.MESSAGES_KEY)
      );
      if (storedMessages) {
        const parsed = JSON.parse(storedMessages);
        this.messages = parsed.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp),
        }));
      } else {
        this.messages = [];
      }
    } catch (e) {
      console.warn('Unable to load stored data:', e);
    }
  }

  private storeData(): void {
    try {
      if (this.sessionInfo) {
        sessionStorage.setItem(
          this.getTabSpecificKey(this.SESSION_KEY),
          JSON.stringify(this.sessionInfo)
        );
      }

      sessionStorage.setItem(
        this.getTabSpecificKey(this.MESSAGES_KEY),
        JSON.stringify(this.messages)
      );
    } catch (e) {
      console.warn('Unable to store data:', e);
    }
  }

  private clearStoredData(): void {
    try {
      sessionStorage.removeItem(this.getTabSpecificKey(this.SESSION_KEY));
      sessionStorage.removeItem(this.getTabSpecificKey(this.MESSAGES_KEY));
    } catch (e) {
      console.warn('Unable to clear stored data:', e);
    }
  }

  getUserId(): string | undefined {
    return this.userId;
  }

  sendMessage(message: string): Observable<Message[]> {
    const payload: RAGRequest = {
      question: message,
      user_id: this.userId,
      session_id: this.sessionInfo,
    };

    return this.http.post<RAGResponse>(`${this.apiUrl}/chat`, payload).pipe(
      map((response) => {
        this.sessionInfo = response.session_id;

        const botMessage: Message = {
          content: response.answer,
          sender: 'bot',
          timestamp: new Date(),
        };

        this.addMessage(botMessage);
        this.storeData();
        return [botMessage];
      }),
      catchError(this.handleError)
    );
  }

  private handleError(error: HttpErrorResponse) {
    console.error('An error occurred:', error);
    return throwError(() => error);
  }

  addMessage(message: Message) {
    this.messages.push(message);
    this.storeData();
  }

  getMessages(): Message[] {
    return this.messages;
  }

  clearMessages() {
    this.messages = [];
    this.sessionInfo = undefined;
    this.clearStoredData();
  }

  checkBackendHealth(): Observable<boolean> {
    return this.http.get<{ ok: boolean }>(`${this.apiUrl}/ping`).pipe(
      map((response) => response.ok === true),
      catchError(() => {
        return throwError(() => new Error('Backend unavailable'));
      })
    );
  }
}
