'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api-client';
import { useNotification } from '@/contexts/NotificationContext';
import { useConfirmDialog } from '@/contexts/ConfirmDialogContext';
import ModalDialog from '@/components/ModalDialog';

interface Term {
  id: string;
  title: string;
  content: string;
  module: string;
  status?: string;
}

const MODULE_OPTIONS = ['Invoice', 'Purchase', 'Contract', 'General'];

export default function TermsPage() {
  const { success, error: notifyError } = useNotification();
  const { confirm } = useConfirmDialog();

  const [terms, setTerms] = useState<Term[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [module, setModule] = useState('General');

  const [filterModule, setFilterModule] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const loadTerms = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet<Term[]>('/settings/terms');
      setTerms(Array.isArray(data) ? data : []);
    } catch (err: any) {
      notifyError('Failed to load terms: ' + (err.message ?? ''));
    } finally {
      setLoading(false);
    }
  }, [notifyError]);

  useEffect(() => { loadTerms(); }, [loadTerms]);

  const filteredTerms = useMemo(() => {
    let result = terms;
    if (filterModule) result = result.filter(t => t.module === filterModule);
    if (filterStatus) result = result.filter(t => (t.status ?? 'active') === filterStatus);
    return result;
  }, [terms, filterModule, filterStatus]);

  const openAddModal = () => {
    setEditingId(null);
    setTitle('');
    setContent('');
    setModule('General');
    setModalOpen(true);
  };

  const openEditModal = (term: Term) => {
    setEditingId(term.id);
    setTitle(term.title);
    setContent(term.content);
    setModule(term.module ?? 'General');
    setModalOpen(true);
  };

  const saveTerm = useCallback(async () => {
    if (!title.trim() || !content.trim()) return;
    setSaving(true);
    const body = { title: title.trim(), content: content.trim(), module };
    try {
      if (editingId) {
        await apiPut(`/settings/terms/${editingId}`, body);
        success('Term updated');
      } else {
        await apiPost('/settings/terms', body);
        success('Term added');
      }
      setModalOpen(false);
      loadTerms();
    } catch (err: any) {
      notifyError('Failed to save term: ' + (err.message ?? ''));
    } finally {
      setSaving(false);
    }
  }, [title, content, module, editingId, success, notifyError, loadTerms]);

  const deleteTerm = useCallback(async (term: Term) => {
    const ok = await confirm({
      title: 'Delete Term',
      message: `Delete "${term.title}"? This cannot be undone.`,
      type: 'danger',
      confirmText: 'Delete',
    });
    if (!ok) return;
    try {
      await apiDelete(`/settings/terms/${term.id}`);
      success('Term deleted');
      loadTerms();
    } catch (err: any) {
      notifyError('Delete failed: ' + (err.message ?? ''));
    }
  }, [confirm, success, notifyError, loadTerms]);

  const truncate = (str: string, len: number) => str.length > len ? str.substring(0, len) + '...' : str;

  const getModuleBadge = (mod: string) => {
    switch (mod) {
      case 'Invoice': return 'badge badge-info';
      case 'Purchase': return 'badge badge-warning';
      case 'Contract': return 'badge badge-success';
      default: return 'badge badge-info';
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1><i className="ri-file-list-2-line"></i> Terms & Conditions</h1>
        <button className="btn-primary" onClick={openAddModal}>
          <i className="ri-add-line"></i> Add Term
        </button>
      </div>

      {/* Filters */}
      <div className="card-container">
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div className="form-group" style={{ marginBottom: 0, minWidth: 140 }}>
            <label>Module</label>
            <select value={filterModule} onChange={e => setFilterModule(e.target.value)}>
              <option value="">All Modules</option>
              {MODULE_OPTIONS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 0, minWidth: 140 }}>
            <label>Status</label>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              <option value="">All</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          <button className="btn-secondary" onClick={() => { setFilterModule(''); setFilterStatus(''); }} style={{ alignSelf: 'flex-end' }}>
            <i className="ri-filter-off-line"></i> Clear
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="table-responsive" style={{ marginTop: 20 }}>
        {loading ? (
          <div className="empty-state"><div className="skeleton" style={{ height: 200 }}></div></div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Title</th>
                <th>Content</th>
                <th>Module</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredTerms.length === 0 ? (
                <tr><td colSpan={6} className="empty-state">No terms found.</td></tr>
              ) : filteredTerms.map((term, i) => (
                <tr key={term.id}>
                  <td>{i + 1}</td>
                  <td style={{ fontWeight: 600 }}>{term.title}</td>
                  <td style={{ fontSize: 13, color: 'var(--text-secondary)', maxWidth: 300 }}>{truncate(term.content, 100)}</td>
                  <td><span className={getModuleBadge(term.module)}>{term.module}</span></td>
                  <td>
                    <span className={`badge ${(term.status ?? 'active') === 'active' ? 'badge-success' : 'badge-danger'}`}>
                      {(term.status ?? 'active').charAt(0).toUpperCase() + (term.status ?? 'active').slice(1)}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn-primary" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => openEditModal(term)} title="Edit">
                        <i className="ri-pencil-line"></i>
                      </button>
                      <button className="btn-danger" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => deleteTerm(term)} title="Delete">
                        <i className="ri-delete-bin-line"></i>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add/Edit Modal */}
      <ModalDialog isOpen={modalOpen} title={editingId ? 'Edit Term' : 'Add Term'} size="lg" onClose={() => setModalOpen(false)}>
        <form onSubmit={e => { e.preventDefault(); saveTerm(); }}>
          <div className="form-group">
            <label>Title <span style={{ color: 'var(--danger)' }}>*</span></label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="Term title" required />
          </div>
          <div className="form-group">
            <label>Module</label>
            <select value={module} onChange={e => setModule(e.target.value)}>
              {MODULE_OPTIONS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Content <span style={{ color: 'var(--danger)' }}>*</span></label>
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="Enter term details..."
              rows={6}
              required
              style={{ resize: 'vertical' }}
            />
          </div>
          <div className="modal-footer">
            <button type="submit" className="btn-primary" disabled={saving || !title.trim() || !content.trim()}>
              <i className={editingId ? 'ri-save-line' : 'ri-add-line'}></i>
              {saving ? 'Saving...' : editingId ? 'Update Term' : 'Add Term'}
            </button>
            <button type="button" className="btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
          </div>
        </form>
      </ModalDialog>
    </div>
  );
}
