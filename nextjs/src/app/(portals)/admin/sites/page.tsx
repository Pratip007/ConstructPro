'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useApi } from '@/hooks/useApi';
import { useNotification } from '@/contexts/NotificationContext';
import { useConfirmDialog } from '@/contexts/ConfirmDialogContext';
import { useRole } from '@/hooks/useRole';
import DataTable, { TableColumn, TableAction } from '@/components/DataTable';
import ModalDialog from '@/components/ModalDialog';
import PageHeader from '@/components/PageHeader';
import SearchableDropdown, { DropdownItem } from '@/components/SearchableDropdown';

interface Site {
  id: string | number;
  display_id?: string;
  name: string;
  company_id?: string | number;
  company_name?: string;
  address?: string;
  status?: string;
}

interface SiteForm {
  name: string;
  company_id: string | number | null;
  address: string;
  status: string;
}

const emptyForm: SiteForm = { name: '', company_id: null, address: '', status: 'active' };

const columns: TableColumn[] = [
  { key: 'display_id', label: 'Display ID', sortable: true },
  { key: 'name', label: 'Name', sortable: true },
  { key: 'company_name', label: 'Company', sortable: true },
  { key: 'address', label: 'Address', sortable: false },
  {
    key: 'status', label: 'Status', sortable: true, type: 'badge',
    badgeMap: { active: 'success', completed: 'info', upcoming: 'warning' },
  },
];

const actions: TableAction[] = [
  { label: 'Edit', icon: 'ri-pencil-line', action: 'edit', class: 'btn-primary btn-sm' },
  { label: 'Delete', icon: 'ri-delete-bin-line', action: 'delete', class: 'btn-danger btn-sm' },
];

const STATUS_OPTIONS = ['active', 'completed', 'upcoming'];

export default function SitesPage() {
  const { apiGet, apiPost, apiPut, apiDelete } = useApi();
  const { success, error: notifyError } = useNotification();
  const { confirm } = useConfirmDialog();
  const { isAdmin } = useRole();

  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSite, setEditingSite] = useState<Site | null>(null);
  const [formData, setFormData] = useState<SiteForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  const [companyItems, setCompanyItems] = useState<DropdownItem[]>([]);
  const [filterCompanyId, setFilterCompanyId] = useState<any>(null);

  const loadCompanies = useCallback(async () => {
    try {
      const data = await apiGet<any[]>('/api/companies');
      setCompanyItems(data.map(c => ({ value: c.id, label: c.name })));
    } catch (err: any) {
      notifyError(err.message || 'Failed to load companies');
    }
  }, [apiGet, notifyError]);

  const loadSites = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet<Site[]>('/api/sites');
      setSites(data);
    } catch (err: any) {
      notifyError(err.message || 'Failed to load sites');
    } finally {
      setLoading(false);
    }
  }, [apiGet, notifyError]);

  useEffect(() => {
    loadCompanies();
    loadSites();
  }, [loadCompanies, loadSites]);

  const filteredSites = useMemo(() => {
    if (!filterCompanyId) return sites;
    return sites.filter(s => String(s.company_id) === String(filterCompanyId));
  }, [sites, filterCompanyId]);

  const openAddModal = () => {
    setEditingSite(null);
    setFormData(emptyForm);
    setModalOpen(true);
  };

  const openEditModal = (site: Site) => {
    setEditingSite(site);
    setFormData({
      name: site.name || '',
      company_id: site.company_id || null,
      address: site.address || '',
      status: site.status || 'active',
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingSite(null);
    setFormData(emptyForm);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      notifyError('Site name is required');
      return;
    }
    setSaving(true);
    try {
      if (editingSite) {
        await apiPut(`/api/sites/${editingSite.id}`, formData);
        success('Site updated successfully');
      } else {
        await apiPost('/api/sites', formData);
        success('Site added successfully');
      }
      closeModal();
      loadSites();
    } catch (err: any) {
      notifyError(err.message || 'Failed to save site');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (site: Site) => {
    const confirmed = await confirm({
      title: 'Delete Site',
      message: `Are you sure you want to delete "${site.name}"? This action cannot be undone.`,
      type: 'danger',
      confirmText: 'Delete',
    });
    if (!confirmed) return;
    try {
      await apiDelete(`/api/sites/${site.id}`);
      success('Site deleted successfully');
      loadSites();
    } catch (err: any) {
      notifyError(err.message || 'Failed to delete site');
    }
  };

  const handleActionClick = ({ action, row }: { action: string; row: any }) => {
    if (action === 'edit') openEditModal(row);
    if (action === 'delete') handleDelete(row);
  };

  const updateField = (field: keyof SiteForm, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const modalFooter = (
    <>
      <button className="btn-secondary" onClick={closeModal} disabled={saving}>Cancel</button>
      <button className="btn-primary" onClick={handleSave} disabled={saving || !formData.name.trim()}>
        {saving ? 'Saving...' : editingSite ? 'Update Site' : 'Add Site'}
      </button>
    </>
  );

  return (
    <div className="page-container">
      <PageHeader title="Sites" icon="ri-map-pin-line">
        {isAdmin && (
          <button className="btn-primary" onClick={openAddModal}>
            <i className="ri-add-line"></i> Add Site
          </button>
        )}
      </PageHeader>

      <div className="card-container" style={{ marginBottom: 16 }}>
        <div className="form-grid">
          <div className="form-group">
            <SearchableDropdown
              items={companyItems}
              value={filterCompanyId}
              onChange={setFilterCompanyId}
              placeholder="Filter by company..."
              label="Company Filter"
            />
          </div>
        </div>
      </div>

      <div className="card-container">
        <DataTable
          columns={columns}
          data={filteredSites}
          loading={loading}
          actions={isAdmin ? actions : []}
          onActionClick={handleActionClick}
          fileName="Sites"
          emptyMessage="No sites found."
        />
      </div>

      <ModalDialog
        isOpen={modalOpen}
        title={editingSite ? 'Edit Site' : 'Add Site'}
        size="md"
        onClose={closeModal}
        footer={modalFooter}
      >
        <form onSubmit={e => { e.preventDefault(); handleSave(); }}>
          <div className="form-grid">
            <div className="form-group">
              <label>Site Name <span style={{ color: 'var(--danger)' }}>*</span></label>
              <input
                type="text"
                value={formData.name}
                onChange={e => updateField('name', e.target.value)}
                placeholder="Enter site name"
                required
              />
            </div>
            <div className="form-group">
              <SearchableDropdown
                items={companyItems}
                value={formData.company_id}
                onChange={val => updateField('company_id', val)}
                placeholder="Select company..."
                label="Company"
              />
            </div>
            <div className="form-group">
              <label>Status</label>
              <select value={formData.status} onChange={e => updateField('status', e.target.value)}>
                {STATUS_OPTIONS.map(s => (
                  <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                ))}
              </select>
            </div>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label>Address</label>
              <textarea
                value={formData.address}
                onChange={e => updateField('address', e.target.value)}
                placeholder="Site address"
                rows={3}
              />
            </div>
          </div>
        </form>
      </ModalDialog>
    </div>
  );
}
