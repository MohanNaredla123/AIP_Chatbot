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

  private previousRole: string = '';

  constructor(private chatSvc: ChatService, private http: HttpClient) {
    this.chatSvc.setApiBase(this.apiBase);
  }

  ngOnChanges(ch: SimpleChanges): void {
    if (ch['apiBase'] && ch['apiBase'].currentValue) {
      this.chatSvc.setApiBase(ch['apiBase'].currentValue);
    }

    if (
      ch['role'] &&
      ch['role'].currentValue &&
      ch['role'].currentValue !== this.previousRole
    ) {
      this.previousRole = ch['role'].currentValue;
      this.updateRoleConfig(ch['role'].currentValue);
    }
  }

  private updateRoleConfig(role: string): void {
    const roleEndpoint = `${this.apiBase}/update-role`;

    this.http.post(roleEndpoint, { role }).subscribe({
      next: (response) => {
        console.log('Role updated successfully:', response);
        this.chatSvc.clearMessages();
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
