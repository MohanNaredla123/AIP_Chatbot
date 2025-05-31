import {
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  ViewEncapsulation,
  Input,
  OnChanges,
  SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChatComponent } from './chat/chat.component';
import { ChatService } from './services/chat.service';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, ChatComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  encapsulation: ViewEncapsulation.ShadowDom,
})
export class AppComponent implements OnChanges {
  title = 'chatbot-ui';
  isChatOpen = false;
  isChatExpanded = false;

  @Input('api-base') apiBase = 'http://localhost:8000';
  @Input('role') role = '';
  @Input('user-id') userId = '';

  constructor(private chatSvc: ChatService, private http: HttpClient) {
    this.chatSvc.setApiBase(this.apiBase);

    const storedUserId = this.getStoredUserId();
    if (storedUserId && !this.userId) {
      this.userId = storedUserId;
      this.chatSvc.setUserId(storedUserId);
    }
  }

  ngOnChanges(ch: SimpleChanges): void {
    if (ch['userId']) {
      const newUserId = ch['userId'].currentValue;
      const previousUserId = ch['userId'].previousValue;

      if (newUserId !== previousUserId && !ch['userId'].firstChange) {
        console.log(`User ID changed from ${previousUserId} to ${newUserId}`);
        this.chatSvc.setUserId(newUserId);
      } else if (ch['userId'].firstChange && newUserId) {
        this.chatSvc.setUserId(newUserId);
      }
    }

    if (ch['role'] && ch['role'].currentValue !== ch['role'].previousValue) {
      this.updateRoleConfig(ch['role'].currentValue);
    }
  }

  private getStoredUserId(): string | null {
    try {
      return sessionStorage.getItem('chatbot_user_id');
    } catch (e) {
      return null;
    }
  }

  private updateRoleConfig(role: string): void {
    if (!role) return;

    const roleEndpoint = `${this.apiBase}/update-role`;

    this.http.post(roleEndpoint, { role }).subscribe({
      next: (response) => {
        console.log('Role updated successfully:', response);
      },
      error: (error) => {
        console.error('Failed to update role:', error);
      },
    });
  }

  toggleChat(): void {
    this.isChatOpen = !this.isChatOpen;
    if (!this.isChatOpen) this.isChatExpanded = false;
  }

  handleCloseChat(): void {
    this.isChatOpen = false;
    this.isChatExpanded = false;
  }

  handleToggleExpand(state: boolean): void {
    this.isChatExpanded = state;
  }
}
