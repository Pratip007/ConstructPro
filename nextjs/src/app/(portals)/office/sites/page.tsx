'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useApi } from '@/hooks/useApi';
import { useNotification } from '@/contexts/NotificationContext';
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

const emptyForm = { name: '', company_id: '' as string, address: '', status: 'active' };

export default function OfficeSitesPage() {
  const { apiGet, apiPost } = useApi();
  const { success, error: notifyError } = useNotification();

  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSite, setEditingSite] = useState<Site | null>(null);
  const [formData, setFormData] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [companyItems, setCompanyItems] = useState<DropdownItem[]>([]);
  const [filterCompanyId, setFilterCompanyId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [sitesData, companiesData] = await Promise.all([
        apiGet<Site[]>('/api/sites'),
        apiGet<any[]>('/api/companies'),
      ]);
      setSites(sitesData);
      setCompanyItems(companiesData.map(c => ({ value: String(c.id), label: c.name })));
    } catch (err: any) {
      notifyError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [apiGet, notifyError]);

  useEffect(() => { loadData(); }, [loadData]);

  const filteredSites = useMemo(() => {
    if (!filterCompanyId) return sites;
    return sites.filter(s => String(s.company_id) === filterCompanyId);
  }, [sites, filterCompanyId]);

  const columns: TableColumn[] = [
    { key: 'display_id', label: 'Display ID', sortable: true },
    { key: 'name', label: 'Name', sortable: true },
    { key: 'company_name', label: 'Company', sortable: true },
    { key: 'address', label: 'Address', sortable: false },
    { key: 'status', label: 'Status', sortable: true, type: 'badge', badgeMap: { active: 'success', completed: 'info', upcoming: 'warning' } },
  ];

  const actions: TableAction[] = [
    { label: 'Edit', icon: 'ri-pencil-line', action: 'edit', class: 'btn-primary btn-sm' },
    { label: 'Delete', icon: 'ri-delete-bin-line', action: 'delete', class: 'btn-danger btn-sm' },
  ];

  const openAddModal = () => { setEditingSite(null); setFormData(emptyForm); setModalOpen(true); };
  const closeModal = () => { setModalOpen(false); setEditingSite(null); setFormData(emptyForm); };

  const openEditModal = (site: Site) => {
    setEditingSite(site);
    setFormData({ name: site.name || '', company_id: site.company_id ? String(site.company_id) : '', address: site.address || '', status: site.status || 'active' });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) { notifyError('Site name is required'); return; }
    setSaving(true);
    try {
      await apiPost('/api/approvals', {
        source: 'office', module: 'site',
        action_type: editingSite ? 'update' : 'create',
        entity_id: editingSite?.id || null,
        new_data: formData,
        old_data: editingSite ? { name: editingSite.name, company_id: editingSite.company_id, address: editingSite.address, status: editingSite.status } : null,
        remarks: editingSite ? `Updated site: ${formData.name}` : `Created new site: ${formData.name}`,
      });
      success('Request submitted for admin approval');
      closeModal();
    } catch (err: any) {
      notifyError(err.message || 'Failed to submit request');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (site: Site) => {
    if (!confirm(`Submit delete request for "${site.name}"?`)) return;
    try {
      await apiPost('/api/approvals', {
        source: 'office', module: 'site', action_type: 'delete',
        entity_id: site.id, new_data: null, old_data: { name: site.name },
        remarks: `Delete site: ${site.name}`,
      });
      success('Delete request submitted for admin approval');
    } catch (err: any) {
      notifyError(err.message || 'Failed to submit delete request');
    }
  };

  const handleActionClick = ({ action, row }: { action: string; row: any }) => {
    if (action === 'edit') openEditModal(row);
    if (action === 'delete') handleDelete(row);
  };

  return (
    <div className="page-container">
      <PageHeader title="Sites" icon="ri-map-pin-line">
        <button className="btn-primary" onClick={openAddModal}><i className="ri-add-line"></i> Add Site</button>
      </PageHeader>

      <div className="card-container" style={{ marginBottom: 16 }}>
        <div className="form-grid">
          <div className="form-group">
            <SearchableDropdown items={companyItems} value={filterCompanyId} onChange={setFilterCompanyId} placeholder="Filter by company..." label="Company Filter" />
          </div>
        </div>
      </div>

      <div className="card-container">
        <DataTable columns={columns} data={filteredSites} loading={loading} actions={actions} onActionClick={handleActionClick} fileName="Sites" emptyMessage="No sites found." />
      </div>

      <ModalDialog isOpen={modalOpen} title={editingSite ? 'Edit Site' : 'Add Site'} size="md" onClose={closeModal}
        footer={<>
          <button className="btn-secondary" onClick={closeModal} disabled={saving}>Cancel</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving || !formData.name.trim()}>
            {saving ? 'Submitting...' : 'Submit for Approval'}
          </button>
        </>}>
        <div className="form-grid">
          <div className="form-group">
            <label>Site Name <span style={{ color: 'var(--danger)' }}>*</span></label>
            <input type="text" value={formData.name} onChange={e => setFormData(f => ({ ...f, name: e.target.value }))} placeholder="Enter site name" required />
          </div>
          <div className="form-group">
            <SearchableDropdown items={companyItems} value={formData.company_id} onChange={(val: any) => setFormData(f => ({ ...f, company_id: val || '' }))} placeholder="Select company..." label="Company" />
          </div>
          <div className="form-group">
            <label>Status</label>
            <select value={formData.status} onChange={e => setFormData(f => ({ ...f, status: e.target.value }))}>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="upcoming">Upcoming</option>
            </select>
          </div>
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label>Address</label>
            <textarea value={formData.address} onChange={e => setFormData(f => ({ ...f, address: e.target.value }))} placeholder="Site address" rows={3} />
          </div>
        </div>
      </ModalDialog>
    </div>
  );
}
