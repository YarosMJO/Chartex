import { OverlayContainer } from '@angular/cdk/overlay';
import { HashLocationStrategy, LocationStrategy } from '@angular/common';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { initializeApp, provideFirebaseApp } from '@angular/fire/app';
import { getAuth, provideAuth } from '@angular/fire/auth';
import { getFirestore, provideFirestore } from '@angular/fire/firestore';
import { provideNativeDateAdapter } from '@angular/material/core';
import { MatDialogModule } from '@angular/material/dialog';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { bootstrapApplication, provideClientHydration } from '@angular/platform-browser';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { TranslateLoader, TranslateModule, TranslateService } from '@ngx-translate/core';
import { importProvidersFrom } from '@angular/core';
import 'zone.js';
import { AppComponent } from './app/app.component';
import { routes } from './app/app.routes';
import { authInterceptor } from './app/interceptors/auth.interceptor';
import { CustomTranslateLoader } from './app/utils/translate-loader';
import { environment } from './environments/environment';

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
    importProvidersFrom(MatDialogModule, MatSnackBarModule, TranslateModule.forRoot()),
    provideFirebaseApp(() => initializeApp(environment.firebase)),
    provideAuth(() => getAuth()),
    provideFirestore(() => getFirestore()),
    provideClientHydration(),
    { provide: LocationStrategy, useClass: HashLocationStrategy },
    {
      provide: TranslateLoader,
      useClass: CustomTranslateLoader
    },
    {
      provide: TranslateService,
      useClass: TranslateService
    }
  ]
}).then(appRef => {
  // Фікс для overlay-контейнера Angular Material у Chrome Extension
  const overlayContainer = appRef.injector.get(OverlayContainer);
  if (overlayContainer.getContainerElement().parentElement !== document.body) {
    document.body.appendChild(overlayContainer.getContainerElement());
  }
}).catch(err => console.error(err)); 
