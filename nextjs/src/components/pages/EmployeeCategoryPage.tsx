'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api-client';
import { useNotification } from '@/contexts/NotificationContext';
import { useConfirmDialog } from '@/contexts/ConfirmDialogContext';
import { useAuth } from '@/contexts/AuthContext';
import { isAdmin, getRoleBadge } from '@/lib/role-utils';
import { requiresApproval, submitForApproval } from '@/lib/approval-utils';
import styles from './EmployeeCategoryPage.module.scss';

interface Category {
  id: number;
  name: string;
  working_days: number;
}

export default function EmployeeCategoryPage() {
  const { success, error: notifyError } = useNotification();
  const { confirm } = useConfirmDialog();
  const { currentUser } = useAuth();

  const [categoryName, setCategoryName] = useState('');
  const [workingDays, setWorkingDays] = useState(26);
  const [categories, setCategories] = useState<Category[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const loadCategories = useCallback(async () => {
    setLoading(true);
    try {
      const cats = await apiGet<Category[]>('/employee-categories');
      setCategories(cats);
    } catch (err: any) {
      notifyError(err.message ?? 'Failed to load categories');
    }
    setLoading(false);
  }, [notifyError]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  const addCategory = async () => {
    const name = categoryName.trim();
    if (!name) return;
    const body = { name, working_days: workingDays };

    if (requiresApproval(currentUser)) {
      try {
        await submitForApproval(
          'employee-category',
          editingId ?? 0,
          editingId !== null ? 'update' : 'create',
          { ...body, id: editingId }
        );
        success('Submitted for approval');
        setEditingId(null);
        setCategoryName('');
        setWorkingDays(26);
      } catch (err: any) {
        notifyError(err.message ?? 'Failed to submit');
      }
      return;
    }

    try {
      if (editingId !== null) {
        await apiPut(`/employee-categories/${editingId}`, body);
        success('Category updated');
      } else {
        await apiPost('/employee-categories', body);
        success('Category added');
      }
      setEditingId(null);
      setCategoryName('');
      setWorkingDays(26);
      loadCategories();
    } catch (err: any) {
      notifyError(err.message ?? 'Failed to save category');
    }
  };

  const editCategory = (cat: Category) => {
    setCategoryName(cat.name);
    setWorkingDays(cat.working_days ?? 26);
    setEditingId(cat.id);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setCategoryName('');
    setWorkingDays(26);
  };

  const deleteCategory = async (id: number) => {
    const confirmed = await confirm({
      title: 'Delete Category',
      message: 'Delete this category permanently?',
      type: 'danger',
    });
    if (!confirmed) return;

    if (requiresApproval(currentUser)) {
      try {
        await submitForApproval('employee-category', id, 'delete', { id });
        success('Delete request submitted for approval');
      } catch (err: any) {
        notifyError(err.message ?? 'Failed to submit');
      }
      return;
    }

    try {
      await apiDelete(`/employee-categories/${id}`);
      success('Category deleted');
      loadCategories();
    } catch (err: any) {
      notifyError(err.message ?? 'Failed to delete category');
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>
          <i className="ri-award-line" /> Position Category
        </h1>
        {!isAdmin(currentUser) && (
          <span className={`badge ${getRoleBadge(currentUser).cssClass}`}>
            {getRoleBadge(currentUser).label} Mode
          </span>
        )}
      </div>

      <div className="card-container">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            addCategory();
          }}
          className="form-grid"
        >
          <div className="form-group">
            <label>Category Name *</label>
            <input
              type="text"
              value={categoryName}
              onChange={(e) => setCategoryName(e.target.value)}
              placeholder="e.g. Mason, Helper, Supervisor"
              required
            />
          </div>
          <div className="form-group">
            <label>Working Days (per month)</label>
            <input
              type="number"
              value={workingDays}
              onChange={(e) => setWorkingDays(Number(e.target.value))}
              min={1}
              max={31}
              placeholder="26"
            />
          </div>
          <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end', gap: '10px' }}>
            <button type="submit" className="btn-primary">
              <i className={editingId !== null ? 'ri-edit-line' : 'ri-add-line'} />
              {editingId !== null ? ' Update' : ' Add'} Category
            </button>
            {editingId !== null && (
              <button type="button" className="btn-secondary" onClick={cancelEdit}>
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>

      {loading && <p className="loading-text">Loading categories...</p>}

      <div className="table-responsive">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Category Name</th>
              <th>Working Days/Month</th>
              <th style={{ textAlign: 'center' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {categories.length === 0 ? (
              <tr>
                <td colSpan={4} className="empty-state">
                  No categories added yet.
                </td>
              </tr>
            ) : (
              categories.map((cat, i) => (
                <tr key={cat.id}>
                  <td>{i + 1}</td>
                  <td style={{ fontWeight: 600 }}>{cat.name}</td>
                  <td>{cat.working_days ?? 26} days</td>
                  <td style={{ textAlign: 'center' }}>
                    <button
                      className={`${styles.btnAction} ${styles.edit}`}
                      onClick={() => editCategory(cat)}
                      title="Edit"
                    >
                      <i className="ri-edit-line" />
                    </button>
                    <button
                      className={`${styles.btnAction} ${styles.delete}`}
                      onClick={() => deleteCategory(cat.id)}
                      title="Delete"
                    >
                      <i className="ri-delete-bin-line" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
