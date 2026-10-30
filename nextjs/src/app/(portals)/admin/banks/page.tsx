'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useApi } from '@/hooks/useApi';
import { useNotification } from '@/contexts/NotificationContext';
import { useConfirmDialog } from '@/contexts/ConfirmDialogContext';
import { useRole } from '@/hooks/useRole';
import DataTable, { TableColumn, TableAction } from '@/components/DataTable';
import ModalDialog from '@/components/ModalDialog';
import PageHeader from '@/components/PageHeader';

interface Bank {
  id: string | number;
  bank_name: string;
  branch_name?: string;
  account_number?: string;
  ifsc_code?: string;
  account_type?: string;
  holder_name?: string;
  opening_balance?: number;
}

interface BankForm {
  bank_name: string;
  branch_name: string;
  account_number: string;
  ifsc_code: string;
  account_type: string;
  holder_name: string;
  opening_balance: string;
}

const emptyForm: BankForm = {
  bank_name: '', branch_name: '', account_number: '', ifsc_code: '',
  account_type: 'savings', holder_name: '', opening_balance: '',
};

const columns: TableColumn[] = [
  { key: 'bank_name', label: 'Bank Name', sortable: true },
  { key: 'branch_name', label: 'Branch', sortable: true },
  { key: 'account_number', label: 'Account Number', sortable: true },
  { key: 'ifsc_code', label: 'IFSC', sortable: true },
  {
    key: 'account_type', label: 'Account Type', sortable: true, type: 'badge',
    badgeMap: { savings: 'info', current: 'success' },
  },
  { key: 'holder_name', label: 'Holder', sortable: true },
  { key: 'opening_balance', label: 'Opening Balance', sortable: true, type: 'currency' },
];

const actions: TableAction[] = [
  { label: 'Edit', icon: 'ri-pencil-line', action: 'edit', class: 'btn-primary btn-sm' },
  { label: 'Delete', icon: 'ri-delete-bin-line', action: 'delete', class: 'btn-danger btn-sm' },
];

export default function BanksPage() {
  const { apiGet, apiPost, apiPut, apiDelete } = useApi();
  const { success, error: notifyError } = useNotification();
  const { confirm } = useConfirmDialog();
  const { isAdmin } = useRole();

  const [banks, setBanks] = useState<Bank[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingBank, setEditingBank] = useState<Bank | null>(null);
  const [formData, setFormData] = useState<BankForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  const loadBanks = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet<Bank[]>('/api/banks');
      setBanks(data);
    } catch (err: any) {
      notifyError(err.message || 'Failed to load banks');
    } finally {
      setLoading(false);
    }
  }, [apiGet, notifyError]);

  useEffect(() => {
    loadBanks();
  }, [loadBanks]);

  const openAddModal = () => {
    setEditingBank(null);
    setFormData(emptyForm);
    setModalOpen(true);
  };

  const openEditModal = (bank: Bank) => {
    setEditingBank(bank);
    setFormData({
      bank_name: bank.bank_name || '',
      branch_name: bank.branch_name || '',
      account_number: bank.account_number || '',
      ifsc_code: bank.ifsc_code || '',
      account_type: bank.account_type || 'savings',
      holder_name: bank.holder_name || '',
      opening_balance: bank.opening_balance != null ? String(bank.opening_balance) : '',
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingBank(null);
    setFormData(emptyForm);
  };

  const handleSave = async () => {
    if (!formData.bank_name.trim()) {
      notifyError('Bank name is required');
      return;
    }
    setSaving(true);
    try {
      const body = {
        ...formData,
        opening_balance: formData.opening_balance ? parseFloat(formData.opening_balance) : 0,
      };
      if (editingBank) {
        await apiPut(`/api/banks/${editingBank.id}`, body);
        success('Bank updated successfully');
      } else {
        await apiPost('/api/banks', body);
        success('Bank added successfully');
      }
      closeModal();
      loadBanks();
    } catch (err: any) {
      notifyError(err.message || 'Failed to save bank');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (bank: Bank) => {
    const confirmed = await confirm({
      title: 'Delete Bank',
      message: `Are you sure you want to delete "${bank.bank_name}"? This action cannot be undone.`,
      type: 'danger',
      confirmText: 'Delete',
    });
    if (!confirmed) return;
    try {
      await apiDelete(`/api/banks/${bank.id}`);
      success('Bank deleted successfully');
      loadBanks();
    } catch (err: any) {
      notifyError(err.message || 'Failed to delete bank');
    }
  };

  const handleActionClick = ({ action, row }: { action: string; row: any }) => {
    if (action === 'edit') openEditModal(row);
    if (action === 'delete') handleDelete(row);
  };

  const updateField = (field: keyof BankForm, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  if (!isAdmin) {
    return (
      <div className="page-container">
        <PageHeader title="Banks" icon="ri-bank-line" />
        <div className="card-container">
          <p>You do not have permission to access this page.</p>
        </div>
      </div>
    );
  }

  const modalFooter = (
    <>
      <button className="btn-secondary" onClick={closeModal} disabled={saving}>Cancel</button>
      <button className="btn-primary" onClick={handleSave} disabled={saving || !formData.bank_name.trim()}>
        {saving ? 'Saving...' : editingBank ? 'Update Bank' : 'Add Bank'}
      </button>
    </>
  );

  return (
    <div className="page-container">
      <PageHeader title="Banks" icon="ri-bank-line">
        <button className="btn-primary" onClick={openAddModal}>
          <i className="ri-add-line"></i> Add Bank
        </button>
      </PageHeader>

      <div className="card-container">
        <DataTable
          columns={columns}
          data={banks}
          loading={loading}
          actions={actions}
          onActionClick={handleActionClick}
          fileName="Banks"
          emptyMessage="No banks found."
        />
      </div>

      <ModalDialog
        isOpen={modalOpen}
        title={editingBank ? 'Edit Bank' : 'Add Bank'}
        size="lg"
        onClose={closeModal}
        footer={modalFooter}
      >
        <form onSubmit={e => { e.preventDefault(); handleSave(); }}>
          <div className="form-grid">
            <div className="form-group">
              <label>Bank Name <span style={{ color: 'var(--danger)' }}>*</span></label>
              <input
                type="text"
                value={formData.bank_name}
                onChange={e => updateField('bank_name', e.target.value)}
                placeholder="Enter bank name"
                required
              />
            </div>
            <div className="form-group">
              <label>Branch Name</label>
              <input
                type="text"
                value={formData.branch_name}
                onChange={e => updateField('branch_name', e.target.value)}
                placeholder="Branch name"
              />
            </div>
            <div className="form-group">
              <label>Account Number</label>
              <input
                type="text"
                value={formData.account_number}
                onChange={e => updateField('account_number', e.target.value)}
                placeholder="Account number"
              />
            </div>
            <div className="form-group">
              <label>IFSC Code</label>
              <input
                type="text"
                value={formData.ifsc_code}
                onChange={e => updateField('ifsc_code', e.target.value.toUpperCase())}
                placeholder="IFSC code"
                maxLength={11}
                style={{ textTransform: 'uppercase' }}
              />
            </div>
            <div className="form-group">
              <label>Account Type</label>
              <select value={formData.account_type} onChange={e => updateField('account_type', e.target.value)}>
                <option value="savings">Savings</option>
                <option value="current">Current</option>
              </select>
            </div>
            <div className="form-group">
              <label>Account Holder Name</label>
              <input
                type="text"
                value={formData.holder_name}
                onChange={e => updateField('holder_name', e.target.value)}
                placeholder="Account holder name"
              />
            </div>
            <div className="form-group">
              <label>Opening Balance</label>
              <input
                type="number"
                value={formData.opening_balance}
                onChange={e => updateField('opening_balance', e.target.value)}
                placeholder="0.00"
                step="0.01"
                min="0"
              />
            </div>
          </div>
        </form>
      </ModalDialog>
    </div>
  );
}
