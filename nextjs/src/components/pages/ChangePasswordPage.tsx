'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { apiGet, apiPut } from '@/lib/api-client';
import { useNotification } from '@/contexts/NotificationContext';
import { useAuth } from '@/contexts/AuthContext';
import { isAdmin } from '@/lib/role-utils';
import styles from './ChangePasswordPage.module.scss';

interface UserItem {
  id: number;
  name: string;
  username?: string;
}

export default function ChangePasswordPage() {
  const { success, error: notifyError } = useNotification();
  const { currentUser } = useAuth();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error'>('success');
  const [loading, setLoading] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [users, setUsers] = useState<UserItem[]>([]);

  const isAdminUser = useMemo(() => isAdmin(currentUser), [currentUser]);

  const submitButtonText = useMemo(() => {
    if (selectedUserId && isAdminUser) {
      const user = users.find(u => String(u.id) === selectedUserId);
      return `Reset Password for ${user?.name ?? 'User'}`;
    }
    return 'Change Password';
  }, [selectedUserId, isAdminUser, users]);

  const loadUsers = useCallback(async () => {
    if (!isAdminUser) return;
    try {
      const data = await apiGet<UserItem[]>('/auth/users');
      setUsers(data.filter(u => u.id !== currentUser?.id));
    } catch (err: any) {
      // Silent fail for user list load
    }
  }, [isAdminUser, currentUser]);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');

    if (!currentPassword || !newPassword || !confirmPassword) {
      setMessage('All fields are required');
      setMessageType('error');
      return;
    }

    if (newPassword.length < 4) {
      setMessage('New password must be at least 4 characters');
      setMessageType('error');
      return;
    }

    if (newPassword !== confirmPassword) {
      setMessage('New password and confirm password do not match');
      setMessageType('error');
      return;
    }

    setLoading(true);
    try {
      const body: Record<string, unknown> = {
        currentPassword,
        newPassword,
      };
      if (selectedUserId && isAdminUser) {
        body.targetUserId = Number(selectedUserId);
      }
      await apiPut('/auth/password', body);
      setMessage('Password changed successfully');
      setMessageType('success');
      success('Password changed successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setSelectedUserId('');
    } catch (err: any) {
      setMessage(err.message ?? 'Failed to change password');
      setMessageType('error');
    }
    setLoading(false);
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1><i className="ri-lock-password-line" /> Change Password</h1>
      </div>

      <div className="card-container" style={{ maxWidth: 500 }}>
        <form onSubmit={onSubmit}>
          {isAdminUser && users.length > 0 && (
            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
              <label>Change password for another user (optional)</label>
              <select
                value={selectedUserId}
                onChange={e => setSelectedUserId(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  background: 'var(--input-bg)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  color: 'var(--text-main)',
                  fontSize: '14px',
                }}
              >
                <option value="">-- My Own Password --</option>
                {users.map(u => (
                  <option key={u.id} value={String(u.id)}>{u.name} ({u.username ?? `ID: ${u.id}`})</option>
                ))}
              </select>
            </div>
          )}

          <div className={styles.passwordField}>
            <label>Current Password</label>
            <div className={styles.inputWrapper}>
              <input
                type={showCurrentPassword ? 'text' : 'password'}
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
                required
              />
              <button
                type="button"
                className={styles.toggleBtn}
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                title={showCurrentPassword ? 'Hide' : 'Show'}
              >
                <i className={showCurrentPassword ? 'ri-eye-off-line' : 'ri-eye-line'} />
              </button>
            </div>
          </div>

          <div className={styles.passwordField}>
            <label>New Password</label>
            <div className={styles.inputWrapper}>
              <input
                type={showNewPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="Enter new password"
                required
                minLength={4}
              />
              <button
                type="button"
                className={styles.toggleBtn}
                onClick={() => setShowNewPassword(!showNewPassword)}
                title={showNewPassword ? 'Hide' : 'Show'}
              >
                <i className={showNewPassword ? 'ri-eye-off-line' : 'ri-eye-line'} />
              </button>
            </div>
            {newPassword && newPassword.length < 4 && (
              <small style={{ color: 'var(--danger)', fontSize: 12 }}>Minimum 4 characters required</small>
            )}
          </div>

          <div className={styles.passwordField}>
            <label>Confirm New Password</label>
            <div className={styles.inputWrapper}>
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                required
              />
              <button
                type="button"
                className={styles.toggleBtn}
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                title={showConfirmPassword ? 'Hide' : 'Show'}
              >
                <i className={showConfirmPassword ? 'ri-eye-off-line' : 'ri-eye-line'} />
              </button>
            </div>
            {confirmPassword && newPassword !== confirmPassword && (
              <small style={{ color: 'var(--danger)', fontSize: 12 }}>Passwords do not match</small>
            )}
          </div>

          {message && (
            <div className={`${styles.msg} ${messageType === 'success' ? styles.msgSuccess : styles.msgError}`}>
              <i className={messageType === 'success' ? 'ri-check-line' : 'ri-error-warning-line'} />
              {' '}{message}
            </div>
          )}

          <button
            type="submit"
            className="btn-primary"
            disabled={loading}
            style={{ width: '100%', marginTop: '1rem' }}
          >
            <i className="ri-lock-line" />
            {' '}{loading ? 'Changing...' : submitButtonText}
          </button>
        </form>
      </div>
    </div>
  );
}
