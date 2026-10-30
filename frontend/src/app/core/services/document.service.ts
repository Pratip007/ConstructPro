import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiService } from './api.service';

export interface DocumentInfo {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  category: string;
  referenceId: string;
  uploadedAt: string;
  url: string;
}

@Injectable({ providedIn: 'root' })
export class DocumentService {
  private readonly api = inject(ApiService);
  private readonly http = inject(HttpClient);

  uploadDocument(file: File, category: string, referenceId: string): Observable<DocumentInfo> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('category', category);
    formData.append('referenceId', referenceId);
    return this.http
      .post<{ success: boolean; data: DocumentInfo }>(`${environment.apiUrl}/documents/upload`, formData)
      .pipe(map(res => res.data));
  }

  getDocuments(referenceId: string): Observable<DocumentInfo[]> {
    return this.api.get<DocumentInfo[]>('/documents', { referenceId });
  }

  deleteDocument(id: string): Observable<void> {
    return this.api.delete<void>(`/documents/${id}`);
  }

  getDocumentUrl(id: string): Observable<string> {
    return this.api.get<{ url: string }>(`/documents/${id}/url`).pipe(map(res => res.url));
  }

  previewDocument(doc: DocumentInfo): void {
    const previewUrl = doc.url || `${environment.apiUrl}/documents/${doc.id}/url`;
    const isImage = /\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(doc.fileName);
    const isPdf = /\.pdf$/i.test(doc.fileName);

    if (isImage || isPdf) {
      window.open(previewUrl, '_blank', 'width=900,height=700,scrollbars=yes');
    } else {
      this.downloadDocument(doc.id, doc.fileName).subscribe();
    }
  }

  downloadDocument(id: string, fileName: string): Observable<void> {
    return this.http
      .get(`${environment.apiUrl}/documents/${id}/download`, { responseType: 'blob' })
      .pipe(
        map(blob => {
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = fileName;
          a.click();
          window.URL.revokeObjectURL(url);
        })
      );
  }

  uploadBase64(base64: string, fileName: string, category: string, referenceId: string): Observable<DocumentInfo> {
    return this.api.post<DocumentInfo>('/documents/upload-base64', {
      base64,
      fileName,
      category,
      referenceId,
    });
  }

  fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }
}
