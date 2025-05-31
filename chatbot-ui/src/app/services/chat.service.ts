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

  constructor(private http: HttpClient) {
    const storedUserId = this.getStoredUserId();
    if (storedUserId) {
      this.userId = storedUserId;
    }
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
    }

    this.userId = userId;
    this.storeUserId(userId);
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
  }

  getMessages(): Message[] {
    return this.messages;
  }

  clearMessages() {
    this.messages = [];
    this.sessionInfo = undefined;
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
