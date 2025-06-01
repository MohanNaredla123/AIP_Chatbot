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
export class ChatComponent implements OnInit, AfterViewChecked {
  @Input() expanded = false;
  @Output() expand = new EventEmitter<boolean>();
  @Output() close = new EventEmitter<void>();
  @ViewChild('chatContainer') private chatContainer!: ElementRef;

  userMessage = '';
  messages: Message[] = [];
  loading = false;
  backendUnavailable = false;

  constructor(private chatService: ChatService) {}

  ngOnInit(): void {
    this.messages = this.mergeAdjacentMessages(this.chatService.getMessages());

    if (this.messages.length === 0) {
      this.chatService.addMessage({
        content: 'Hello! How can I assist you today?',
        sender: 'bot',
        timestamp: new Date(),
      });
      this.messages = this.mergeAdjacentMessages(
        this.chatService.getMessages()
      );
    }

    this.checkBackendAvailability();
  }

  private mergeAdjacentMessages(input: Message[]): Message[] {
    const out: Message[] = [];
    input.forEach((cur) => {
      const prev = out[out.length - 1];
      if (
        prev &&
        prev.sender === cur.sender &&
        Math.abs(cur.timestamp.getTime() - prev.timestamp.getTime()) < 5000
      ) {
        if (prev.content !== cur.content) {
          prev.content = `${prev.content}\n${cur.content}`;
        }
        prev.timestamp = cur.timestamp;
      } else {
        out.push({ ...cur });
      }
    });
    return out;
  }

  checkBackendAvailability(): void {
    this.chatService.checkBackendHealth().subscribe({
      next: (isHealthy) => {
        this.backendUnavailable = !isHealthy;
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

  sendMessage(): void {
    if (!this.userMessage.trim() || this.loading) return;

    const text = this.userMessage.trim();
    const userMsg: Message = {
      content: text,
      sender: 'user',
      timestamp: new Date(),
    };

    this.chatService.addMessage(userMsg);
    this.messages = this.mergeAdjacentMessages(this.chatService.getMessages());

    this.userMessage = '';
    this.loading = true;

    this.chatService.sendMessage(text).subscribe({
      next: () => {
        this.messages = this.mergeAdjacentMessages(
          this.chatService.getMessages()
        );
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

        this.chatService.addMessage(errorMsg);
        this.messages = this.mergeAdjacentMessages(
          this.chatService.getMessages()
        );

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
