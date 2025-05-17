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

  @Input('api-base') apiBase = 'http://localhost:5005/webhooks/rest/webhook';

  constructor(private chatSvc: ChatService) {
    this.chatSvc.setApiBase(this.apiBase);
  }

  ngOnChanges(ch: SimpleChanges): void {
    if (ch['apiBase'] && ch['apiBase'].currentValue) {
      this.chatSvc.setApiBase(ch['apiBase'].currentValue);
    }
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
