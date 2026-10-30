'use client';

import { apiGet, apiPost } from './api-client';
type UserLike = { role?: string } | null;

export interface ApprovalRequest {
  id: number;
  entityType: string;
  entityId: number;
  action: string;
  data: Record<string, unknown>;
  submittedBy: number;
  submittedByName: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewedBy?: number;
  reviewedByName?: string;
  remarks?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PendingCounts {
  total: number;
  byType: Record<string, number>;
}

export function requiresApproval(user: UserLike): boolean {
  return user?.role === 'office' || user?.role === 'supervisor';
}

export async function submitForApproval(
  entityType: string,
  entityId: number,
  action: string,
  data: Record<string, unknown>
): Promise<ApprovalRequest> {
  return apiPost<ApprovalRequest>('/approvals/submit', {
    entityType,
    entityId,
    action,
    data,
  });
}

export async function getPendingApprovals(
  entityType?: string,
  page: number = 1,
  limit: number = 20
): Promise<{ approvals: ApprovalRequest[]; total: number }> {
  const params: Record<string, string> = { page: String(page), limit: String(limit) };
  if (entityType) params.entityType = entityType;
  return apiGet('/approvals/pending', params);
}

export async function getPendingCounts(): Promise<PendingCounts> {
  return apiGet<PendingCounts>('/approvals/counts');
}

export async function approveRequest(id: number, remarks?: string): Promise<ApprovalRequest> {
  return apiPost<ApprovalRequest>(`/approvals/${id}/approve`, { remarks });
}

export async function rejectRequest(id: number, remarks: string): Promise<ApprovalRequest> {
  return apiPost<ApprovalRequest>(`/approvals/${id}/reject`, { remarks });
}
