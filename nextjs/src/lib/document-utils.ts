'use client';

import { apiGet, apiPost, apiDelete } from './api-client';

export interface DocumentInfo {
  id: number;
  name: string;
  type: string;
  size: number;
  url: string;
  entityType: string;
  entityId: number;
  uploadedBy: number;
  createdAt: string;
}

export async function uploadDocument(
  file: File,
  entityType: string,
  entityId: number
): Promise<DocumentInfo> {
  const base64 = await fileToBase64(file);
  return apiPost<DocumentInfo>('/documents/upload', {
    fileName: file.name,
    fileType: file.type,
    fileSize: file.size,
    base64Data: base64,
    entityType,
    entityId,
  });
}

export async function getDocuments(entityType: string, entityId: number): Promise<DocumentInfo[]> {
  return apiGet<DocumentInfo[]>('/documents', { entityType, entityId: String(entityId) });
}

export async function deleteDocument(id: number): Promise<void> {
  return apiDelete<void>(`/documents/${id}`);
}

export function previewDocument(url: string): void {
  window.open(url, '_blank');
}

export function downloadDocument(url: string, fileName: string): void {
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.target = '_blank';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export async function uploadBase64(
  base64Data: string,
  fileName: string,
  fileType: string,
  entityType: string,
  entityId: number
): Promise<DocumentInfo> {
  return apiPost<DocumentInfo>('/documents/upload', {
    fileName,
    fileType,
    fileSize: Math.ceil(base64Data.length * 0.75),
    base64Data,
    entityType,
    entityId,
  });
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1] || result;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
