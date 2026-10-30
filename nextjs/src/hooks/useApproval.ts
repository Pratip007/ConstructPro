'use client';

import { useCallback } from 'react';
import { apiGet, apiPost, apiPut } from '@/lib/api-client';
import { useAuth } from '@/contexts/AuthContext';

export interface ApprovalRequest {
  module: string;
  actionType: 'create' | 'update' | 'delete';
  summary: string;
  data: any;
  oldData?: any;
  reason?: string;
  referenceId?: string | number;
}

export interface ApprovalItem {
  id: string;
  module: string;
  actionType: 'create' | 'update' | 'delete';
  summary: string;
  data: any;
  oldData?: any;
  reason?: string;
  referenceId?: string | number;
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

export function useApproval() {
  const { user } = useAuth();

  const requiresApproval = useCallback((): boolean => {
    const role = user?.role;
    return role === 'office' || role === 'supervisor';
  }, [user]);

  const submitForApproval = useCallback((request: ApprovalRequest): Promise<ApprovalItem> => {
    return apiPost<ApprovalItem>('/approvals', request);
  }, []);

  const getPendingApprovals = useCallback((source?: 'office' | 'supervisor'): Promise<ApprovalItem[]> => {
    const params: Record<string, string> = { status: 'pending' };
    if (source) params['source'] = source;
    return apiGet<ApprovalItem[]>('/approvals', params);
  }, []);

  const getPendingCounts = useCallback((): Promise<{ office: number; supervisor: number; total: number }> => {
    return apiGet<{ office: number; supervisor: number; total: number }>('/approvals/pending-counts');
  }, []);

  const approveRequest = useCallback((id: string, remarks?: string): Promise<ApprovalItem> => {
    return apiPut<ApprovalItem>(`/approvals/${id}/approve`, { remarks });
  }, []);

  const rejectRequest = useCallback((id: string, remarks?: string): Promise<ApprovalItem> => {
    return apiPut<ApprovalItem>(`/approvals/${id}/reject`, { remarks });
  }, []);

  const getApprovalHistory = useCallback((filters?: ApprovalFilters): Promise<ApprovalItem[]> => {
    const params: Record<string, string> = {};
    if (filters) {
      if (filters.source) params['source'] = filters.source;
      if (filters.status) params['status'] = filters.status;
      if (filters.module) params['module'] = filters.module;
      if (filters.dateFrom) params['dateFrom'] = filters.dateFrom;
      if (filters.dateTo) params['dateTo'] = filters.dateTo;
      if (filters.search) params['search'] = filters.search;
    }
    return apiGet<ApprovalItem[]>('/approvals', params);
  }, []);

  const getApprovalLogs = useCallback((): Promise<ApprovalLog[]> => {
    return apiGet<ApprovalLog[]>('/approvals/logs');
  }, []);

  return {
    requiresApproval,
    submitForApproval,
    getPendingApprovals,
    getPendingCounts,
    approveRequest,
    rejectRequest,
    getApprovalHistory,
    getApprovalLogs,
  };
}
