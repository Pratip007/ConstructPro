'use client';

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  error?: string;
}

function getAuthHeaders(): HeadersInit {
  const token = typeof window !== 'undefined' ? localStorage.getItem('atr_access_token') : null;
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

function handleUnauthorized() {
  if (typeof window !== 'undefined') {
    const keys = Object.keys(localStorage).filter(k => k.startsWith('atr_'));
    keys.forEach(k => localStorage.removeItem(k));
    window.location.href = '/login';
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const url = `/api${path}`;
  const res = await fetch(url, {
    method,
    headers: getAuthHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) {
    handleUnauthorized();
    throw new Error('Unauthorized');
  }
  const envelope: ApiEnvelope<T> = await res.json();
  if (!envelope.success) throw new Error(envelope.error || 'Request failed');
  return envelope.data;
}

export function apiGet<T>(path: string, params?: Record<string, string>): Promise<T> {
  let url = path;
  if (params) {
    const searchParams = new URLSearchParams(params);
    url += `?${searchParams.toString()}`;
  }
  return request<T>('GET', url);
}

export function apiPost<T>(path: string, body: unknown): Promise<T> {
  return request<T>('POST', path, body);
}

export function apiPut<T>(path: string, body: unknown): Promise<T> {
  return request<T>('PUT', path, body);
}

export function apiDelete<T>(path: string): Promise<T> {
  return request<T>('DELETE', path);
}
