import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { NotificationService } from '../../../core/services/notification.service';
import { ConfirmDialogService } from '../../../core/services/confirm-dialog.service';

interface BackupModule {
  key: string;
  label: string;
  selected: boolean;
}

@Component({
  selector: 'app-backup',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './backup.html',
  styleUrl: './backup.scss',
})
export class BackupComponent {
  private api = inject(ApiService);
  private notifications = inject(NotificationService);
  private confirmService = inject(ConfirmDialogService);

  exporting = signal(false);
  importing = signal(false);
  importFile: File | null = null;

  exportStatus = signal('');
  importStatus = signal('');
  lastExportTime = signal('');

  backupModules = signal<BackupModule[]>([
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
  ]);

  get allSelected(): boolean {
    return this.backupModules().every(m => m.selected);
  }

  toggleAll(): void {
    const newVal = !this.allSelected;
    this.backupModules.update(list => list.map(m => ({ ...m, selected: newVal })));
  }

  toggleModule(key: string): void {
    this.backupModules.update(list => list.map(m => m.key === key ? { ...m, selected: !m.selected } : m));
  }

  async exportBackup(): Promise<void> {
    const selected = this.backupModules().filter(m => m.selected);
    if (!selected.length) { this.notifications.error('Select at least one module to export'); return; }
    const ok = await this.confirmService.confirm({
      title: 'Export Backup',
      message: `Export backup for ${selected.length} module(s): ${selected.map(m => m.label).join(', ')}?`,
      confirmText: 'Export',
    });
    if (!ok) return;

    this.exporting.set(true);
    this.exportStatus.set('Preparing backup data...');
    const body = { modules: selected.map(m => m.key) };
    this.api.post<unknown>('/backup/export', body).subscribe({
      next: data => {
        this.exportStatus.set('Generating file...');
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
        this.exporting.set(false);
        this.lastExportTime.set(new Date().toLocaleString('en-IN'));
        this.exportStatus.set('Backup exported successfully');
        this.notifications.success('Backup exported successfully');
      },
      error: () => {
        this.notifications.error('Failed to export backup');
        this.exportStatus.set('Export failed. Please try again.');
        this.exporting.set(false);
      },
    });
  }

  onImportFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.importFile = input.files?.[0] ?? null;
    this.importStatus.set('');
  }

  async importBackup(): Promise<void> {
    if (!this.importFile) { this.notifications.error('Please select a backup JSON file'); return; }
    const ok = await this.confirmService.confirm({
      title: 'Import Backup',
      message: 'This will overwrite existing data. Are you sure you want to proceed?',
      confirmText: 'Import',
      type: 'danger',
    });
    if (!ok) return;

    this.importing.set(true);
    this.importStatus.set('Reading backup file...');
    const reader = new FileReader();
    reader.onload = () => {
      try {
        this.importStatus.set('Parsing JSON data...');
        const data = JSON.parse(reader.result as string);
        this.importStatus.set('Uploading to server...');
        this.api.post<unknown>('/backup/import', data).subscribe({
          next: () => {
            this.importFile = null; this.importing.set(false);
            this.importStatus.set('Backup imported successfully');
            this.notifications.success('Backup imported successfully');
          },
          error: () => {
            this.notifications.error('Failed to import backup');
            this.importStatus.set('Import failed. Please check the file and try again.');
            this.importing.set(false);
          },
        });
      } catch {
        this.notifications.error('Invalid JSON file');
        this.importStatus.set('Invalid JSON format');
        this.importing.set(false);
      }
    };
    reader.onerror = () => {
      this.notifications.error('Failed to read file');
      this.importStatus.set('Failed to read file');
      this.importing.set(false);
    };
    reader.readAsText(this.importFile);
  }
}
