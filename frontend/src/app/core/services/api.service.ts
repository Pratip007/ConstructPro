import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  error?: string;
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);

  get<T>(path: string, params?: Record<string, string>): Observable<T> {
    let httpParams = new HttpParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        httpParams = httpParams.set(key, value);
      });
    }
    return this.http
      .get<ApiEnvelope<T>>(this.url(path), { params: httpParams })
      .pipe(map(this.unwrap));
  }

  post<T>(path: string, body: unknown): Observable<T> {
    return this.http
      .post<ApiEnvelope<T>>(this.url(path), body)
      .pipe(map(this.unwrap));
  }

  put<T>(path: string, body: unknown): Observable<T> {
    return this.http
      .put<ApiEnvelope<T>>(this.url(path), body)
      .pipe(map(this.unwrap));
  }

  delete<T>(path: string): Observable<T> {
    return this.http
      .delete<ApiEnvelope<T>>(this.url(path))
      .pipe(map(this.unwrap));
  }

  private url(path: string): string {
    return `${environment.apiUrl}${path}`;
  }

  private readonly unwrap = <T>(res: ApiEnvelope<T>): T => {
    if (!res.success) {
      throw new Error(res.error ?? 'Unknown API error');
    }
    return res.data;
  };
}
