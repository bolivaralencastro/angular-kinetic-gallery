import { bootstrapApplication } from '@angular/platform-browser';
import { provideHttpClient } from '@angular/common/http';
import { provideZonelessChangeDetection } from '@angular/core';

import { AppComponent } from './app.component';
import { initializeInteractiveCursor } from './utils/interactive-cursor';

bootstrapApplication(AppComponent, {
  providers: [
    provideZonelessChangeDetection(),
    provideHttpClient(),
  ],
})
  .then(() => {
    initializeInteractiveCursor();
  })
  .catch((error) => {
    console.error(error);
  });
