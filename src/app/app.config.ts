import { ApplicationConfig, provideAppInitializer, inject, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter }          from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';

import { BrandService } from './services/brand.service';

import { routes }                from './app.routes';
import {
  authInterceptor,
  loggingInterceptor,
  errorInterceptor,
} from './core/interceptors';
import { QUERY_SERVICE_TOKEN }   from './core/query-service.interface';
import { QueryServiceFacade }    from './services/query-facade.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),

    // HTTP client with ordered interceptors:
    //   1. auth        — attaches Bearer token from localStorage
    //   2. logging     — dev-only request/response console logging
    //   3. error       — maps HTTP errors → ApiError signal on AppConfigService
    provideHttpClient(
      withInterceptors([
        authInterceptor,
        loggingInterceptor,
        errorInterceptor,
      ]),
    ),

    // Brand system — reads ?brand= param (or localStorage) and applies
    // CSS token overrides before the first component renders.
    provideAppInitializer(() => inject(BrandService).init()),

    // Data-source abstraction — inject QUERY_SERVICE_TOKEN instead of
    // QueryService in all components.  The facade reads AppConfigService
    // .useRealApi() on every call to route to mock or real API.
    {
      provide:  QUERY_SERVICE_TOKEN,
      useExisting: QueryServiceFacade,
    },
  ],
};
