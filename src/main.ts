import { bootstrapApplication } from '@angular/platform-browser';
import { provideHttpClient } from '@angular/common/http';
import { APP_INITIALIZER, provideZonelessChangeDetection } from '@angular/core';

import { AppComponent } from './app.component';
import { AuthService } from './services/auth.service';

function restoreAuthSession(authService: AuthService): () => Promise<void> {
  return () => authService.initialize();
}

bootstrapApplication(AppComponent, {
  providers: [
    provideZonelessChangeDetection(),
    provideHttpClient(),
    {
      provide: APP_INITIALIZER,
      useFactory: restoreAuthSession,
      deps: [AuthService],
      multi: true,
    },
  ],
})
  .then(() => {
    if ('serviceWorker' in navigator) {
      const registerServiceWorker = () => {
        navigator.serviceWorker.register('service-worker.js').catch(error => {
          console.error('Falha ao registrar o service worker:', error);
        });
      };

      if (document.readyState === 'complete') {
        registerServiceWorker();
      } else {
        window.addEventListener('load', registerServiceWorker, { once: true });
      }
    }
  })
  .catch(error => {
    console.error('Falha ao inicializar a aplicação:', error);
  });