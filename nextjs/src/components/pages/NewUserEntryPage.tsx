'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { apiGet, apiPost, apiPut } from '@/lib/api-client';
import { useNotification } from '@/contexts/NotificationContext';
import { useConfirmDialog } from '@/contexts/ConfirmDialogContext';
import { useAuth } from '@/contexts/AuthContext';
import { isSupervisor, isAdmin, isOffice, getRoleBadge } from '@/lib/role-utils';
import { requiresApproval, submitForApproval } from '@/lib/approval-utils';
import SearchableDropdown from '@/components/SearchableDropdown';
import ModalDialog from '@/components/ModalDialog';

interface Employee {
  id: string;
  display_id?: string;
  name: string;
  phone?: string;
  status?: string;
  designation?: string;
  role?: string;
  email?: string;
  username?: string;
  contact?: string;
  profile_id?: string;
  pending_status?: string;
  created_at?: string;
}

interface UserRecord {
  id: string;
  display_id: string;
  name: string;
  email: string;
  username: string;
  role: string;
  designation: string;
  contact: string;
  site_id: string | null;
  status: string;
  pending_status?: string;
  created_at: string;
}

export default function NewUserEntryPage() {
  const { success, error: notifyError } = useNotification();
  const { confirm } = useConfirmDialog();
  const { currentUser } = useAuth();

  const [allUsers, setAllUsers] = useState<UserRecord[]>([]);
  const [employees, setEmployees] = useState<{ value: string; label: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [usersLoading, setUsersLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null);

  const [selectedEmpId, setSelectedEmpId] = useState('');
  const [name, setName] = useState('');
  const [designation, setDesignation] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [contact, setContact] = useState('');

  const canModify = !isSupervisor(currentUser);
  const roleBadge = useMemo(() => {
    if (isOffice(currentUser)) return 'Office Mode - Requires Approval';
    if (isSupervisor(currentUser)) return 'Supervisor Mode - View Only';
    return '';
  }, [currentUser]);

  const loadUsers = useCallback(async () => {
    setUsersLoading(true);
    try {
      const res = await apiGet<Employee[]>('/employees');
      const users: UserRecord[] = (Array.isArray(res) ? res : []).map(u => ({
        id: u.id ?? '',
        display_id: u.display_id ?? u.id ?? '',
        name: u.name ?? '',
        email: u.email ?? '',
        username: u.username ?? u.email ?? '',
        role: u.role ?? '',
        designation: u.designation ?? u.role ?? 'Office Staff',
        contact: u.contact ?? u.phone ?? '',
        site_id: null,
        status: u.status ?? 'Active',
        pending_status: u.pending_status,
        created_at: u.created_at ?? '',
      }));
      setAllUsers(users);
    } catch {
      notifyError('Failed to load user list');
    }
    setUsersLoading(false);
  }, [notifyError]);

  const loadEmployees = useCallback(async () => {
    try {
      const emps = await apiGet<Employee[]>('/employees');
      const items = (emps ?? [])
        .filter(e => e.status === 'Active' || !e.status)
        .map(e => ({
          value: e.id,
          label: `${e.name} (${e.display_id ?? e.id})`,
        }));
      setEmployees(items);
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    loadUsers();
    loadEmployees();
  }, [loadUsers, loadEmployees]);

  const resetForm = () => {
    setSelectedEmpId('');
    setName('');
    setDesignation('');
    setUsername('');
    setPassword('');
    setContact('');
  };

  const openAddModal = () => {
    if (isSupervisor(currentUser)) return;
    setEditingUser(null);
    resetForm();
    setShowModal(true);
  };

  const openEditModal = (user: UserRecord) => {
    if (isSupervisor(currentUser)) return;
    setEditingUser(user);
    setSelectedEmpId(user.display_id);
    setName(user.name);
    setDesignation(user.designation);
    setUsername(user.username);
    setPassword('');
    setContact(user.contact);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingUser(null);
    resetForm();
  };

  const onEmpSelected = (empId: string) => {
    setSelectedEmpId(empId);
    const emp = employees.find(e => e.value === empId);
    if (emp) {
      setName(emp.label.replace(/ \(.*\)$/, ''));
    }
  };

  const onSubmit = async () => {
    if (!name || !username || !contact) return;
    if (!editingUser && !password) return;

    const existingUser = allUsers.find(
      u => u.username.toLowerCase() === username.toLowerCase() && u.id !== editingUser?.id
    );
    if (existingUser) {
      notifyError('Username already exists. Choose a different one.');
      return;
    }

    const payload: Record<string, unknown> = {
      name,
      designation: designation || 'Office Staff',
      username,
      password: password || undefined,
      contact,
      display_id: selectedEmpId || undefined,
    };

    if (requiresApproval(currentUser)) {
      try {
        await submitForApproval(
          'NewUserEntry',
          editingUser ? Number(editingUser.id) || 0 : 0,
          editingUser ? 'update' : 'create',
          payload
        );
        success('Request sent for admin approval');
        closeModal();
        loadUsers();
      } catch (err: unknown) {
        notifyError((err as Error)?.message ?? 'Failed to submit approval request');
      }
      return;
    }

    setLoading(true);
    try {
      if (editingUser) {
        await apiPut(`/employees/${editingUser.id}`, payload);
        success('User updated successfully');
      } else {
        await apiPost('/auth/signup', {
          ...payload,
          email: `${username}@constructpro.local`,
          role: 'office',
        });
        success('User registered successfully');
      }
      closeModal();
      loadUsers();
    } catch (err: unknown) {
      notifyError((err as Error)?.message ?? 'Failed to save user');
    }
    setLoading(false);
  };

  const toggleUserStatus = async (user: UserRecord) => {
    const newStatus = user.status === 'Active' ? 'Disabled' : 'Active';

    if (requiresApproval(currentUser)) {
      try {
        await submitForApproval(
          'NewUserEntry',
          Number(user.id) || 0,
          'update',
          { ...user, status: newStatus }
        );
        success('Status change sent for approval');
        loadUsers();
      } catch (err: unknown) {
        notifyError((err as Error)?.message ?? 'Failed to submit request');
      }
      return;
    }

    const confirmed = await confirm({
      title: `${newStatus === 'Active' ? 'Enable' : 'Disable'} User`,
      message: `Are you sure you want to ${newStatus === 'Active' ? 'enable' : 'disable'} ${user.name}?`,
      type: newStatus === 'Active' ? 'info' : 'warning',
    });
    if (!confirmed) return;

    try {
      await apiPut(`/employees/${user.id}`, { status: newStatus });
      success(`User status changed to ${newStatus}`);
      loadUsers();
    } catch (err: unknown) {
      notifyError((err as Error)?.message ?? 'Failed to update status');
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1><i className="ri-user-add-line" /> User Directory &amp; Entry</h1>
        {roleBadge && <span className="role-badge">{roleBadge}</span>}
      </div>

      {canModify && (
        <div style={{ marginBottom: '1rem' }}>
          <button className="btn-primary" onClick={openAddModal}>
            <i className="ri-add-line" /> Add New User
          </button>
        </div>
      )}

      {usersLoading && <p className="loading-text">Loading users...</p>}

      <div className="table-responsive">
        <table>
          <thead>
            <tr>
              <th>Emp ID</th>
              <th>Name</th>
              <th>Designation</th>
              <th>User ID</th>
              <th>Contact</th>
              <th>Status</th>
              {canModify && <th style={{ textAlign: 'center' }}>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {allUsers.length === 0 ? (
              <tr>
                <td colSpan={canModify ? 7 : 6} className="empty-state">
                  {usersLoading ? 'Loading users...' : 'No users found.'}
                </td>
              </tr>
            ) : allUsers.map(user => (
              <tr key={user.id}>
                <td style={{ fontWeight: 700, color: 'var(--accent)' }}>{user.display_id}</td>
                <td style={{ fontWeight: 600 }}>{user.name}</td>
                <td>{user.designation}</td>
                <td>{user.username}</td>
                <td>{user.contact}</td>
                <td>
                  <span className={`badge ${user.status === 'Active' ? 'badge-success' : 'badge-danger'}`}>
                    {user.status}
                  </span>
                </td>
                {canModify && (
                  <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                    <button className="btn-icon" onClick={() => openEditModal(user)} title="Edit">
                      <i className="ri-edit-line" />
                    </button>
                    <button className="btn-icon" onClick={() => toggleUserStatus(user)} title="Toggle Status">
                      <i className="ri-toggle-line" />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ModalDialog
        isOpen={showModal}
        onClose={closeModal}
        title={editingUser ? 'Edit User' : 'Register New User'}
      >
        <form onSubmit={(e) => { e.preventDefault(); onSubmit(); }} className="form-grid">
          <div className="form-group">
            <SearchableDropdown
              items={employees}
              value={selectedEmpId}
              onChange={onEmpSelected}
              placeholder="Search employee name..."
              label="Full Name (Select Employee)"
            />
          </div>
          <div className="form-group">
            <label>Full Name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)}
              placeholder="Employee full name" required />
          </div>
          <div className="form-group">
            <label>Role / Designation</label>
            <input type="text" value={designation} onChange={(e) => setDesignation(e.target.value)}
              placeholder="e.g., Office Staff, Manager" />
          </div>
          <div className="form-group">
            <label>User ID / Username</label>
            <input type="text" value={username} onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g., rahul_atr" required />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder={editingUser ? 'Leave blank to keep' : 'Enter password'}
              required={!editingUser} />
          </div>
          <div className="form-group">
            <label>Contact Number</label>
            <input type="tel" value={contact} onChange={(e) => setContact(e.target.value)}
              placeholder="e.g., +91 9876543210" required />
          </div>
        </form>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '1rem' }}>
          <button className="btn-secondary" onClick={closeModal}>Cancel</button>
          <button className="btn-primary" onClick={onSubmit} disabled={loading}>
            {requiresApproval(currentUser)
              ? (loading ? 'Submitting...' : 'Submit for Approval')
              : (loading ? 'Saving...' : (editingUser ? 'Update User' : 'Save & Register'))
            }
          </button>
        </div>
      </ModalDialog>
    </div>
  );
}
