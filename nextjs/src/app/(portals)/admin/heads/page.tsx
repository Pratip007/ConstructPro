'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api-client';
import { useNotification } from '@/contexts/NotificationContext';
import { useConfirmDialog } from '@/contexts/ConfirmDialogContext';

interface Head {
  id: string;
  name: string;
  type: string;
  description?: string;
  status?: string;
}

export default function HeadsPage() {
  const { success, error: notifyError } = useNotification();
  const { confirm } = useConfirmDialog();

  const [heads, setHeads] = useState<Head[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [type, setType] = useState('Expense');
  const [description, setDescription] = useState('');

  const [filterType, setFilterType] = useState('');

  const loadHeads = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet<Head[]>('/settings/heads');
      setHeads(Array.isArray(data) ? data : []);
    } catch (err: any) {
      notifyError('Failed to load heads: ' + (err.message ?? ''));
    } finally {
      setLoading(false);
    }
  }, [notifyError]);

  useEffect(() => { loadHeads(); }, [loadHeads]);

  const filteredHeads = useMemo(() => {
    if (!filterType) return heads;
    return heads.filter(h => h.type === filterType);
  }, [heads, filterType]);

  const resetForm = useCallback(() => {
    setEditingId(null);
    setName('');
    setType('Expense');
    setDescription('');
  }, []);

  const saveHead = useCallback(async () => {
    if (!name.trim()) return;
    setSaving(true);
    const body = { name: name.trim(), type, description: description.trim() };
    try {
      if (editingId) {
        await apiPut(`/settings/heads/${editingId}`, body);
        success('Head updated');
      } else {
        await apiPost('/settings/heads', body);
        success('Head added');
      }
      resetForm();
      loadHeads();
    } catch (err: any) {
      notifyError('Failed to save head: ' + (err.message ?? ''));
    } finally {
      setSaving(false);
    }
  }, [name, type, description, editingId, success, notifyError, resetForm, loadHeads]);

  const editHead = useCallback((h: Head) => {
    setEditingId(h.id);
    setName(h.name);
    setType(h.type ?? 'Expense');
    setDescription(h.description ?? '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const deleteHead = useCallback(async (h: Head) => {
    const ok = await confirm({
      title: 'Delete Head',
      message: `Delete head "${h.name}"? This cannot be undone.`,
      type: 'danger',
      confirmText: 'Delete',
    });
    if (!ok) return;
    try {
      await apiDelete(`/settings/heads/${h.id}`);
      success('Head deleted');
      loadHeads();
    } catch (err: any) {
      notifyError('Delete failed: ' + (err.message ?? ''));
    }
  }, [confirm, success, notifyError, loadHeads]);

  const incomeCount = useMemo(() => heads.filter(h => h.type === 'Income').length, [heads]);
  const expenseCount = useMemo(() => heads.filter(h => h.type === 'Expense').length, [heads]);

  return (
    <div className="page-container">
      <div className="page-header">
        <h1><i className="ri-list-check-2"></i> Head Allotments</h1>
        <div style={{ display: 'flex', gap: 8, fontSize: 13 }}>
          <span className="badge badge-success">Income: {incomeCount}</span>
          <span className="badge badge-danger">Expense: {expenseCount}</span>
        </div>
      </div>

      {/* Add/Edit Form */}
      <div className="card-container">
        <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, color: 'var(--accent)' }}>
          {editingId ? 'Edit Head' : 'Add New Head'}
        </h3>
        <form onSubmit={e => { e.preventDefault(); saveHead(); }}>
          <div className="form-grid">
            <div className="form-group">
              <label>Name <span style={{ color: 'var(--danger)' }}>*</span></label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Salary, Rent, Office Supplies"
                required
              />
            </div>
            <div className="form-group">
              <label>Type <span style={{ color: 'var(--danger)' }}>*</span></label>
              <select value={type} onChange={e => setType(e.target.value)}>
                <option value="Income">Income</option>
                <option value="Expense">Expense</option>
              </select>
            </div>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label>Description</label>
              <input
                type="text"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Optional description"
              />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
            <button type="submit" className="btn-primary" disabled={saving || !name.trim()}>
              <i className={editingId ? 'ri-save-line' : 'ri-add-line'}></i>
              {editingId ? 'Update Head' : 'Add Head'}
            </button>
            {editingId && (
              <button type="button" className="btn-secondary" onClick={resetForm}>Cancel</button>
            )}
          </div>
        </form>
      </div>

      {/* Filter */}
      <div className="card-container" style={{ marginTop: 20 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div className="form-group" style={{ marginBottom: 0, minWidth: 140 }}>
            <label>Filter by Type</label>
            <select value={filterType} onChange={e => setFilterType(e.target.value)}>
              <option value="">All</option>
              <option value="Income">Income</option>
              <option value="Expense">Expense</option>
            </select>
          </div>
          {filterType && (
            <button className="btn-secondary" onClick={() => setFilterType('')} style={{ alignSelf: 'flex-end' }}>
              <i className="ri-filter-off-line"></i> Clear
            </button>
          )}
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
                <th>Name</th>
                <th>Type</th>
                <th>Description</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredHeads.length === 0 ? (
                <tr><td colSpan={6} className="empty-state">No heads found.</td></tr>
              ) : filteredHeads.map((h, i) => (
                <tr key={h.id}>
                  <td>{i + 1}</td>
                  <td style={{ fontWeight: 600 }}>{h.name}</td>
                  <td>
                    <span className={`badge ${h.type === 'Income' ? 'badge-success' : 'badge-danger'}`}>
                      {h.type}
                    </span>
                  </td>
                  <td style={{ color: 'var(--text-secondary)' }}>{h.description || '--'}</td>
                  <td>
                    <span className={`badge ${(h.status ?? 'active') === 'active' ? 'badge-success' : 'badge-danger'}`}>
                      {(h.status ?? 'active').charAt(0).toUpperCase() + (h.status ?? 'active').slice(1)}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn-primary" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => editHead(h)} title="Edit">
                        <i className="ri-pencil-line"></i>
                      </button>
                      <button className="btn-danger" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => deleteHead(h)} title="Delete">
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
    </div>
  );
}
