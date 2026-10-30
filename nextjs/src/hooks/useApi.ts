'use client';

import { useCallback, useMemo } from 'react';

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  error?: string;
}

function normalizeUrl(url: string): string {
  if (url.startsWith('http') || url.startsWith('/api/')) return url;
  return `/api${url.startsWith('/') ? url : `/${url}`}`;
}

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  // credentials: 'same-origin' ensures the httpOnly cookie is sent automatically
  const res = await fetch(normalizeUrl(url), {
    method,
    headers,
    credentials: 'same-origin',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401) {
    // Cookie expired — server will have cleared it; redirect to login
    window.location.href = '/login';
    throw new Error('Session expired');
  }

  const envelope: ApiEnvelope<T> = await res.json();
  if (!envelope.success) {
    throw new Error(envelope.error || 'Request failed');
  }
  return envelope.data;
}

export function useApi() {
  const apiGet = useCallback(async <T,>(url: string, params?: Record<string, string>): Promise<T> => {
    let finalUrl = url;
    if (params) {
      const searchParams = new URLSearchParams(params);
      finalUrl += (url.includes('?') ? '&' : '?') + searchParams.toString();
    }
    return request<T>('GET', finalUrl);
  }, []);

  const apiPost = useCallback(async <T,>(url: string, body: unknown): Promise<T> => {
    return request<T>('POST', url, body);
  }, []);

  const apiPut = useCallback(async <T,>(url: string, body: unknown): Promise<T> => {
    return request<T>('PUT', url, body);
  }, []);

  const apiDelete = useCallback(async <T,>(url: string, body?: unknown): Promise<T> => {
    return request<T>('DELETE', url, body);
  }, []);

  return useMemo(
    () => ({ apiGet, apiPost, apiPut, apiDelete, get: apiGet, post: apiPost, put: apiPut, del: apiDelete }),
    [apiGet, apiPost, apiPut, apiDelete]
  );
}
