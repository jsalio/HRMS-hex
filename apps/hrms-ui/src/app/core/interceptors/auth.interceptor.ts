import { inject, type Provider } from '@angular/core'
import { HttpRequest, HttpHandlerFn, HTTP_INTERCEPTORS, HttpErrorResponse } from '@angular/common/http'
import { catchError, switchMap, throwError } from 'rxjs'
import { from } from 'rxjs'
import { AuthService } from '../services/auth.service'

export function authInterceptor(req: HttpRequest<unknown>, next: HttpHandlerFn) {
  const auth = inject(AuthService)
  const token = auth.getAccessToken()

  const authReq = token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req

  return next(authReq).pipe(
    catchError((err: unknown) => {
      if (err instanceof HttpErrorResponse && err.status === 401 && !req.url.includes('/auth/')) {
        return from(auth.refreshToken()).pipe(
          switchMap(() => {
            const retryToken = auth.getAccessToken()
            const retryReq = retryToken
              ? req.clone({ setHeaders: { Authorization: `Bearer ${retryToken}` } })
              : req
            return next(retryReq)
          })
        )
      }
      return throwError(() => err)
    })
  )
}
