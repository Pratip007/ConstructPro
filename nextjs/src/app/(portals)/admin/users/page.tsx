'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { apiGet, apiPost } from '@/lib/api-client';
import { useNotification } from '@/contexts/NotificationContext';
import { useConfirmDialog } from '@/contexts/ConfirmDialogContext';
import SearchableDropdown from '@/components/SearchableDropdown';
import ModalDialog from '@/components/ModalDialog';
import DataTable, { type TableColumn, type TableAction } from '@/components/DataTable';

interface User {
  id: string;
  display_id?: string;
  name: string;
  email: string;
  role: string;
  status?: string;
  created_at?: string;
  site_id?: string;
}

interface Site {
  id: string;
  name: string;
}

const ROLES = [
  { value: 'admin', label: 'Admin' },
  { value: 'office', label: 'Office' },
  { value: 'supervisor', label: 'Supervisor' },
];

export default function UsersPage() {
  const { success, error: notifyError } = useNotification();
  const { confirm } = useConfirmDialog();

  const [users, setUsers] = useState<User[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(false);

  // Add User Modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [formEmail, setFormEmail] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formName, setFormName] = useState('');
  const [formRole, setFormRole] = useState('office');
  const [formDisplayId, setFormDisplayId] = useState('');
  const [formSiteId, setFormSiteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet<User[]>('/users');
      setUsers(Array.isArray(data) ? data : []);
    } catch (err: any) {
      notifyError(err.message ?? 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [notifyError]);

  useEffect(() => {
    loadUsers();
    apiGet<Site[]>('/sites').then(res => setSites(Array.isArray(res) ? res : [])).catch(() => {});
  }, [loadUsers]);

  const siteItems = useMemo(() => sites.map(s => ({ value: s.id, label: s.name })), [sites]);

  const columns: TableColumn[] = useMemo(() => [
    { key: 'display_id', label: 'Display ID', sortable: true },
    { key: 'name', label: 'Name', sortable: true },
    { key: 'email', label: 'Email', sortable: true },
    {
      key: 'role', label: 'Role', sortable: true, type: 'badge',
      badgeMap: { admin: 'danger', office: 'info', supervisor: 'warning' },
    },
    {
      key: 'status', label: 'Status', sortable: true, type: 'badge',
      badgeMap: { active: 'success', inactive: 'danger', pending: 'warning' },
    },
    { key: 'created_at', label: 'Created At', sortable: true, type: 'date' },
  ], []);

  const actions: TableAction[] = useMemo(() => [
    { label: '', icon: 'ri-eye-line', action: 'view', class: 'btn-secondary' },
  ], []);

  const resetForm = useCallback(() => {
    setFormEmail('');
    setFormPassword('');
    setFormName('');
    setFormRole('office');
    setFormDisplayId('');
    setFormSiteId(null);
  }, []);

  const openAddModal = useCallback(() => {
    resetForm();
    setShowAddModal(true);
  }, [resetForm]);

  const createUser = useCallback(async () => {
    if (!formEmail.trim() || !formPassword.trim() || !formName.trim()) {
      notifyError('Email, password, and name are required');
      return;
    }
    if (formPassword.length < 8) {
      notifyError('Password must be at least 8 characters');
      return;
    }
    setSaving(true);
    try {
      await apiPost('/auth/signup', {
        email: formEmail.trim(),
        password: formPassword,
        name: formName.trim(),
        role: formRole,
        displayId: formDisplayId.trim() || undefined,
        siteId: formSiteId || undefined,
      });
      success('User created successfully');
      setShowAddModal(false);
      resetForm();
      loadUsers();
    } catch (err: any) {
      notifyError(err.message ?? 'Failed to create user');
    } finally {
      setSaving(false);
    }
  }, [formEmail, formPassword, formName, formRole, formDisplayId, formSiteId, success, notifyError, resetForm, loadUsers]);

  const handleAction = useCallback(async (event: { action: string; row: any }) => {
    if (event.action === 'view') {
      // Could open a detail modal in the future
    }
  }, []);

  const getRoleBadgeClass = (role: string): string => {
    switch (role) {
      case 'admin': return 'badge badge-danger';
      case 'office': return 'badge badge-info';
      case 'supervisor': return 'badge badge-warning';
      default: return 'badge badge-info';
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1><i className="ri-user-settings-line" /> User Management</h1>
        <div className="header-actions">
          <button className="btn-primary" onClick={openAddModal}>
            <i className="ri-user-add-line" /> Add User
          </button>
        </div>
      </div>

      <div className="card-container">
        <DataTable
          columns={columns}
          data={users}
          loading={loading}
          fileName="users"
          emptyMessage="No users found."
          actions={actions}
          onActionClick={handleAction}
        />
      </div>

      {/* Add User Modal */}
      <ModalDialog
        isOpen={showAddModal}
        title="Add New User"
        size="md"
        onClose={() => setShowAddModal(false)}
        footer={
          <>
            <button className="btn-secondary" onClick={() => setShowAddModal(false)}>
              Cancel
            </button>
            <button
              className="btn-primary"
              onClick={createUser}
              disabled={saving || !formEmail || !formPassword || !formName}
            >
              <i className={saving ? 'ri-loader-4-line' : 'ri-user-add-line'} />
              {saving ? ' Creating...' : ' Create User'}
            </button>
          </>
        }
      >
        <form onSubmit={e => { e.preventDefault(); createUser(); }}>
          <div className="form-group">
            <label>Name <span style={{ color: 'var(--danger)' }}>*</span></label>
            <input
              type="text"
              value={formName}
              onChange={e => setFormName(e.target.value)}
              placeholder="Full name"
              required
            />
          </div>
          <div className="form-group">
            <label>Email <span style={{ color: 'var(--danger)' }}>*</span></label>
            <input
              type="email"
              value={formEmail}
              onChange={e => setFormEmail(e.target.value)}
              placeholder="user@example.com"
              required
            />
          </div>
          <div className="form-group">
            <label>Password <span style={{ color: 'var(--danger)' }}>*</span></label>
            <input
              type="password"
              value={formPassword}
              onChange={e => setFormPassword(e.target.value)}
              placeholder="Min 8 characters"
              minLength={8}
              required
            />
            {formPassword && formPassword.length < 8 && (
              <span style={{ fontSize: 12, color: 'var(--danger)', marginTop: 4, display: 'block' }}>
                Password must be at least 8 characters
              </span>
            )}
          </div>
          <div className="form-group">
            <label>Role <span style={{ color: 'var(--danger)' }}>*</span></label>
            <select value={formRole} onChange={e => setFormRole(e.target.value)}>
              {ROLES.map(r => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Display ID</label>
            <input
              type="text"
              value={formDisplayId}
              onChange={e => setFormDisplayId(e.target.value)}
              placeholder="Custom display ID (optional)"
            />
          </div>
          {(formRole === 'supervisor' || formRole === 'office') && (
            <div className="form-group">
              <SearchableDropdown
                items={siteItems}
                label="Assigned Site"
                placeholder="Select site (optional)"
                value={formSiteId}
                onChange={setFormSiteId}
              />
            </div>
          )}
        </form>
      </ModalDialog>
    </div>
  );
}
