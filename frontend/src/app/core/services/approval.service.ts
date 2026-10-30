import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { AuthService } from './auth.service';

export interface ApprovalRequest {
  module: string;
  actionType: 'create' | 'update' | 'delete';
  summary: string;
  data: any;
  oldData?: any;
  reason?: string;
  referenceId?: string;
}

export interface ApprovalItem {
  id: string;
  module: string;
  actionType: 'create' | 'update' | 'delete';
  summary: string;
  data: any;
  oldData?: any;
  reason?: string;
  referenceId?: string;
  source: 'office' | 'supervisor';
  submittedBy: string;
  submittedAt: string;
  status: 'pending' | 'approved' | 'rejected';
  remarks?: string;
  decidedBy?: string;
  decidedAt?: string;
}

export interface ApprovalLog {
  id: string;
  module: string;
  actionType: string;
  summary: string;
  source: 'office' | 'supervisor';
  submittedBy: string;
  submittedAt: string;
  status: 'approved' | 'rejected';
  remarks?: string;
  decidedBy: string;
  decidedAt: string;
}

export interface ApprovalFilters {
  source?: 'office' | 'supervisor';
  status?: 'pending' | 'approved' | 'rejected';
  module?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}

@Injectable({ providedIn: 'root' })
export class ApprovalService {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);

  requiresApproval(): boolean {
    const role = this.auth.currentUser()?.role;
    return role === 'office' || role === 'supervisor';
  }

  submitForApproval(request: ApprovalRequest): Observable<ApprovalItem> {
    return this.api.post<ApprovalItem>('/approvals', request);
  }

  getPendingApprovals(source?: 'office' | 'supervisor'): Observable<ApprovalItem[]> {
    const params: Record<string, string> = { status: 'pending' };
    if (source) params['source'] = source;
    return this.api.get<ApprovalItem[]>('/approvals', params);
  }

  getPendingCounts(): Observable<{ office: number; supervisor: number; total: number }> {
    return this.api.get<{ office: number; supervisor: number; total: number }>('/approvals/pending-counts');
  }

  approveRequest(id: string, remarks?: string): Observable<ApprovalItem> {
    return this.api.put<ApprovalItem>(`/approvals/${id}/approve`, { remarks });
  }

  rejectRequest(id: string, remarks?: string): Observable<ApprovalItem> {
    return this.api.put<ApprovalItem>(`/approvals/${id}/reject`, { remarks });
  }

  getApprovalHistory(filters?: ApprovalFilters): Observable<ApprovalItem[]> {
    const params: Record<string, string> = {};
    if (filters) {
      if (filters.source) params['source'] = filters.source;
      if (filters.status) params['status'] = filters.status;
      if (filters.module) params['module'] = filters.module;
      if (filters.dateFrom) params['dateFrom'] = filters.dateFrom;
      if (filters.dateTo) params['dateTo'] = filters.dateTo;
      if (filters.search) params['search'] = filters.search;
    }
    return this.api.get<ApprovalItem[]>('/approvals', params);
  }

  getApprovalLogs(): Observable<ApprovalLog[]> {
    return this.api.get<ApprovalLog[]>('/approvals/logs');
  }
}
