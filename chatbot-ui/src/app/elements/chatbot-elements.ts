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

  (ChatbotElement as any).observedAttributes = ['api-base', 'role', 'user-id'];

  (ChatbotElement as any).prototype.attributeChangedCallback = function (
    name: string,
    oldValue: string | null,
    newValue: string | null
  ) {
    if (oldValue === newValue) return;

    console.log(
      `Attribute Changed: ${name}, Old Value: ${oldValue}, New Value: ${newValue}`
    );

    const propertyMap: { [key: string]: string } = {
      'api-base': 'apiBase',
      role: 'role',
      'user-id': 'userId',
    };

    const propertyName = propertyMap[name];
    if (propertyName && newValue !== null) {
      (this as any)[propertyName] = newValue;
    }
  };

  if (!customElements.get('chatbot-element')) {
    customElements.define('chatbot-element', ChatbotElement);
  }
}

registerChatbotElement();
