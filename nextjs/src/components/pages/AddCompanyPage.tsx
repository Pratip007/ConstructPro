'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api-client';
import { useNotification } from '@/contexts/NotificationContext';
import { useConfirmDialog } from '@/contexts/ConfirmDialogContext';
import { useRole } from '@/hooks/useRole';
import { useApproval } from '@/hooks/useApproval';
import { exportToExcel } from '@/lib/export-utils';
import SearchableDropdown from '@/components/SearchableDropdown';
import ModalDialog from '@/components/ModalDialog';
import SummaryCards from '@/components/SummaryCards';
import styles from './AddCompanyPage.module.scss';

const COMPANY_TYPES = ['Construction', 'Material Supplier', 'Transport', 'Consulting', 'Other'];

const STATE_ITEMS = [
  { value: '01', label: '01 - Jammu & Kashmir' },
  { value: '02', label: '02 - Himachal Pradesh' },
  { value: '03', label: '03 - Punjab' },
  { value: '04', label: '04 - Chandigarh' },
  { value: '05', label: '05 - Uttarakhand' },
  { value: '06', label: '06 - Haryana' },
  { value: '07', label: '07 - Delhi' },
  { value: '08', label: '08 - Rajasthan' },
  { value: '09', label: '09 - Uttar Pradesh' },
  { value: '10', label: '10 - Bihar' },
  { value: '11', label: '11 - Sikkim' },
  { value: '12', label: '12 - Arunachal Pradesh' },
  { value: '13', label: '13 - Nagaland' },
  { value: '14', label: '14 - Manipur' },
  { value: '15', label: '15 - Mizoram' },
  { value: '16', label: '16 - Tripura' },
  { value: '17', label: '17 - Meghalaya' },
  { value: '18', label: '18 - Assam' },
  { value: '19', label: '19 - West Bengal' },
  { value: '20', label: '20 - Jharkhand' },
  { value: '21', label: '21 - Odisha' },
  { value: '22', label: '22 - Chhattisgarh' },
  { value: '23', label: '23 - Madhya Pradesh' },
  { value: '24', label: '24 - Gujarat' },
  { value: '26', label: '26 - Dadra & Nagar Haveli and Daman & Diu' },
  { value: '27', label: '27 - Maharashtra' },
  { value: '29', label: '29 - Karnataka' },
  { value: '30', label: '30 - Goa' },
  { value: '31', label: '31 - Lakshadweep' },
  { value: '32', label: '32 - Kerala' },
  { value: '33', label: '33 - Tamil Nadu' },
  { value: '34', label: '34 - Puducherry' },
  { value: '35', label: '35 - Andaman & Nicobar Islands' },
  { value: '36', label: '36 - Telangana' },
  { value: '37', label: '37 - Andhra Pradesh' },
  { value: '38', label: '38 - Ladakh' },
];

interface CustomField {
  key: string;
  value: string;
}

export default function AddCompanyPage() {
  const { success, error: notifyError } = useNotification();
  const { confirm } = useConfirmDialog();
  const role = useRole();
  const approval = useApproval();

  const [companyName, setCompanyName] = useState('');
  const [companyType, setCompanyType] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [gstNo, setGstNo] = useState('');
  const [pan, setPan] = useState('');
  const [stateCode, setStateCode] = useState('');
  const [address, setAddress] = useState('');
  const [customFields, setCustomFields] = useState<CustomField[]>([]);

  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [profileCompany, setProfileCompany] = useState<any>(null);

  const loadCompanies = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet<any[]>('/companies');
      setCompanies(data);
    } catch (err: any) {
      notifyError('Failed to load companies: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [notifyError]);

  useEffect(() => {
    loadCompanies();
  }, [loadCompanies]);

  const filteredCompanies = useMemo(() => {
    const q = searchQuery.toLowerCase();
    if (!q) return companies;
    return companies.filter(c =>
      (c.name ?? '').toLowerCase().includes(q) ||
      (c.gst_number ?? '').toLowerCase().includes(q) ||
      (c.pan_number ?? '').toLowerCase().includes(q) ||
      (c.phone ?? '').includes(q)
    );
  }, [companies, searchQuery]);

  const summaryCards = useMemo(() => [
    { title: 'Total Companies', value: companies.length, icon: 'ri-building-2-line', color: 'primary' as const },
    { title: 'Construction', value: companies.filter(c => c.custom_fields?.type === 'Construction').length, icon: 'ri-hammer-line', color: 'info' as const },
    { title: 'Material Supplier', value: companies.filter(c => c.custom_fields?.type === 'Material Supplier').length, icon: 'ri-truck-line', color: 'success' as const },
  ], [companies]);

  const resetForm = useCallback(() => {
    setEditingId(null);
    setCompanyName('');
    setCompanyType('');
    setContactPerson('');
    setPhone('');
    setEmail('');
    setGstNo('');
    setPan('');
    setStateCode('');
    setAddress('');
    setCustomFields([]);
  }, []);

  const saveCompany = useCallback(async () => {
    if (!companyName || !companyType) return;
    setSaving(true);
    const body = {
      name: companyName,
      phone,
      email,
      gst_number: gstNo.toUpperCase(),
      pan_number: pan.toUpperCase(),
      state_code: stateCode,
      address,
      custom_fields: {
        type: companyType,
        contact_person: contactPerson,
        pan: pan.toUpperCase(),
        ...Object.fromEntries(customFields.filter(f => f.key).map(f => [f.key, f.value])),
      },
    };
    try {
      if (approval.requiresApproval()) {
        const actionType = editingId ? 'update' : 'create';
        const summary = editingId
          ? `Update company: ${companyName}`
          : `Add new company: ${companyName}`;
        await approval.submitForApproval({
          module: 'companies',
          actionType,
          summary,
          data: body,
          ...(editingId ? { referenceId: String(editingId) } : {}),
        });
        success('Submitted for approval');
        resetForm();
      } else {
        if (editingId) {
          const result = await apiPut<any>(`/companies/${editingId}`, body);
          setCompanies(prev => prev.map(c => c.id === editingId ? { ...c, ...result } : c));
          success('Company updated successfully');
        } else {
          const result = await apiPost<any>('/companies', body);
          setCompanies(prev => [result, ...prev]);
          success('Company added successfully');
        }
        resetForm();
      }
    } catch (err: any) {
      notifyError('Failed to save company: ' + err.message);
    } finally {
      setSaving(false);
    }
  }, [companyName, companyType, contactPerson, phone, email, gstNo, pan, stateCode, address, customFields, editingId, success, notifyError, resetForm, approval]);

  const editCompany = useCallback((c: any) => {
    setEditingId(c.id);
    setCompanyName(c.name ?? '');
    setCompanyType(c.custom_fields?.type ?? '');
    setContactPerson(c.custom_fields?.contact_person ?? '');
    setPhone(c.phone ?? '');
    setEmail(c.email ?? '');
    setGstNo(c.gst_number ?? '');
    setPan(c.pan_number ?? c.custom_fields?.pan ?? '');
    setStateCode(c.state_code ?? '');
    setAddress(c.address ?? '');
    const cf = c.custom_fields ?? {};
    const reserved = ['type', 'contact_person', 'pan'];
    const fields = Object.entries(cf)
      .filter(([k]) => !reserved.includes(k))
      .map(([key, value]) => ({ key, value: String(value) }));
    setCustomFields(fields);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const deleteCompany = useCallback(async (c: any) => {
    const ok = await confirm({
      title: 'Delete Company',
      message: `Are you sure you want to delete "${c.name}"? This action cannot be undone.`,
      type: 'danger',
      confirmText: 'Delete',
    });
    if (!ok) return;
    try {
      if (approval.requiresApproval()) {
        await approval.submitForApproval({
          module: 'companies',
          actionType: 'delete',
          summary: `Delete company: ${c.name}`,
          data: { id: c.id },
          referenceId: String(c.id),
        });
        success('Submitted for approval');
      } else {
        await apiDelete(`/companies/${c.id}`);
        setCompanies(prev => prev.filter(co => co.id !== c.id));
        success('Company deleted');
      }
    } catch (err: any) {
      notifyError('Failed to delete company: ' + err.message);
    }
  }, [confirm, success, notifyError, approval]);

  const getStateName = (code: string) => STATE_ITEMS.find(s => s.value === code)?.label ?? code ?? '--';

  const getCustomFieldEntries = (cf: any): CustomField[] => {
    if (!cf) return [];
    const reserved = ['type', 'contact_person', 'pan'];
    return Object.entries(cf)
      .filter(([k]) => !reserved.includes(k))
      .map(([key, value]) => ({ key, value: String(value) }));
  };

  const handleExportExcel = useCallback(() => {
    exportToExcel(
      filteredCompanies.map(c => ({
        Name: c.name,
        Type: c.custom_fields?.type,
        Contact: c.custom_fields?.contact_person,
        Phone: c.phone,
        Email: c.email,
        GST: c.gst_number,
        PAN: c.pan_number ?? c.custom_fields?.pan,
        State: c.state_code,
        Address: c.address,
      })),
      'companies'
    );
  }, [filteredCompanies]);

  const addCustomField = () => setCustomFields(prev => [...prev, { key: '', value: '' }]);
  const removeCustomField = (index: number) => setCustomFields(prev => prev.filter((_, i) => i !== index));
  const updateCustomFieldKey = (index: number, key: string) =>
    setCustomFields(prev => prev.map((item, i) => i === index ? { ...item, key } : item));
  const updateCustomFieldValue = (index: number, value: string) =>
    setCustomFields(prev => prev.map((item, i) => i === index ? { ...item, value } : item));

  return (
    <div className="page-container">
      <div className="page-header">
        <h1><i className="ri-building-2-line"></i> {editingId ? 'Edit Company' : 'Add Company'}</h1>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn-export" onClick={handleExportExcel} disabled={!companies.length}>
            <i className="ri-file-excel-2-line"></i> Export Excel
          </button>
        </div>
      </div>

      <SummaryCards cards={summaryCards} />

      <div className="card-container" style={{ marginTop: 20 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, color: 'var(--accent)' }}>
          {editingId ? 'Edit Company Details' : 'New Company Registration'}
        </h3>
        <form onSubmit={(e) => { e.preventDefault(); saveCompany(); }}>
          <div className="form-grid">
            <div className="form-group">
              <label>Company Name <span style={{ color: 'var(--danger)' }}>*</span></label>
              <input type="text" value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="Company Name" required />
            </div>
            <div className="form-group">
              <label>Company Type <span style={{ color: 'var(--danger)' }}>*</span></label>
              <select value={companyType} onChange={e => setCompanyType(e.target.value)} required>
                <option value="">-- Select Type --</option>
                {COMPANY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Contact Person</label>
              <input type="text" value={contactPerson} onChange={e => setContactPerson(e.target.value)} placeholder="Contact Person" />
            </div>
            <div className="form-group">
              <label>Phone</label>
              <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="Phone Number" maxLength={10} pattern="[6-9]\d{9}" />
            </div>
            <div className="form-group">
              <label>Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email Address" />
            </div>
            <div className="form-group">
              <label>GST No</label>
              <input type="text" value={gstNo} onChange={e => setGstNo(e.target.value)} placeholder="GST Number" maxLength={15} style={{ textTransform: 'uppercase' }} />
            </div>
            <div className="form-group">
              <label>PAN <span style={{ color: 'var(--danger)' }}>*</span></label>
              <input type="text" value={pan} onChange={e => setPan(e.target.value)} placeholder="PAN Number" maxLength={10} style={{ textTransform: 'uppercase' }} required />
            </div>
            <div className="form-group">
              <SearchableDropdown items={STATE_ITEMS} label="State & Code" placeholder="Search State..." value={stateCode} onChange={setStateCode} />
            </div>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label>Address</label>
              <textarea value={address} onChange={e => setAddress(e.target.value)} placeholder="Full Address" rows={2} />
            </div>
          </div>

          {/* Custom Fields */}
          <div style={{ marginTop: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <label className={styles.profileLabel}>Custom Fields</label>
              <button type="button" className="btn-secondary" style={{ padding: '4px 12px', fontSize: 12 }} onClick={addCustomField}>
                <i className="ri-add-line"></i> Add Field
              </button>
            </div>
            {customFields.map((field, index) => (
              <div key={index} className={styles.customFieldRow}>
                <input type="text" value={field.key} onChange={e => updateCustomFieldKey(index, e.target.value)} placeholder="Field Name" style={{ flex: 1 }} />
                <input type="text" value={field.value} onChange={e => updateCustomFieldValue(index, e.target.value)} placeholder="Field Value" style={{ flex: 2 }} />
                <button type="button" className="btn-danger" style={{ padding: '6px 10px', fontSize: 14 }} onClick={() => removeCustomField(index)}>
                  <i className="ri-delete-bin-line"></i>
                </button>
              </div>
            ))}
          </div>

          <div className={styles.formActions}>
            <button type="submit" className="btn-primary" disabled={saving || !companyName || !companyType}>
              <i className={editingId ? 'ri-save-line' : 'ri-add-line'}></i>
              {editingId ? 'Update Company' : 'Add Company'}
            </button>
            {editingId && (
              <button type="button" className="btn-secondary" onClick={resetForm}>Cancel</button>
            )}
          </div>
        </form>
      </div>

      {/* Search */}
      <div className="card-container" style={{ marginTop: 20 }}>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search by name, GST, PAN, phone..." style={{ width: '100%' }} />
        </div>
      </div>

      {/* Company Table */}
      <div className="table-responsive" style={{ marginTop: 20 }}>
        {loading ? (
          <div className="empty-state"><div className="skeleton" style={{ height: 200 }}></div></div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Company Name</th>
                <th>Type</th>
                <th>Contact</th>
                <th>Phone</th>
                <th>GST</th>
                <th>PAN</th>
                <th>State</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredCompanies.length === 0 ? (
                <tr><td colSpan={8} className="empty-state">No companies found.</td></tr>
              ) : filteredCompanies.map(c => (
                <tr key={c.id}>
                  <td style={{ fontWeight: 600 }}>{c.name}</td>
                  <td><span className="badge badge-info">{c.custom_fields?.type ?? '--'}</span></td>
                  <td>{c.custom_fields?.contact_person ?? '--'}</td>
                  <td>{c.phone ?? '--'}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{c.gst_number ?? '--'}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{c.pan_number ?? c.custom_fields?.pan ?? '--'}</td>
                  <td>{getStateName(c.state_code)}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <button className="btn-secondary" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => { setProfileCompany(c); setProfileModalOpen(true); }} title="View Profile">
                        <i className="ri-eye-line"></i>
                      </button>
                      <button className="btn-primary" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => editCompany(c)} title="Edit">
                        <i className="ri-pencil-line"></i>
                      </button>
                      <button className="btn-danger" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => deleteCompany(c)} title="Delete">
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

      {/* Company Profile Modal */}
      <ModalDialog isOpen={profileModalOpen} title="Company Profile" size="lg" onClose={() => { setProfileModalOpen(false); setProfileCompany(null); }}>
        {profileCompany && (
          <div className={styles.profileGrid}>
            <div className="form-group">
              <label className={styles.profileLabel}>Company Name</label>
              <div className={styles.profileValue}>{profileCompany.name}</div>
            </div>
            <div className="form-group">
              <label className={styles.profileLabel}>Company Type</label>
              <div><span className="badge badge-info">{profileCompany.custom_fields?.type}</span></div>
            </div>
            <div className="form-group">
              <label className={styles.profileLabel}>Contact Person</label>
              <div>{profileCompany.custom_fields?.contact_person ?? '--'}</div>
            </div>
            <div className="form-group">
              <label className={styles.profileLabel}>Phone</label>
              <div>{profileCompany.phone ?? '--'}</div>
            </div>
            <div className="form-group">
              <label className={styles.profileLabel}>Email</label>
              <div>{profileCompany.email ?? '--'}</div>
            </div>
            <div className="form-group">
              <label className={styles.profileLabel}>GST Number</label>
              <div style={{ fontFamily: 'monospace' }}>{profileCompany.gst_number ?? '--'}</div>
            </div>
            <div className="form-group">
              <label className={styles.profileLabel}>PAN</label>
              <div style={{ fontFamily: 'monospace' }}>{profileCompany.pan_number ?? profileCompany.custom_fields?.pan ?? '--'}</div>
            </div>
            <div className="form-group">
              <label className={styles.profileLabel}>State</label>
              <div>{getStateName(profileCompany.state_code)}</div>
            </div>
            <div className={styles.fullSpan}>
              <label className={styles.profileLabel}>Address</label>
              <div>{profileCompany.address ?? '--'}</div>
            </div>
            {getCustomFieldEntries(profileCompany.custom_fields).length > 0 && (
              <div className={`${styles.fullSpan} ${styles.customFieldsSection}`}>
                <label className={styles.profileLabel} style={{ marginBottom: 10, display: 'block' }}>Custom Fields</label>
                <div className={styles.profileGrid}>
                  {getCustomFieldEntries(profileCompany.custom_fields).map(cf => (
                    <div key={cf.key}>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{cf.key}</span>
                      <div style={{ fontWeight: 600 }}>{cf.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        <div className="modal-footer">
          <button className="btn-primary" onClick={() => { if (profileCompany) { editCompany(profileCompany); setProfileModalOpen(false); } }}>
            <i className="ri-pencil-line"></i> Edit
          </button>
          <button className="btn-secondary" onClick={() => { setProfileModalOpen(false); setProfileCompany(null); }}>Close</button>
        </div>
      </ModalDialog>
    </div>
  );
}
