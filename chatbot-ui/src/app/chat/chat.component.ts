import {
  Component,
  OnInit,
  ViewChild,
  ElementRef,
  AfterViewChecked,
  Output,
  EventEmitter,
  Input,
  CUSTOM_ELEMENTS_SCHEMA,
  ViewEncapsulation,
  AfterViewInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChatService } from '../services/chat.service';
import { Message } from '../models/chat.model';
import { MarkdownPipe } from '../pipes/markdown.pipe';

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [CommonModule, FormsModule, MarkdownPipe],
  templateUrl: './chat.component.html',
  styleUrl: './chat.component.scss',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  encapsulation: ViewEncapsulation.ShadowDom,
})
export class ChatComponent implements OnInit, AfterViewChecked, AfterViewInit {
  @Input() expanded = false;
  @Output() expand = new EventEmitter<boolean>();
  @Output() close = new EventEmitter<void>();
  @ViewChild('chatContainer') private chatContainer!: ElementRef;
  @ViewChild('messageInput')
  private messageInput!: ElementRef<HTMLTextAreaElement>;

  userMessage = '';
  messages: Message[] = [];
  loading = false;
  loadingHistory = true;
  backendUnavailable = false;

  constructor(private chatService: ChatService) {}

  ngOnInit(): void {
    this.loadChatHistory();
    this.checkBackendAvailability();
  }

  ngAfterViewInit(): void {
    if (this.messageInput) {
      this.messageInput.nativeElement.addEventListener('input', () => {
        this.autoResizeTextarea();
      });
      setTimeout(() => this.autoResizeTextarea(), 0);
    }
  }

  private loadChatHistory(): void {
    this.loadingHistory = true;

    this.chatService.loadChatHistory().subscribe({
      next: (response) => {
        if (response.messages && response.messages.length > 0) {
          this.messages = response.messages.map((msg) => ({
            content: msg.content,
            sender: msg.role === 'user' ? 'user' : 'bot',
            timestamp: new Date(msg.timestamp),
          }));
        } else {
          this.addWelcomeMessage();
        }
        this.loadingHistory = false;
      },
      error: (error) => {
        console.error('Failed to load chat history:', error);
        this.addWelcomeMessage();
        this.loadingHistory = false;
      },
    });
  }

  private addWelcomeMessage(): void {
    this.messages = [
      {
        content: 'Hello! How can I assist you today?',
        sender: 'bot',
        timestamp: new Date(),
      },
    ];
  }

  private autoResizeTextarea(): void {
    const textarea = this.messageInput.nativeElement;
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';

    if (textarea.scrollHeight > 120) {
      textarea.style.height = '120px';
      textarea.style.overflowY = 'auto';
    } else {
      textarea.style.overflowY = 'hidden';
    }
  }

  checkBackendAvailability(): void {
    this.chatService.checkBackendHealth().subscribe({
      next: (isHealthy) => {
        this.backendUnavailable = !isHealthy;

        if (isHealthy) {
          this.chatService.checkRedisHealth().subscribe({
            next: (redisHealthy) => {
              if (!redisHealthy) {
                console.warn('Redis is not available');
              }
            },
          });
        }
      },
      error: () => {
        this.backendUnavailable = true;
      },
    });
  }

  ngAfterViewChecked(): void {
    try {
      this.chatContainer.nativeElement.scrollTop =
        this.chatContainer.nativeElement.scrollHeight;
    } catch (_) {}
  }

  handleEnterKey(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  sendMessage(): void {
    if (!this.userMessage.trim() || this.loading) return;

    const text = this.userMessage.trim();
    const userMsg: Message = {
      content: text,
      sender: 'user',
      timestamp: new Date(),
    };

    this.messages.push(userMsg);

    this.userMessage = '';
    if (this.messageInput) {
      this.messageInput.nativeElement.style.height = '40px';
      this.messageInput.nativeElement.style.overflowY = 'hidden';
    }
    this.loading = true;

    this.chatService.sendMessage(text).subscribe({
      next: (botMessage) => {
        this.messages.push(botMessage);
        this.loading = false;
        this.backendUnavailable = false;
      },
      error: (error) => {
        this.loading = false;

        const errorMsg: Message = {
          content:
            error.error?.detail ||
            (error.status === 0 || error.status >= 500
              ? "Sorry, I couldn't connect to the server. Please check if the service is running."
              : "Sorry, I couldn't process your request. Please try again."),
          sender: 'bot',
          timestamp: new Date(),
        };

        this.messages.push(errorMsg);

        if (error.status === 0 || error.status >= 500) {
          this.backendUnavailable = true;
        }
      },
    });
  }

  closeChat(): void {
    this.close.emit();
  }

  toggleExpand(): void {
    this.expand.emit(!this.expanded);
  }

  formatTimestamp(d: Date): string {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
}
