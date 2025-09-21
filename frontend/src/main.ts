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
import { importProvidersFrom, ErrorHandler, Injectable } from '@angular/core';
import 'zone.js';

// Глобальний обробник помилок для діагностики
window.addEventListener('error', (event) => {
  console.error('Global error caught:', event.error);
  console.error('Error message:', event.message);
  console.error('Error filename:', event.filename);
  console.error('Error line:', event.lineno);
  console.error('Error column:', event.colno);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
});

// Custom Angular Error Handler
@Injectable()
class GlobalErrorHandler implements ErrorHandler {
  handleError(error: any): void {
    console.error('Angular Error Handler caught:', error);
    if (error?.message?.includes('Element not found')) {
      console.error('Element not found error details:', {
        error: error,
        stack: error.stack,
        message: error.message
      });
    }
  }
}
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
    },
    {
      provide: ErrorHandler,
      useClass: GlobalErrorHandler
    }
  ]
}).then(appRef => {
  console.log('Application bootstrapped successfully');
  
  // Фікс для overlay-контейнера Angular Material у Chrome Extension
  // Використовуємо більшу затримку для забезпечення повної готовності DOM
  setTimeout(() => {
    try {
      console.log('Setting up overlay container...');
      
      // Перевіряємо готовність DOM
      if (document.readyState !== 'complete') {
        console.log('DOM not ready, waiting...');
        document.addEventListener('DOMContentLoaded', () => {
          console.log('DOM ready, setting up overlay...');
          setupOverlay(appRef);
        });
      } else {
        setupOverlay(appRef);
      }
      
    } catch (error) {
      console.error('Error setting up overlay container:', error);
    }
  }, 100);
  
  function setupOverlay(appRef: any) {
    try {
      const overlayContainer = appRef.injector.get(OverlayContainer);
      const containerElement = overlayContainer.getContainerElement();
      
      console.log('Overlay container element:', containerElement);
      
      if (containerElement && document.body && containerElement.parentElement !== document.body) {
        document.body.appendChild(containerElement);
        console.log('Overlay container moved to body');
      }
      
      // Додаткова перевірка для CDK overlay
      const cdkOverlayContainer = document.querySelector('.cdk-overlay-container');
      if (!cdkOverlayContainer && document.body) {
        const newContainer = document.createElement('div');
        newContainer.className = 'cdk-overlay-container';
        newContainer.style.position = 'fixed';
        newContainer.style.top = '0';
        newContainer.style.left = '0';
        newContainer.style.height = '100%';
        newContainer.style.width = '100%';
        newContainer.style.pointerEvents = 'none';
        newContainer.style.zIndex = '1000';
        document.body.appendChild(newContainer);
        console.log('Manual CDK overlay container created with styles');
      }
      
    } catch (error) {
      console.error('Error in setupOverlay:', error);
    }
  }
}).catch(err => {
  console.error('Bootstrap error:', err);
  // Показати помилку користувачу
  if (document.body) {
    document.body.innerHTML = `<div style="padding: 20px; color: red;">Error loading application: ${err.message}</div>`;
  }
}); 
