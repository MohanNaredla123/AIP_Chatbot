import { createCustomElement } from '@angular/elements';
import { createApplication } from '@angular/platform-browser';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { provideZoneChangeDetection } from '@angular/core';
import {
  provideClientHydration,
  withEventReplay,
} from '@angular/platform-browser';

import { AppComponent } from '../app.component';
import { ChatService } from '../services/chat.service';

async function registerChatbotElement() {
  const app = await createApplication({
    providers: [
      provideZoneChangeDetection({ eventCoalescing: true }),
      provideHttpClient(withFetch()),
      provideClientHydration(withEventReplay()),
      ChatService,
    ],
  });

  const ChatbotElement = createCustomElement(AppComponent, {
    injector: app.injector,
  });

  (ChatbotElement as any).observedAttributes = ['api-base', 'role', 'rag-url'];

  (ChatbotElement as any).prototype.attributeChangedCallback = function (
    name: string,
    _old: string,
    value: string
  ) {
    if (name === 'api-base') {
      (this as any).apiBase = value;
    }
    if (name === 'role') {
      (this as any).role = value;
    }
    if (name === 'rag-url') {
      (this as any).ragUrl = value;
    }
  };

  if (!customElements.get('chatbot-element')) {
    customElements.define('chatbot-element', ChatbotElement);
  }
}

registerChatbotElement();
