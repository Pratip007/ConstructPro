'use client';

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { apiGet, apiPost, apiDelete } from '@/lib/api-client';
import { useNotification } from '@/contexts/NotificationContext';
import { useConfirmDialog } from '@/contexts/ConfirmDialogContext';
import SearchableDropdown from '@/components/SearchableDropdown';
import ModalDialog from '@/components/ModalDialog';
import SummaryCards, { type SummaryCard } from '@/components/SummaryCards';

interface Folder { id: string; name: string; site_id?: string; parent_id?: string; }
interface DocItem { id: string; name: string; folder_id: string; file_type?: string; file_size?: number; description?: string; created_at?: string; download_url?: string; }
interface Site { id: string; name: string; }

export default function DocumentsPage() {
  const { success: notifySuccess, error: notifyError } = useNotification();
  const { confirm } = useConfirmDialog();

  const [sites, setSites] = useState<Site[]>([]);
  const [siteFilter, setSiteFilter] = useState('');

  const [folders, setFolders] = useState<Folder[]>([]);
  const [foldersLoading, setFoldersLoading] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState<Folder | null>(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderSiteId, setNewFolderSiteId] = useState('');

  const [documents, setDocuments] = useState<DocItem[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [newDocName, setNewDocName] = useState('');
  const [newDocDescription, setNewDocDescription] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewType, setPreviewType] = useState('');
  const [previewName, setPreviewName] = useState('');

  const siteItems = useMemo(() => sites.map(s => ({ value: s.id, label: s.name })), [sites]);

  const formatSize = (bytes?: number): string => {
    if (!bytes) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const totalSizeLabel = useMemo(() => {
    const bytes = documents.reduce((s, d) => s + (d.file_size ?? 0), 0);
    return formatSize(bytes);
  }, [documents]);

  const summaryCards = useMemo<SummaryCard[]>(() => [
    { title: 'Folders', value: folders.length, icon: 'ri-folder-line', color: 'primary' },
    { title: 'Documents', value: documents.length, icon: 'ri-file-text-line', color: 'info' },
    { title: 'Total Size', value: totalSizeLabel, icon: 'ri-hard-drive-line', color: 'warning' },
  ], [folders.length, documents.length, totalSizeLabel]);

  const filteredDocuments = useMemo(() => {
    const q = searchQuery.toLowerCase();
    if (!q) return documents;
    return documents.filter(d => d.name.toLowerCase().includes(q) || (d.description ?? '').toLowerCase().includes(q));
  }, [documents, searchQuery]);

  useEffect(() => {
    apiGet<Site[]>('/sites').then(res => setSites(Array.isArray(res) ? res : [])).catch(() => {});
    loadFolders();
  }, []);

  const loadFolders = useCallback(async (filterSiteId?: string) => {
    setFoldersLoading(true);
    try {
      const params: Record<string, string> = {};
      const sid = filterSiteId ?? siteFilter;
      if (sid) params.site_id = sid;
      const res = await apiGet<Folder[]>('/document-folders', params);
      setFolders(Array.isArray(res) ? res : []);
    } catch {
      notifyError('Failed to load folders');
    } finally {
      setFoldersLoading(false);
    }
  }, [siteFilter, notifyError]);

  const onSiteFilterChange = (siteId: string) => {
    setSiteFilter(siteId);
    setSelectedFolder(null);
    setDocuments([]);
    loadFolders(siteId);
  };

  const createFolder = async () => {
    if (!newFolderName.trim()) { notifyError('Folder name is required'); return; }
    const body: any = { name: newFolderName.trim() };
    const sid = newFolderSiteId || siteFilter;
    if (sid) body.site_id = sid;
    try {
      const folder = await apiPost<Folder>('/document-folders', body);
      setFolders(prev => [...prev, folder]);
      setNewFolderName('');
      setNewFolderSiteId('');
      notifySuccess('Folder created');
    } catch {
      notifyError('Failed to create folder');
    }
  };

  const deleteFolder = async (folder: Folder) => {
    const ok = await confirm({ title: 'Delete Folder', message: `Delete folder "${folder.name}" and all its documents?`, confirmText: 'Delete', type: 'danger' });
    if (!ok) return;
    try {
      await apiDelete(`/document-folders/${folder.id}`);
      setFolders(prev => prev.filter(f => f.id !== folder.id));
      if (selectedFolder?.id === folder.id) { setSelectedFolder(null); setDocuments([]); }
      notifySuccess('Folder deleted');
    } catch {
      notifyError('Failed to delete folder');
    }
  };

  const selectFolder = async (folder: Folder) => {
    setSelectedFolder(folder);
    setDocsLoading(true);
    try {
      const res = await apiGet<DocItem[]>('/documents', { folder_id: folder.id });
      setDocuments(Array.isArray(res) ? res : []);
    } catch {
      notifyError('Failed to load documents');
    } finally {
      setDocsLoading(false);
    }
  };

  const uploadDocument = async () => {
    if (!selectedFolder) { notifyError('Please select a folder first'); return; }
    if (!selectedFile) { notifyError('Please choose a file to upload'); return; }
    if (!newDocName.trim()) { notifyError('Document name is required'); return; }
    setUploading(true);
    try {
      const result = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(selectedFile);
      });
      const base64 = result.split(',')[1];
      const body: any = {
        name: newDocName.trim(),
        folder_id: selectedFolder.id,
        file_data: base64,
        file_type: selectedFile.type,
        file_size: selectedFile.size,
      };
      if (newDocDescription.trim()) body.description = newDocDescription.trim();
      if (selectedFolder.site_id) body.site_id = selectedFolder.site_id;
      const doc = await apiPost<DocItem>('/documents', body);
      setDocuments(prev => [...prev, doc]);
      setNewDocName('');
      setNewDocDescription('');
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      notifySuccess('Document uploaded');
    } catch {
      notifyError('Failed to upload document');
    } finally {
      setUploading(false);
    }
  };

  const previewDocument = async (doc: DocItem) => {
    try {
      const res = await apiGet<{ url: string }>(`/documents/${doc.id}/download`);
      if (res?.url) {
        setPreviewUrl(res.url);
        setPreviewType(doc.file_type ?? '');
        setPreviewName(doc.name);
        setShowPreviewModal(true);
      }
    } catch {
      notifyError('Failed to get preview');
    }
  };

  const downloadDocument = async (doc: DocItem) => {
    try {
      const res = await apiGet<{ url: string }>(`/documents/${doc.id}/download`);
      if (res?.url) window.open(res.url, '_blank');
      else notifyError('No download URL');
    } catch {
      notifyError('Failed to get download link');
    }
  };

  const deleteDocument = async (doc: DocItem) => {
    const ok = await confirm({ title: 'Delete Document', message: `Delete "${doc.name}"?`, confirmText: 'Delete', type: 'danger' });
    if (!ok) return;
    try {
      await apiDelete(`/documents/${doc.id}`);
      setDocuments(prev => prev.filter(d => d.id !== doc.id));
      notifySuccess('Document deleted');
    } catch {
      notifyError('Failed to delete document');
    }
  };

  const isImageType = (type: string) => type.startsWith('image/');
  const isPdfType = (type: string) => type === 'application/pdf';

  const fileIcon = (type?: string): string => {
    if (!type) return 'ri-file-line';
    if (type.startsWith('image/')) return 'ri-image-line';
    if (type === 'application/pdf') return 'ri-file-pdf-line';
    if (type.includes('spreadsheet') || type.includes('excel')) return 'ri-file-excel-line';
    if (type.includes('word') || type.includes('document')) return 'ri-file-word-line';
    return 'ri-file-line';
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1><i className="ri-file-list-3-line"></i> Document Management</h1>
      </div>

      <SummaryCards cards={summaryCards} />

      {/* Site Filter */}
      <div className="card-container" style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'end' }}>
          <div className="form-group" style={{ marginBottom: 0, minWidth: 200 }}>
            <SearchableDropdown items={siteItems} label="Filter by Site" value={siteFilter} onChange={onSiteFilterChange} placeholder="All Sites" />
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 16, marginTop: 16, alignItems: 'start' }}>
        {/* Folders Panel */}
        <div className="card-container" style={{ margin: 0 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>
            <i className="ri-folder-line"></i> Folders
          </h3>

          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <input type="text" value={newFolderName} onChange={e => setNewFolderName(e.target.value)} placeholder="New folder name" style={{ flex: 1 }} />
            <button className="btn-primary" onClick={createFolder} style={{ padding: '6px 12px', whiteSpace: 'nowrap' }}>
              <i className="ri-add-line"></i>
            </button>
          </div>

          <div className="form-group" style={{ marginBottom: 12 }}>
            <SearchableDropdown items={siteItems} value={newFolderSiteId} onChange={setNewFolderSiteId} placeholder="Site (optional)" />
          </div>

          <div style={{ maxHeight: 400, overflowY: 'auto' }}>
            {foldersLoading ? (
              <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Loading folders...</p>
            ) : folders.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No folders yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {folders.map(folder => (
                  <div
                    key={folder.id}
                    onClick={() => selectFolder(folder)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '8px 10px',
                      borderRadius: 6,
                      cursor: 'pointer',
                      fontSize: 13,
                      background: selectedFolder?.id === folder.id ? 'var(--accent-alpha, rgba(59,130,246,0.15))' : 'transparent',
                      border: selectedFolder?.id === folder.id ? '1px solid var(--accent)' : '1px solid transparent',
                    }}
                  >
                    <i className="ri-folder-fill" style={{ color: selectedFolder?.id === folder.id ? 'var(--accent)' : 'var(--text-muted)', fontSize: 16 }}></i>
                    <span style={{ flex: 1, fontWeight: selectedFolder?.id === folder.id ? 600 : 400 }}>{folder.name}</span>
                    <button
                      onClick={e => { e.stopPropagation(); deleteFolder(folder); }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', fontSize: 14, padding: 2, opacity: 0.6 }}
                      title="Delete folder"
                    >
                      <i className="ri-delete-bin-line"></i>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Documents Panel */}
        <div className="card-container" style={{ margin: 0 }}>
          {!selectedFolder ? (
            <div className="empty-state" style={{ padding: 40, textAlign: 'center' }}>
              <i className="ri-folder-open-line" style={{ fontSize: 48, color: 'var(--text-muted)', display: 'block', marginBottom: 12 }}></i>
              <p>Select a folder to view documents</p>
            </div>
          ) : (
            <>
              <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>
                <i className="ri-file-text-line"></i> Documents in &quot;{selectedFolder.name}&quot;
              </h3>

              {/* Upload form */}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'end', marginBottom: 16, padding: '12px', background: 'var(--bg-secondary)', borderRadius: 8 }}>
                <div className="form-group" style={{ marginBottom: 0, minWidth: 160 }}>
                  <label style={{ fontSize: 12 }}>Document Name *</label>
                  <input type="text" value={newDocName} onChange={e => setNewDocName(e.target.value)} placeholder="Document name" />
                </div>
                <div className="form-group" style={{ marginBottom: 0, minWidth: 140 }}>
                  <label style={{ fontSize: 12 }}>Description</label>
                  <input type="text" value={newDocDescription} onChange={e => setNewDocDescription(e.target.value)} placeholder="Description" />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: 12 }}>File</label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    onChange={e => setSelectedFile(e.target.files?.[0] ?? null)}
                    style={{ padding: 6, background: 'var(--input-bg)', border: '1px solid var(--border-color)', borderRadius: 6, color: 'var(--text-main)', fontSize: 12 }}
                  />
                </div>
                <button className="btn-primary" onClick={uploadDocument} disabled={uploading} style={{ height: 38 }}>
                  {uploading ? 'Uploading...' : <><i className="ri-upload-2-line"></i> Upload</>}
                </button>
              </div>

              {/* Search */}
              <div className="form-group" style={{ marginBottom: 12 }}>
                <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search documents..." />
              </div>

              {/* Documents table */}
              <div className="table-responsive">
                <table>
                  <thead>
                    <tr><th></th><th>Name</th><th>Description</th><th>Type</th><th>Size</th><th>Date</th><th>Actions</th></tr>
                  </thead>
                  <tbody>
                    {docsLoading ? (
                      <tr><td colSpan={7} className="empty-state">Loading documents...</td></tr>
                    ) : filteredDocuments.length === 0 ? (
                      <tr><td colSpan={7} className="empty-state">No documents found.</td></tr>
                    ) : filteredDocuments.map(doc => (
                      <tr key={doc.id}>
                        <td style={{ fontSize: 20, color: 'var(--accent)' }}><i className={fileIcon(doc.file_type)}></i></td>
                        <td style={{ fontWeight: 600 }}>{doc.name}</td>
                        <td>{doc.description ?? '-'}</td>
                        <td style={{ fontSize: 12 }}>{doc.file_type ?? '-'}</td>
                        <td>{formatSize(doc.file_size)}</td>
                        <td style={{ fontSize: 12 }}>{doc.created_at?.split('T')[0] ?? '-'}</td>
                        <td>
                          <div style={{ display: 'flex', gap: 6 }}>
                            {doc.file_type && (isImageType(doc.file_type) || isPdfType(doc.file_type)) && (
                              <button className="btn-secondary" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => previewDocument(doc)} title="Preview">
                                <i className="ri-eye-line"></i>
                              </button>
                            )}
                            <button className="btn-secondary" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => downloadDocument(doc)} title="Download">
                              <i className="ri-download-line"></i>
                            </button>
                            <button className="btn-danger" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => deleteDocument(doc)} title="Delete">
                              <i className="ri-delete-bin-line"></i>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Preview Modal */}
      <ModalDialog isOpen={showPreviewModal} title={previewName} size="xl" onClose={() => setShowPreviewModal(false)}>
        {previewUrl && (
          <div style={{ textAlign: 'center' }}>
            {isImageType(previewType) ? (
              <img src={previewUrl} style={{ maxWidth: '100%', maxHeight: 600, borderRadius: 8 }} alt={previewName} />
            ) : isPdfType(previewType) ? (
              <iframe src={previewUrl} style={{ width: '100%', height: 600, border: 'none', borderRadius: 8 }} title={previewName} />
            ) : (
              <p>Preview not available for this file type.</p>
            )}
          </div>
        )}
        <div style={{ marginTop: 16, textAlign: 'right' }}>
          <button className="btn-secondary" onClick={() => setShowPreviewModal(false)}>Close</button>
        </div>
      </ModalDialog>
    </div>
  );
}
