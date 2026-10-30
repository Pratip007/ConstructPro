'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api-client';
import { useNotification } from '@/contexts/NotificationContext';
import { useConfirmDialog } from '@/contexts/ConfirmDialogContext';
import { useRole } from '@/hooks/useRole';
import { useApproval } from '@/hooks/useApproval';
import { exportToExcel, exportToCSV, printReport } from '@/lib/export-utils';
import SearchableDropdown from '@/components/SearchableDropdown';
import ModalDialog from '@/components/ModalDialog';
import SummaryCards from '@/components/SummaryCards';
import styles from './AddContractorPage.module.scss';

const WORK_TYPES = [
  'Civil Work', 'Plumbing', 'Electrical', 'Painting',
  'Material Supplier', 'Fabrication', 'Carpentry', 'Flooring', 'Other'
];

interface Contractor {
  id: number;
  name: string;
  company: string;
  contact: string;
  email: string;
  pan: string;
  gst: string;
  address: string;
  work_type: string;
  tds_applicable: boolean;
  tds_percent: number;
  status?: string;
}

interface ContractorResponse {
  id: number;
  name: string;
  phone: string;
  email: string;
  pan: string;
  gst_number: string;
  category: string;
  address: string;
  tds_applicable: boolean;
  tds_percent: number;
  work_type?: string;
  status?: string;
}

interface DocumentInfo {
  id: string;
  name: string;
  category: string;
  url?: string;
  file_type?: string;
}

function toFrontend(r: ContractorResponse): Contractor {
  return {
    id: r.id,
    name: r.name,
    company: r.category,
    contact: r.phone,
    email: r.email,
    pan: r.pan,
    gst: r.gst_number,
    address: r.address,
    work_type: r.work_type || '',
    tds_applicable: r.tds_applicable,
    tds_percent: r.tds_percent,
    status: r.status,
  };
}

export default function AddContractorPage() {
  const { success, error: notifyError } = useNotification();
  const { confirm } = useConfirmDialog();
  const role = useRole();
  const approval = useApproval();

  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [contact, setContact] = useState('');
  const [email, setEmail] = useState('');
  const [pan, setPan] = useState('');
  const [gst, setGst] = useState('');
  const [address, setAddress] = useState('');
  const [workType, setWorkType] = useState('');
  const [tdsApplicable, setTdsApplicable] = useState<'yes' | 'no'>('no');
  const [tdsPercent, setTdsPercent] = useState(0);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<Contractor | null>(null);
  const [profileDocuments, setProfileDocuments] = useState<DocumentInfo[]>([]);
  const [uploadingDoc, setUploadingDoc] = useState(false);

  const kycCategories = [
    { key: 'photo', label: 'Profile Photo', accept: 'image/*' },
    { key: 'aadhaar', label: 'Aadhaar Card', accept: 'image/*,.pdf' },
    { key: 'pan_card', label: 'PAN Card', accept: 'image/*,.pdf' },
    { key: 'bank_passbook', label: 'Bank Passbook', accept: 'image/*,.pdf' },
    { key: 'agreement', label: 'Agreement Copy', accept: 'image/*,.pdf' },
  ];

  const workTypeItems = useMemo(() =>
    WORK_TYPES.map(w => ({ value: w, label: w })), []
  );

  const filteredContractors = useMemo(() => {
    const q = searchQuery.toLowerCase();
    if (!q) return contractors;
    return contractors.filter(
      c =>
        c.name.toLowerCase().includes(q) ||
        c.company.toLowerCase().includes(q) ||
        c.contact.includes(q) ||
        c.pan.toLowerCase().includes(q) ||
        c.gst.toLowerCase().includes(q) ||
        c.work_type.toLowerCase().includes(q)
    );
  }, [contractors, searchQuery]);

  const summaryCards = useMemo(() => [
    { title: 'Total Contractors', value: contractors.length, icon: 'ri-group-line', color: 'primary' as const },
    { title: 'TDS Applicable', value: contractors.filter(c => c.tds_applicable).length, icon: 'ri-percent-line', color: 'warning' as const },
    { title: 'Active', value: contractors.filter(c => c.status !== 'pending').length, icon: 'ri-checkbox-circle-line', color: 'success' as const },
  ], [contractors]);

  const loadContractors = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet<ContractorResponse[]>('/contractors');
      setContractors(data.map(toFrontend));
    } catch (err: any) {
      notifyError('Failed to load contractors: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [notifyError]);

  useEffect(() => {
    loadContractors();
  }, [loadContractors]);

  const resetForm = useCallback(() => {
    setEditingId(null);
    setName('');
    setCompany('');
    setContact('');
    setEmail('');
    setPan('');
    setGst('');
    setAddress('');
    setWorkType('');
    setTdsApplicable('no');
    setTdsPercent(0);
    setAvatarPreview(null);
  }, []);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !contact) {
      notifyError('Name and contact are required.');
      return;
    }
    const payload = {
      name,
      phone: contact,
      email,
      pan: pan.toUpperCase(),
      gst_number: gst.toUpperCase(),
      category: company,
      address,
      tds_applicable: tdsApplicable === 'yes',
      tds_percent: tdsApplicable === 'yes' ? tdsPercent : 0,
      work_type: workType,
    };

    setSaving(true);
    try {
      if (approval.requiresApproval()) {
        const actionType = editingId !== null ? 'update' : 'create';
        const summary = editingId !== null
          ? `Update contractor: ${name}`
          : `Add new contractor: ${name}`;
        await approval.submitForApproval({
          module: 'contractors',
          actionType,
          summary,
          data: payload,
          ...(editingId !== null ? { referenceId: String(editingId) } : {}),
        });
        success('Submitted for approval');
        resetForm();
      } else {
        if (editingId !== null) {
          const updated = await apiPut<ContractorResponse>(`/contractors/${editingId}`, payload);
          setContractors(list => list.map(c => (c.id === updated.id ? toFrontend(updated) : c)));
          success('Contractor updated.');
        } else {
          const created = await apiPost<ContractorResponse>('/contractors', payload);
          setContractors(list => [...list, toFrontend(created)]);
          success('Contractor added.');
        }
        resetForm();
      }
    } catch (err: any) {
      notifyError('Failed to save contractor: ' + err.message);
    } finally {
      setSaving(false);
    }
  }, [name, contact, email, pan, gst, company, address, tdsApplicable, tdsPercent, workType, editingId, success, notifyError, resetForm, approval]);

  const editContractor = useCallback((c: Contractor) => {
    setEditingId(c.id);
    setName(c.name);
    setCompany(c.company);
    setContact(c.contact);
    setEmail(c.email);
    setPan(c.pan);
    setGst(c.gst);
    setAddress(c.address);
    setWorkType(c.work_type);
    setTdsApplicable(c.tds_applicable ? 'yes' : 'no');
    setTdsPercent(c.tds_percent ?? 0);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const deleteContractor = useCallback(async (c: Contractor) => {
    const ok = await confirm({
      title: 'Delete Contractor',
      message: `Are you sure you want to delete "${c.name}"? This action cannot be undone.`,
      type: 'danger',
      confirmText: 'Delete',
    });
    if (!ok) return;

    try {
      if (approval.requiresApproval()) {
        await approval.submitForApproval({
          module: 'contractors',
          actionType: 'delete',
          summary: `Delete contractor: ${c.name}`,
          data: { id: c.id },
          referenceId: String(c.id),
        });
        success('Submitted for approval');
      } else {
        await apiDelete(`/contractors/${c.id}`);
        setContractors(list => list.filter(x => x.id !== c.id));
        success('Contractor deleted.');
      }
    } catch (err: any) {
      notifyError('Failed to delete: ' + err.message);
    }
  }, [confirm, success, notifyError, approval]);

  const viewProfile = useCallback(async (c: Contractor) => {
    setSelectedProfile(c);
    setProfileModalOpen(true);
    try {
      const docs = await apiGet<DocumentInfo[]>('/documents', { entity_ref: `contractor-${c.id}` });
      setProfileDocuments(docs);
    } catch {
      setProfileDocuments([]);
    }
  }, []);

  const closeProfile = useCallback(() => {
    setProfileModalOpen(false);
    setSelectedProfile(null);
    setProfileDocuments([]);
  }, []);

  const uploadKycDocument = useCallback(async (e: React.ChangeEvent<HTMLInputElement>, category: string) => {
    const file = e.target.files?.[0];
    if (!file || !selectedProfile) return;

    setUploadingDoc(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(',')[1];
        const doc = await apiPost<DocumentInfo>('/documents', {
          name: file.name,
          category,
          entity_ref: `contractor-${selectedProfile.id}`,
          file_data: base64,
          file_type: file.type,
          file_size: file.size,
        });
        setProfileDocuments(list => [...list, doc]);
        success(`${category} uploaded successfully.`);
        setUploadingDoc(false);
        e.target.value = '';
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      notifyError('Upload failed: ' + err.message);
      setUploadingDoc(false);
    }
  }, [selectedProfile, success, notifyError]);

  const deleteDocument = useCallback(async (doc: DocumentInfo) => {
    try {
      await apiDelete(`/documents/${doc.id}`);
      setProfileDocuments(list => list.filter(d => d.id !== doc.id));
      success('Document deleted.');
    } catch (err: any) {
      notifyError('Failed: ' + err.message);
    }
  }, [success, notifyError]);

  const getDocsByCategory = useCallback((category: string) => {
    return profileDocuments.filter(d => d.category === category);
  }, [profileDocuments]);

  const onAvatarSelected = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    if (file) {
      const reader = new FileReader();
      reader.onload = () => setAvatarPreview(reader.result as string);
      reader.readAsDataURL(file);
    } else {
      setAvatarPreview(null);
    }
  }, []);

  const handleExportExcel = useCallback(() => {
    exportToExcel(filteredContractors as any, 'contractors', 'Contractors', [
      { key: 'name', header: 'Name' },
      { key: 'company', header: 'Company' },
      { key: 'work_type', header: 'Work Type' },
      { key: 'contact', header: 'Contact' },
      { key: 'pan', header: 'PAN' },
      { key: 'gst', header: 'GST' },
      { key: 'tds_percent', header: 'TDS %' },
    ]);
  }, [filteredContractors]);

  const handleExportCsv = useCallback(() => {
    exportToCSV(filteredContractors as any, 'contractors', [
      { key: 'name', header: 'Name' },
      { key: 'company', header: 'Company' },
      { key: 'work_type', header: 'Work Type' },
      { key: 'contact', header: 'Contact' },
      { key: 'pan', header: 'PAN' },
      { key: 'gst', header: 'GST' },
      { key: 'tds_percent', header: 'TDS %' },
    ]);
  }, [filteredContractors]);

  const handlePrint = useCallback(() => {
    printReport('contractorTable', 'Contractor List');
  }, []);

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>{editingId ? 'Edit Contractor' : 'Add Contractor'}</h1>
      </div>

      <SummaryCards cards={summaryCards} />

      <div className="card-container" style={{ marginTop: 16 }}>
        <form onSubmit={handleSubmit} className="form-grid">
          <div className="form-group">
            <label>Full Name / Company Name *</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Contractor full name or company"
              required
              minLength={2}
            />
          </div>

          <div className="form-group">
            <label>Company / Firm</label>
            <input type="text" value={company} onChange={e => setCompany(e.target.value)} placeholder="Company/Firm name" />
          </div>

          <div className="form-group">
            <SearchableDropdown
              items={workTypeItems}
              label="Work Type / Category"
              placeholder="Select work type"
              value={workType}
              onChange={setWorkType}
            />
          </div>

          <div className="form-group">
            <label>Contact *</label>
            <input
              type="tel"
              value={contact}
              onChange={e => setContact(e.target.value)}
              placeholder="Phone number"
              maxLength={10}
              required
              pattern="[6-9]\d{9}"
            />
          </div>

          <div className="form-group">
            <label>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email address" />
          </div>

          <div className="form-group">
            <label>PAN Number *</label>
            <input type="text" value={pan} onChange={e => setPan(e.target.value)} placeholder="ABCDE1234F" maxLength={10} style={{ textTransform: 'uppercase' }} required />
          </div>

          <div className="form-group">
            <label>GST / Trade License No</label>
            <input type="text" value={gst} onChange={e => setGst(e.target.value)} placeholder="GST or Trade License Number" maxLength={15} style={{ textTransform: 'uppercase' }} />
          </div>

          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label>Full Address</label>
            <textarea value={address} onChange={e => setAddress(e.target.value)} placeholder="Full address" rows={2} />
          </div>

          <div className="form-group">
            <label>TDS Applicable</label>
            <div className={styles.radioGroup}>
              <label className={styles.radioLabel}>
                <input type="radio" checked={tdsApplicable === 'yes'} onChange={() => setTdsApplicable('yes')} />
                Yes
              </label>
              <label className={styles.radioLabel}>
                <input type="radio" checked={tdsApplicable === 'no'} onChange={() => setTdsApplicable('no')} />
                No
              </label>
            </div>
          </div>

          {tdsApplicable === 'yes' && (
            <div className="form-group">
              <label>TDS %</label>
              <input type="number" value={tdsPercent} onChange={e => setTdsPercent(Number(e.target.value))} placeholder="e.g., 1 or 2" min={0} max={100} />
            </div>
          )}

          <div className="form-group">
            <label>Photo</label>
            <input type="file" accept="image/*" onChange={onAvatarSelected} />
            {avatarPreview && (
              <img src={avatarPreview} alt="Avatar preview" className={styles.avatarPreview} />
            )}
          </div>

          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <div className={styles.formActions}>
              <button type="submit" className="btn-primary" disabled={saving}>
                <i className={editingId ? 'ri-save-line' : 'ri-add-line'} />
                {editingId ? 'Update Contractor' : 'Add Contractor'}
              </button>
              {editingId && (
                <button type="button" className="btn-secondary" onClick={resetForm}>
                  <i className="ri-close-line" /> Cancel
                </button>
              )}
            </div>
          </div>
        </form>
      </div>

      <div className="card-container" style={{ marginTop: 16 }}>
        <div className={styles.toolbarRow}>
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search contractor, phone, PAN, GST, work type..."
            className={styles.searchInput}
          />
          <div className={styles.exportButtons}>
            <button className="btn-secondary" onClick={handleExportCsv}><i className="ri-file-text-line" /> CSV</button>
            <button className="btn-secondary" onClick={handleExportExcel}><i className="ri-file-excel-2-line" /> Excel</button>
            <button className="btn-secondary" onClick={handlePrint}><i className="ri-printer-line" /> Print</button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="skeleton" style={{ height: 200, marginTop: 16 }} />
      ) : (
        <div className="table-responsive" style={{ marginTop: 16 }}>
          <table id="contractorTable">
            <thead>
              <tr>
                <th>#</th>
                <th>Name</th>
                <th>Work Type</th>
                <th>Contact</th>
                <th>PAN</th>
                <th>GST</th>
                <th>TDS Status</th>
                <th>Status</th>
                <th style={{ textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredContractors.length === 0 ? (
                <tr><td colSpan={9} className="empty-state">No contractors found.</td></tr>
              ) : (
                filteredContractors.map((c, i) => (
                  <tr key={c.id} className={c.status === 'pending' ? styles.pendingRow : ''}>
                    <td>{i + 1}</td>
                    <td style={{ fontWeight: 600 }}>{c.name}</td>
                    <td>
                      {c.work_type ? (
                        <span className="badge badge-info">{c.work_type}</span>
                      ) : (
                        <span className="text-muted">--</span>
                      )}
                    </td>
                    <td>{c.contact}</td>
                    <td style={{ textTransform: 'uppercase', fontFamily: 'monospace' }}>{c.pan}</td>
                    <td style={{ fontSize: 12, textTransform: 'uppercase' }}>{c.gst || '--'}</td>
                    <td>
                      {c.tds_applicable ? (
                        <span className="badge badge-success">Yes ({c.tds_percent}%)</span>
                      ) : (
                        <span className="badge badge-danger">No</span>
                      )}
                    </td>
                    <td>
                      {c.status === 'pending' ? (
                        <span className="badge badge-warning">Pending</span>
                      ) : (
                        <span className="badge badge-success">Active</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div className={styles.actionButtons}>
                        <button className={styles.btnIcon} onClick={() => viewProfile(c)} title="Profile">
                          <i className="ri-user-line" />
                        </button>
                        <button className={styles.btnIcon} onClick={() => editContractor(c)} title="Edit">
                          <i className="ri-edit-line" />
                        </button>
                        <button className={`${styles.btnIcon} ${styles.btnIconDanger}`} onClick={() => deleteContractor(c)} title="Delete">
                          <i className="ri-delete-bin-line" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Profile Modal */}
      <ModalDialog isOpen={profileModalOpen} title={`Profile: ${selectedProfile?.name ?? ''}`} size="lg" onClose={closeProfile}>
        {selectedProfile && (
          <div>
            <div className="form-grid">
              <div className="form-group">
                <label>Name</label>
                <input type="text" value={selectedProfile.name} disabled />
              </div>
              <div className="form-group">
                <label>Company</label>
                <input type="text" value={selectedProfile.company || '--'} disabled />
              </div>
              <div className="form-group">
                <label>Contact</label>
                <input type="text" value={selectedProfile.contact} disabled />
              </div>
              <div className="form-group">
                <label>PAN</label>
                <input type="text" value={selectedProfile.pan} disabled style={{ textTransform: 'uppercase' }} />
              </div>
              <div className="form-group">
                <label>GST</label>
                <input type="text" value={selectedProfile.gst || '--'} disabled />
              </div>
              <div className="form-group">
                <label>Work Type</label>
                <input type="text" value={selectedProfile.work_type || '--'} disabled />
              </div>
            </div>

            <h3 style={{ marginTop: 20, marginBottom: 12 }}>KYC Documents</h3>
            {kycCategories.map(cat => {
              const docs = getDocsByCategory(cat.key);
              return (
                <div key={cat.key} className={styles.kycRow}>
                  <div className={styles.kycLabel}>{cat.label}</div>
                  <div className={styles.kycActions}>
                    {docs.length > 0 ? (
                      docs.map(doc => (
                        <div key={doc.id} className={styles.kycDoc}>
                          <span>{doc.name}</span>
                          <button className={`${styles.btnIcon} ${styles.btnIconDanger}`} onClick={() => deleteDocument(doc)} title="Delete">
                            <i className="ri-delete-bin-line" />
                          </button>
                        </div>
                      ))
                    ) : (
                      <span className="text-muted">Not uploaded</span>
                    )}
                    <label className={styles.uploadLabel}>
                      <i className="ri-upload-2-line" /> Upload
                      <input type="file" accept={cat.accept} onChange={e => uploadKycDocument(e, cat.key)} style={{ display: 'none' }} disabled={uploadingDoc} />
                    </label>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div data-modal-footer>
          <button className="btn-secondary" onClick={closeProfile}>Close</button>
        </div>
      </ModalDialog>
    </div>
  );
}
