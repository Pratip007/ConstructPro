'use client';

import React, { useState, useMemo, useRef } from 'react';
import { apiPost } from '@/lib/api-client';
import { useNotification } from '@/contexts/NotificationContext';
import { useConfirmDialog } from '@/contexts/ConfirmDialogContext';

interface BackupModule {
  key: string;
  label: string;
  selected: boolean;
}

const INITIAL_MODULES: BackupModule[] = [
  { key: 'companies', label: 'Companies', selected: true },
  { key: 'sites', label: 'Sites', selected: true },
  { key: 'employees', label: 'Employees', selected: true },
  { key: 'contractors', label: 'Contractors', selected: true },
  { key: 'retailers', label: 'Retailers', selected: true },
  { key: 'invoices', label: 'Invoices', selected: true },
  { key: 'payments', label: 'Payments', selected: true },
  { key: 'stock', label: 'Stock/Inventory', selected: true },
  { key: 'equipment', label: 'Equipment', selected: true },
  { key: 'documents', label: 'Documents', selected: true },
];

export default function BackupPage() {
  const { success: notifySuccess, error: notifyError } = useNotification();
  const { confirm } = useConfirmDialog();

  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [exportStatus, setExportStatus] = useState('');
  const [importStatus, setImportStatus] = useState('');
  const [lastExportTime, setLastExportTime] = useState('');
  const [backupModules, setBackupModules] = useState<BackupModule[]>(INITIAL_MODULES);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const allSelected = useMemo(() => backupModules.every(m => m.selected), [backupModules]);

  const toggleAll = () => {
    const newVal = !allSelected;
    setBackupModules(prev => prev.map(m => ({ ...m, selected: newVal })));
  };

  const toggleModule = (key: string) => {
    setBackupModules(prev => prev.map(m => m.key === key ? { ...m, selected: !m.selected } : m));
  };

  const exportBackup = async () => {
    const selected = backupModules.filter(m => m.selected);
    if (!selected.length) { notifyError('Select at least one module to export'); return; }
    const ok = await confirm({
      title: 'Export Backup',
      message: `Export backup for ${selected.length} module(s): ${selected.map(m => m.label).join(', ')}?`,
      confirmText: 'Export',
    });
    if (!ok) return;

    setExporting(true);
    setExportStatus('Preparing backup data...');
    try {
      const data = await apiPost<unknown>('/backup/export', { modules: selected.map(m => m.key) });
      setExportStatus('Generating file...');
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setLastExportTime(new Date().toLocaleString('en-IN'));
      setExportStatus('Backup exported successfully');
      notifySuccess('Backup exported successfully');
    } catch {
      notifyError('Failed to export backup');
      setExportStatus('Export failed. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const importBackup = async () => {
    if (!importFile) { notifyError('Please select a backup JSON file'); return; }
    const ok = await confirm({
      title: 'Import Backup',
      message: 'This will overwrite existing data. Are you sure you want to proceed?',
      confirmText: 'Import',
      type: 'danger',
    });
    if (!ok) return;

    setImporting(true);
    setImportStatus('Reading backup file...');
    try {
      const text = await importFile.text();
      setImportStatus('Parsing JSON data...');
      const data = JSON.parse(text);
      setImportStatus('Uploading to server...');
      await apiPost('/backup/import', data);
      setImportFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setImportStatus('Backup imported successfully');
      notifySuccess('Backup imported successfully');
    } catch (err) {
      if (err instanceof SyntaxError) {
        notifyError('Invalid JSON file');
        setImportStatus('Invalid JSON format');
      } else {
        notifyError('Failed to import backup');
        setImportStatus('Import failed. Please check the file and try again.');
      }
    } finally {
      setImporting(false);
    }
  };

  const getStatusColor = (status: string, isActive: boolean): string => {
    if (isActive) return 'var(--text-muted)';
    if (status.includes('failed') || status.includes('Invalid')) return 'var(--danger)';
    return 'var(--success)';
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1><i className="ri-database-2-line"></i> Company Backup</h1>
      </div>

      {/* Export Section */}
      <div className="card-container">
        <h2 style={{ margin: '0 0 8px' }}><i className="ri-download-cloud-line"></i> Export Backup</h2>
        <p style={{ margin: '0 0 16px', color: 'var(--text-muted)' }}>
          Download company data as a JSON backup file. Select modules to include:
        </p>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, cursor: 'pointer', fontWeight: 700 }}>
            <input type="checkbox" checked={allSelected} onChange={toggleAll} style={{ width: 16, height: 16 }} />
            Select All
          </label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {backupModules.map(mod => (
              <label
                key={mod.key}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
                  background: mod.selected ? 'rgba(59,130,246,0.1)' : 'var(--bg-secondary)',
                  borderRadius: 6, cursor: 'pointer', fontSize: 13,
                  border: '1px solid var(--border-color)',
                }}
              >
                <input type="checkbox" checked={mod.selected} onChange={() => toggleModule(mod.key)} style={{ width: 14, height: 14 }} />
                {mod.label}
              </label>
            ))}
          </div>
        </div>

        <button className="btn-primary" onClick={exportBackup} disabled={exporting}>
          {exporting ? <><i className="ri-loader-4-line"></i> Exporting...</> : <><i className="ri-download-2-line"></i> Export Backup</>}
        </button>
        {exportStatus && (
          <p style={{ margin: '12px 0 0', fontSize: 13, color: getStatusColor(exportStatus, exporting) }}>
            {exportStatus}
          </p>
        )}
        {lastExportTime && (
          <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>Last export: {lastExportTime}</p>
        )}
      </div>

      {/* Import Section */}
      <div className="card-container" style={{ marginTop: 16 }}>
        <h2 style={{ margin: '0 0 8px' }}><i className="ri-upload-cloud-line"></i> Import Backup</h2>
        <p style={{ margin: '0 0 16px', color: 'var(--text-muted)' }}>
          Select a previously exported JSON backup file to restore data.{' '}
          <strong style={{ color: 'var(--danger)' }}>Warning:</strong> This will overwrite existing data.
        </p>
        <div className="form-group" style={{ marginBottom: 16 }}>
          <label>Backup File (JSON)</label>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            onChange={e => { setImportFile(e.target.files?.[0] ?? null); setImportStatus(''); }}
            style={{ padding: 8, background: 'var(--input-bg)', border: '1px solid var(--border-color)', borderRadius: 6, color: 'var(--text-main)' }}
          />
        </div>
        {importFile && (
          <p style={{ margin: '0 0 12px', color: 'var(--text-main)', fontSize: 13 }}>
            <i className="ri-file-line"></i> Selected: {importFile.name}
          </p>
        )}
        <button className="btn-primary" onClick={importBackup} disabled={importing || !importFile}>
          {importing ? <><i className="ri-loader-4-line"></i> Importing...</> : <><i className="ri-upload-2-line"></i> Import Backup</>}
        </button>
        {importStatus && (
          <p style={{ margin: '12px 0 0', fontSize: 13, color: getStatusColor(importStatus, importing) }}>
            {importStatus}
          </p>
        )}
      </div>
    </div>
  );
}
