import 'zone.js';
import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { provideRouter } from '@angular/router';
import { routes } from './app/app.routes';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { authInterceptor } from './app/interceptors/auth.interceptor';
import { provideNativeDateAdapter } from '@angular/material/core';
import { environment } from './environments/environment';
import { provideFirebaseApp, initializeApp } from '@angular/fire/app';
import { provideAuth, getAuth } from '@angular/fire/auth';
import { provideFirestore, getFirestore } from '@angular/fire/firestore';
import { HashLocationStrategy, LocationStrategy } from '@angular/common';
import { OverlayContainer } from '@angular/cdk/overlay';
import { provideClientHydration } from '@angular/platform-browser';

// Відключення service worker для розширення Chrome (CSP compliant)
if ('serviceWorker' in navigator && !window.location.protocol.startsWith('chrome-extension')) {
  navigator.serviceWorker.getRegistrations().then(registrations => {
    for (const registration of registrations) {
      registration.unregister().catch(() => {/* ignore error */});
    }
  });
}

bootstrapApplication(AppComponent, {
  providers: [
    provideRouter(routes),
    provideAnimations(),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideNativeDateAdapter(),
    provideFirebaseApp(() => initializeApp(environment.firebase)),
    provideAuth(() => getAuth()),
    provideFirestore(() => getFirestore()),
    provideClientHydration(),
    { provide: LocationStrategy, useClass: HashLocationStrategy }
  ]
}).then(appRef => {
  // Фікс для overlay-контейнера Angular Material у Chrome Extension
  const overlayContainer = appRef.injector.get(OverlayContainer);
  if (overlayContainer.getContainerElement().parentElement !== document.body) {
    document.body.appendChild(overlayContainer.getContainerElement());
  }
}).catch(err => console.error(err)); 
