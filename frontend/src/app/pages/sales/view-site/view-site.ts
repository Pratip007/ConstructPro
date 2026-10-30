import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TitleCasePipe, DecimalPipe } from '@angular/common';
import { ApiService } from '../../../core/services/api.service';
import { NotificationService } from '../../../core/services/notification.service';
import { ExportService } from '../../../core/services/export.service';
import { SummaryCardsComponent, SummaryCard } from '../../../shared/summary-cards/summary-cards.component';
import { SearchableDropdownComponent } from '../../../shared/searchable-dropdown/searchable-dropdown.component';
import { ConfirmDialogService } from '../../../core/services/confirm-dialog.service';

@Component({
  selector: 'app-view-site',
  standalone: true,
  imports: [FormsModule, TitleCasePipe, DecimalPipe, SummaryCardsComponent, SearchableDropdownComponent],
  templateUrl: './view-site.html',
  styleUrl: './view-site.scss',
})
export class ViewSiteComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly notify = inject(NotificationService);
  private readonly exportService = inject(ExportService);
  private readonly confirmService = inject(ConfirmDialogService);

  filterSite = signal('');
  filterStatus = signal('');

  siteName = signal('');
  siteCompanyId = signal<number | ''>('');
  siteAddress = signal('');
  siteStatus = signal('active');

  sites = signal<any[]>([]);
  companies = signal<any[]>([]);
  loading = signal(false);
  saving = signal(false);
  showForm = signal(false);
  editingId = signal<number | null>(null);

  readonly statusOptions = ['active', 'upcoming', 'completed', 'inactive'];

  showLedger = signal(false);
  ledgerCompany = signal('');
  ledgerSite = signal('');
  ledgerData = signal<any>(null);
  ledgerLoading = signal(false);

  readonly ledgerSections = ['employee', 'mobilization', 'retailer', 'contractor'] as const;

  get companyItems() { return this.companies().map(c => ({ value: String(c.id), label: c.name })); }
  get siteItems() { return this.sites().map(s => ({ value: String(s.id), label: s.name })); }

  get summaryCards(): SummaryCard[] {
    const all = this.sites();
    const active = all.filter(s => s.status === 'active').length;
    const upcoming = all.filter(s => s.status === 'upcoming').length;
    const completed = all.filter(s => s.status === 'completed').length;
    return [
      { title: 'Total Sites', value: all.length, icon: 'ri-building-line', color: 'primary' },
      { title: 'Active', value: active, icon: 'ri-checkbox-circle-line', color: 'success' },
      { title: 'Upcoming', value: upcoming, icon: 'ri-time-line', color: 'warning' },
      { title: 'Completed', value: completed, icon: 'ri-flag-line', color: 'info' },
    ];
  }

  get companySites(): any[] {
    const compId = this.ledgerCompany();
    if (!compId) return this.sites();
    return this.sites().filter((s: any) => String(s.company_id) === String(compId));
  }

  toggleView(): void {
    this.showLedger.update(v => !v);
  }

  loadSiteLedger(): void {
    const siteId = this.ledgerSite();
    if (!siteId) { this.notify.error('Please select a site'); return; }
    this.ledgerLoading.set(true);
    this.ledgerData.set(null);
    this.api.get<any>('/reports/site-ledger', { site_id: siteId }).subscribe({
      next: data => { this.ledgerData.set(data); this.ledgerLoading.set(false); },
      error: err => { this.notify.error('Failed to load site ledger: ' + (err?.message ?? 'Unknown error')); this.ledgerLoading.set(false); },
    });
  }

  sectionTotal(section: string, field: string): number {
    const data = this.ledgerData();
    if (!data || !data[section]) return 0;
    return (data[section] as any[]).reduce((sum: number, row: any) => sum + (Number(row[field]) || 0), 0);
  }

  get grandTotal(): number {
    return this.ledgerSections.reduce((sum, sec) => sum + this.sectionTotal(sec, 'amount'), 0);
  }

  get filteredSites(): any[] {
    const q = this.filterSite().toLowerCase();
    const st = this.filterStatus();
    return this.sites().filter((s: any) => {
      const matchName = !q || (s.name ?? '').toLowerCase().includes(q);
      const matchStatus = !st || s.status === st;
      return matchName && matchStatus;
    });
  }

  ngOnInit(): void {
    this.loadSites();
    this.loadCompanies();
  }

  loadSites(): void {
    this.loading.set(true);
    this.api.get<any[]>('/sites').subscribe({
      next: data => { this.sites.set(data ?? []); this.loading.set(false); },
      error: err => { this.notify.error('Failed to load sites: ' + err.message); this.loading.set(false); },
    });
  }

  loadCompanies(): void {
    this.api.get<any[]>('/companies').subscribe({
      next: data => this.companies.set(data ?? []),
      error: () => {},
    });
  }

  openAddForm(): void {
    this.resetForm();
    this.showForm.set(true);
  }

  editSite(site: any): void {
    this.editingId.set(site.id);
    this.siteName.set(site.name ?? '');
    this.siteCompanyId.set(site.company_id ?? '');
    this.siteAddress.set(site.address ?? '');
    this.siteStatus.set(site.status ?? 'active');
    this.showForm.set(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  saveSite(): void {
    if (!this.siteName().trim()) { this.notify.error('Site name is required'); return; }
    this.saving.set(true);
    const body: any = { name: this.siteName().trim(), address: this.siteAddress().trim() || null, status: this.siteStatus() };
    if (this.siteCompanyId() !== '') body.company_id = Number(this.siteCompanyId());

    const id = this.editingId();
    const req = id ? this.api.put<any>(`/sites/${id}`, body) : this.api.post<any>('/sites', body);
    req.subscribe({
      next: result => {
        if (id) {
          this.sites.update(list => list.map(s => s.id === id ? { ...s, ...result } : s));
          this.notify.success('Site updated successfully');
        } else {
          this.sites.update(list => [result, ...list]);
          this.notify.success('Site added successfully');
        }
        this.resetForm();
        this.saving.set(false);
      },
      error: err => { this.notify.error(err?.error?.error ?? err?.message ?? 'Failed to save site'); this.saving.set(false); },
    });
  }

  async deactivateSite(site: any): Promise<void> {
    const ok = await this.confirmService.confirm({ title: 'Deactivate Site', message: `Deactivate site "${site.name}"?`, confirmText: 'Deactivate', type: 'danger' });
    if (!ok) return;
    this.api.delete<any>(`/sites/${site.id}`).subscribe({
      next: () => { this.sites.update(list => list.map(s => s.id === site.id ? { ...s, status: 'inactive' } : s)); this.notify.success('Site deactivated'); },
      error: err => this.notify.error(err?.error?.error ?? 'Failed to deactivate site'),
    });
  }

  cancelForm(): void { this.resetForm(); }

  private resetForm(): void {
    this.editingId.set(null); this.siteName.set(''); this.siteCompanyId.set('');
    this.siteAddress.set(''); this.siteStatus.set('active'); this.showForm.set(false);
  }

  statusBadgeClass(status: string): string {
    switch (status) {
      case 'active': return 'badge-success';
      case 'upcoming': return 'badge-warning';
      case 'completed': return 'badge-info';
      default: return 'badge-danger';
    }
  }

  companyName(companyId: number): string {
    return this.companies().find(c => c.id === companyId)?.name ?? '—';
  }

  exportSites(): void {
    this.exportService.exportToExcel(this.filteredSites as any[], 'sites', 'Site Management', [
      { key: 'display_id', header: 'ID' }, { key: 'name', header: 'Site Name' },
      { key: 'address', header: 'Address' }, { key: 'status', header: 'Status' },
    ]);
  }

  printLedger(): void {
    this.exportService.printReport('site-ledger-print', 'Site Ledger');
  }
}
