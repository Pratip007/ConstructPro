'use client';

import React, { useState, useMemo, useRef } from 'react';
import { apiPost } from '@/lib/api-client';
import { useNotification } from '@/contexts/NotificationContext';
import { useConfirmDialog } from '@/contexts/ConfirmDialogContext';

interface BackupModule {
  key: string;
  label: string;
  icon: string;
  selected: boolean;
}

const INITIAL_MODULES: BackupModule[] = [
  { key: 'companies', label: 'Companies', icon: 'ri-building-line', selected: true },
  { key: 'sites', label: 'Sites', icon: 'ri-map-pin-line', selected: true },
  { key: 'employees', label: 'Employees', icon: 'ri-team-line', selected: true },
  { key: 'contractors', label: 'Contractors', icon: 'ri-user-star-line', selected: true },
  { key: 'retailers', label: 'Retailers', icon: 'ri-store-line', selected: true },
  { key: 'invoices', label: 'Invoices', icon: 'ri-bill-line', selected: true },
  { key: 'payments', label: 'Payments', icon: 'ri-bank-card-line', selected: true },
  { key: 'stock', label: 'Stock/Inventory', icon: 'ri-stack-line', selected: true },
  { key: 'equipment', label: 'Equipment', icon: 'ri-tools-line', selected: true },
  { key: 'documents', label: 'Documents', icon: 'ri-file-list-3-line', selected: true },
  { key: 'loans', label: 'Loans', icon: 'ri-hand-coin-line', selected: true },
  { key: 'settings', label: 'Settings', icon: 'ri-settings-3-line', selected: true },
];

interface ImportReport {
  total: number;
  imported: number;
  skipped: number;
  errors: string[];
}

export default function BackupPage() {
  const { success: notifySuccess, error: notifyError } = useNotification();
  const { confirm } = useConfirmDialog();

  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [exportStatus, setExportStatus] = useState('');
  const [importStatus, setImportStatus] = useState('');
  const [importReport, setImportReport] = useState<ImportReport | null>(null);
  const [lastExportTime, setLastExportTime] = useState('');
  const [backupModules, setBackupModules] = useState<BackupModule[]>(INITIAL_MODULES);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const allSelected = useMemo(() => backupModules.every(m => m.selected), [backupModules]);
  const selectedCount = useMemo(() => backupModules.filter(m => m.selected).length, [backupModules]);

  const toggleAll = () => {
    const newVal = !allSelected;
    setBackupModules(prev => prev.map(m => ({ ...m, selected: newVal })));
  };

  const toggleModule = (key: string) => {
    setBackupModules(prev => prev.map(m => m.key === key ? { ...m, selected: !m.selected } : m));
  };

  const exportBackup = async () => {
    const selected = backupModules.filter(m => m.selected);
    if (!selected.length) {
      notifyError('Select at least one module to export');
      return;
    }
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
      a.download = `constructpro-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setLastExportTime(new Date().toLocaleString('en-IN'));
      setExportStatus('Backup exported successfully');
      notifySuccess('Backup exported successfully');
    } catch (err: any) {
      notifyError(err.message ?? 'Failed to export backup');
      setExportStatus('Export failed. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const importBackup = async () => {
    if (!importFile) {
      notifyError('Please select a backup JSON file');
      return;
    }
    const ok = await confirm({
      title: 'Import Backup',
      message: 'WARNING: This will overwrite existing data with the backup contents. This action cannot be undone. Are you sure you want to proceed?',
      confirmText: 'Import',
      type: 'danger',
    });
    if (!ok) return;

    setImporting(true);
    setImportStatus('Reading backup file...');
    setImportReport(null);
    try {
      const text = await importFile.text();
      setImportStatus('Parsing JSON data...');
      const data = JSON.parse(text);
      setImportStatus('Uploading to server...');
      const result = await apiPost<ImportReport>('/backup/import', data);
      setImportFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setImportReport(result);
      setImportStatus('Backup imported successfully');
      notifySuccess('Backup imported successfully');
    } catch (err) {
      if (err instanceof SyntaxError) {
        notifyError('Invalid JSON file format');
        setImportStatus('Invalid JSON format. Please check the file.');
      } else {
        notifyError((err as any).message ?? 'Failed to import backup');
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
        <h1><i className="ri-database-2-line" /> Backup & Restore</h1>
      </div>

      {/* Export Section */}
      <div className="card-container">
        <h2 style={{ margin: '0 0 8px' }}>
          <i className="ri-download-cloud-line" /> Export Backup
        </h2>
        <p style={{ margin: '0 0 16px', color: 'var(--text-muted)', fontSize: 13 }}>
          Download company data as a JSON backup file. Select modules to include in the export.
        </p>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, cursor: 'pointer', fontWeight: 700 }}>
            <input type="checkbox" checked={allSelected} onChange={toggleAll} style={{ width: 16, height: 16 }} />
            Select All ({selectedCount}/{backupModules.length})
          </label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {backupModules.map(mod => (
              <label
                key={mod.key}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
                  background: mod.selected ? 'rgba(59,130,246,0.1)' : 'var(--bg-secondary)',
                  borderRadius: 6, cursor: 'pointer', fontSize: 13,
                  border: `1px solid ${mod.selected ? 'rgba(59,130,246,0.3)' : 'var(--border-color)'}`,
                  transition: 'all 0.2s',
                }}
              >
                <input type="checkbox" checked={mod.selected} onChange={() => toggleModule(mod.key)} style={{ width: 14, height: 14 }} />
                <i className={mod.icon} style={{ fontSize: 14, color: mod.selected ? 'var(--accent)' : 'var(--text-muted)' }} />
                {mod.label}
              </label>
            ))}
          </div>
        </div>

        <button className="btn-primary" onClick={exportBackup} disabled={exporting}>
          {exporting
            ? <><i className="ri-loader-4-line" /> Exporting...</>
            : <><i className="ri-download-2-line" /> Export Backup</>}
        </button>
        {exportStatus && (
          <p style={{ margin: '12px 0 0', fontSize: 13, color: getStatusColor(exportStatus, exporting) }}>
            {exportStatus}
          </p>
        )}
        {lastExportTime && (
          <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
            Last export: {lastExportTime}
          </p>
        )}
      </div>

      {/* Import Section */}
      <div className="card-container" style={{ marginTop: 16 }}>
        <h2 style={{ margin: '0 0 8px' }}>
          <i className="ri-upload-cloud-line" /> Import / Restore Backup
        </h2>
        <p style={{ margin: '0 0 8px', color: 'var(--text-muted)', fontSize: 13 }}>
          Select a previously exported JSON backup file to restore data.
        </p>

        {/* Warning banner */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 14px', marginBottom: 16, borderRadius: 8,
          background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
          color: 'var(--danger)', fontSize: 13,
        }}>
          <i className="ri-error-warning-fill" style={{ fontSize: 18, flexShrink: 0 }} />
          <span>
            <strong>Warning:</strong> Importing a backup will overwrite existing data for the included modules.
            This action cannot be undone. Make sure to export a backup before importing.
          </span>
        </div>

        <div className="form-group" style={{ marginBottom: 16 }}>
          <label>Backup File (JSON)</label>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            onChange={e => { setImportFile(e.target.files?.[0] ?? null); setImportStatus(''); setImportReport(null); }}
            style={{
              padding: 8, background: 'var(--input-bg)',
              border: '1px solid var(--border-color)', borderRadius: 6,
              color: 'var(--text-main)',
            }}
          />
        </div>

        {importFile && (
          <p style={{ margin: '0 0 12px', color: 'var(--text-main)', fontSize: 13 }}>
            <i className="ri-file-line" /> Selected: <strong>{importFile.name}</strong>{' '}
            ({(importFile.size / 1024).toFixed(1)} KB)
          </p>
        )}

        <button className="btn-danger" onClick={importBackup} disabled={importing || !importFile}>
          {importing
            ? <><i className="ri-loader-4-line" /> Importing...</>
            : <><i className="ri-upload-2-line" /> Import Backup</>}
        </button>

        {importStatus && (
          <p style={{ margin: '12px 0 0', fontSize: 13, color: getStatusColor(importStatus, importing) }}>
            {importStatus}
          </p>
        )}

        {/* Import Report */}
        {importReport && (
          <div style={{
            marginTop: 16, padding: 16, borderRadius: 8,
            background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
          }}>
            <h4 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700 }}>Import Report</h4>
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: 8 }}>
              <span style={{ fontSize: 13 }}>
                <strong>Total:</strong> {importReport.total}
              </span>
              <span style={{ fontSize: 13, color: 'var(--success)' }}>
                <strong>Imported:</strong> {importReport.imported}
              </span>
              <span style={{ fontSize: 13, color: 'var(--warning)' }}>
                <strong>Skipped:</strong> {importReport.skipped}
              </span>
              {importReport.errors?.length > 0 && (
                <span style={{ fontSize: 13, color: 'var(--danger)' }}>
                  <strong>Errors:</strong> {importReport.errors.length}
                </span>
              )}
            </div>
            {importReport.errors?.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <p style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, color: 'var(--danger)' }}>Error Details:</p>
                <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, color: 'var(--text-muted)' }}>
                  {importReport.errors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
