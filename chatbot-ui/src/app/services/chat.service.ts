import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, map, throwError } from 'rxjs';
import { Message } from '../models/chat.model';

interface RAGRequest {
  question: string;
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

  constructor(private http: HttpClient) {}

  setApiBase(base: string): void {
    this.apiUrl = base.replace(/\/+$/, '');
  }

  sendMessage(message: string): Observable<Message[]> {
    const payload: RAGRequest = {
      question: message,
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
