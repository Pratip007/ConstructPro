import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { NotificationService } from '../../../core/services/notification.service';
import { ConfirmDialogService } from '../../../core/services/confirm-dialog.service';
import { SummaryCardsComponent, SummaryCard } from '../../../shared/summary-cards/summary-cards.component';
import { ModalDialogComponent } from '../../../shared/modal-dialog/modal-dialog.component';
import { SearchableDropdownComponent } from '../../../shared/searchable-dropdown/searchable-dropdown.component';

interface Folder {
  id: string;
  name: string;
  site_id?: string;
}

interface DocItem {
  id: string;
  name: string;
  folder_id: string;
  file_type?: string;
  file_size?: number;
  description?: string;
  created_at?: string;
  download_url?: string;
}

interface Site { id: string; name: string; }

@Component({
  selector: 'app-create-doc-list',
  standalone: true,
  imports: [FormsModule, SummaryCardsComponent, ModalDialogComponent, SearchableDropdownComponent],
  templateUrl: './create-doc-list.html',
  styleUrl: './create-doc-list.scss',
})
export class CreateDocListComponent implements OnInit {
  private api = inject(ApiService);
  private notifications = inject(NotificationService);
  private confirmService = inject(ConfirmDialogService);

  sites = signal<Site[]>([]);
  siteFilter = signal('');

  folders = signal<Folder[]>([]);
  foldersLoading = signal(false);
  selectedFolder = signal<Folder | null>(null);
  newFolderName = signal('');
  newFolderSiteId = signal('');

  documents = signal<DocItem[]>([]);
  docsLoading = signal(false);
  searchQuery = signal('');

  newDocName = signal('');
  newDocDescription = signal('');
  selectedFile: File | null = null;
  uploading = signal(false);

  showPreviewModal = signal(false);
  previewUrl = signal('');
  previewType = signal('');
  previewName = signal('');

  get siteItems() { return this.sites().map(s => ({ value: s.id, label: s.name })); }

  get summaryCards(): SummaryCard[] {
    return [
      { title: 'Folders', value: this.folders().length, icon: 'ri-folder-line', color: 'primary' },
      { title: 'Documents', value: this.documents().length, icon: 'ri-file-text-line', color: 'info' },
      { title: 'Total Size', value: this.totalSizeLabel, icon: 'ri-hard-drive-line', color: 'warning' },
    ];
  }

  get totalSizeLabel(): string {
    const bytes = this.documents().reduce((s, d) => s + (d.file_size ?? 0), 0);
    return this.formatSize(bytes);
  }

  get filteredDocuments(): DocItem[] {
    const q = this.searchQuery().toLowerCase();
    if (!q) return this.documents();
    return this.documents().filter(d => d.name.toLowerCase().includes(q) || (d.description ?? '').toLowerCase().includes(q));
  }

  ngOnInit(): void {
    this.loadSites();
    this.loadFolders();
  }

  loadSites(): void {
    this.api.get<Site[]>('/sites').subscribe({
      next: res => this.sites.set(Array.isArray(res) ? res : []),
      error: () => {},
    });
  }

  loadFolders(): void {
    this.foldersLoading.set(true);
    const params: Record<string, string> = {};
    if (this.siteFilter()) params['site_id'] = this.siteFilter();
    this.api.get<Folder[]>('/document-folders', params).subscribe({
      next: res => { this.folders.set(Array.isArray(res) ? res : []); this.foldersLoading.set(false); },
      error: () => { this.notifications.error('Failed to load folders'); this.foldersLoading.set(false); },
    });
  }

  onSiteFilterChange(siteId: string): void {
    this.siteFilter.set(siteId);
    this.selectedFolder.set(null);
    this.documents.set([]);
    this.loadFolders();
  }

  createFolder(): void {
    if (!this.newFolderName().trim()) { this.notifications.error('Folder name is required'); return; }
    const body: any = { name: this.newFolderName().trim() };
    const siteId = this.newFolderSiteId() || this.siteFilter();
    if (siteId) body['site_id'] = siteId;
    this.api.post<Folder>('/document-folders', body).subscribe({
      next: folder => {
        this.folders.update(list => [...list, folder]);
        this.newFolderName.set('');
        this.newFolderSiteId.set('');
        this.notifications.success('Folder created');
      },
      error: () => this.notifications.error('Failed to create folder'),
    });
  }

  async deleteFolder(folder: Folder): Promise<void> {
    const ok = await this.confirmService.confirm({
      title: 'Delete Folder', message: `Delete folder "${folder.name}" and all its documents?`, confirmText: 'Delete', type: 'danger',
    });
    if (!ok) return;
    this.api.delete<void>(`/document-folders/${folder.id}`).subscribe({
      next: () => {
        this.folders.update(list => list.filter(f => f.id !== folder.id));
        if (this.selectedFolder()?.id === folder.id) { this.selectedFolder.set(null); this.documents.set([]); }
        this.notifications.success('Folder deleted');
      },
      error: () => this.notifications.error('Failed to delete folder'),
    });
  }

  selectFolder(folder: Folder): void {
    this.selectedFolder.set(folder);
    this.loadDocuments(folder.id);
  }

  loadDocuments(folderId: string): void {
    this.docsLoading.set(true);
    this.api.get<DocItem[]>('/documents', { folder_id: folderId }).subscribe({
      next: res => { this.documents.set(Array.isArray(res) ? res : []); this.docsLoading.set(false); },
      error: () => { this.notifications.error('Failed to load documents'); this.docsLoading.set(false); },
    });
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.selectedFile = input.files?.[0] ?? null;
  }

  uploadDocument(): void {
    const folder = this.selectedFolder();
    if (!folder) { this.notifications.error('Please select a folder first'); return; }
    if (!this.selectedFile) { this.notifications.error('Please choose a file to upload'); return; }
    if (!this.newDocName().trim()) { this.notifications.error('Document name is required'); return; }
    this.uploading.set(true);
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      const body: any = {
        name: this.newDocName().trim(), folder_id: folder.id, file_data: base64,
        file_type: this.selectedFile!.type, file_size: this.selectedFile!.size,
      };
      if (this.newDocDescription().trim()) body['description'] = this.newDocDescription().trim();
      if (folder.site_id) body['site_id'] = folder.site_id;
      this.api.post<DocItem>('/documents', body).subscribe({
        next: doc => {
          this.documents.update(list => [...list, doc]);
          this.newDocName.set(''); this.newDocDescription.set(''); this.selectedFile = null;
          this.uploading.set(false);
          this.notifications.success('Document uploaded');
        },
        error: () => { this.notifications.error('Failed to upload document'); this.uploading.set(false); },
      });
    };
    reader.onerror = () => { this.notifications.error('Failed to read file'); this.uploading.set(false); };
    reader.readAsDataURL(this.selectedFile);
  }

  previewDocument(doc: DocItem): void {
    this.api.get<{ url: string }>(`/documents/${doc.id}/download`).subscribe({
      next: res => {
        if (res?.url) {
          this.previewUrl.set(res.url);
          this.previewType.set(doc.file_type ?? '');
          this.previewName.set(doc.name);
          this.showPreviewModal.set(true);
        }
      },
      error: () => this.notifications.error('Failed to get preview'),
    });
  }

  downloadDocument(doc: DocItem): void {
    this.api.get<{ url: string }>(`/documents/${doc.id}/download`).subscribe({
      next: res => { if (res?.url) window.open(res.url, '_blank'); else this.notifications.error('No download URL'); },
      error: () => this.notifications.error('Failed to get download link'),
    });
  }

  async deleteDocument(doc: DocItem): Promise<void> {
    const ok = await this.confirmService.confirm({ title: 'Delete Document', message: `Delete "${doc.name}"?`, confirmText: 'Delete', type: 'danger' });
    if (!ok) return;
    this.api.delete<void>(`/documents/${doc.id}`).subscribe({
      next: () => { this.documents.update(list => list.filter(d => d.id !== doc.id)); this.notifications.success('Document deleted'); },
      error: () => this.notifications.error('Failed to delete document'),
    });
  }

  isImageType(type: string): boolean {
    return type.startsWith('image/');
  }

  isPdfType(type: string): boolean {
    return type === 'application/pdf';
  }

  fileIcon(type?: string): string {
    if (!type) return 'ri-file-line';
    if (type.startsWith('image/')) return 'ri-image-line';
    if (type === 'application/pdf') return 'ri-file-pdf-line';
    if (type.includes('spreadsheet') || type.includes('excel')) return 'ri-file-excel-line';
    if (type.includes('word') || type.includes('document')) return 'ri-file-word-line';
    return 'ri-file-line';
  }

  formatSize(bytes?: number): string {
    if (!bytes) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
}
