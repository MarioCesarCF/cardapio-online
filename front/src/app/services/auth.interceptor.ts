import {
  HttpErrorResponse,
  HttpHandlerFn,
  HttpInterceptorFn,
  HttpRequest,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, from, mergeMap, throwError } from 'rxjs';
import { AuthService } from './auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);

  return from(auth.tokenForRequest()).pipe(
    mergeMap((token) => {
      const headers = token ? req.headers.set('Authorization', `Bearer ${token}`) : req.headers;
      return next(req.clone({ headers })).pipe(
        catchError((error: HttpErrorResponse) => {
          if (error.status === 401 && token) {
            return from(auth.refresh()).pipe(
              mergeMap((fresh) => {
                if (!fresh) {
                  return throwError(() => error);
                }
                const headers2 = req.headers.set('Authorization', `Bearer ${fresh}`);
                return next(req.clone({ headers: headers2 }));
              }),
            );
          }
          return throwError(() => error);
        }),
      );
    }),
  );
};
