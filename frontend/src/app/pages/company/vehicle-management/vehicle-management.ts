import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { NotificationService } from '../../../core/services/notification.service';
import { ExportService } from '../../../core/services/export.service';
import { ConfirmDialogService } from '../../../core/services/confirm-dialog.service';
import { SearchableDropdownComponent, DropdownItem } from '../../../shared/searchable-dropdown/searchable-dropdown.component';
import { SummaryCardsComponent, SummaryCard } from '../../../shared/summary-cards/summary-cards.component';
import { ModalDialogComponent } from '../../../shared/modal-dialog/modal-dialog.component';

@Component({
  selector: 'app-vehicle-management',
  standalone: true,
  imports: [FormsModule, SearchableDropdownComponent, SummaryCardsComponent, ModalDialogComponent],
  templateUrl: './vehicle-management.html',
  styleUrl: './vehicle-management.scss',
})
export class VehicleManagementComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly notify = inject(NotificationService);
  private readonly exportService = inject(ExportService);
  private readonly confirmDialog = inject(ConfirmDialogService);

  vehicleNo = signal('');
  vehicleType = signal('');
  owner = signal('');
  driver = signal('');
  fuelType = signal('');
  insuranceExpiry = signal('');
  assignedSiteId = signal('');
  statusFilter = signal('');
  searchQuery = signal('');
  editingId = signal<string | null>(null);

  vehicles = signal<any[]>([]);
  sites = signal<any[]>([]);
  loading = signal(false);
  saving = signal(false);

  siteItems = computed<DropdownItem[]>(() =>
    [{ value: '', label: 'No Site' }, ...this.sites().map(s => ({ value: s.id, label: s.name }))]
  );

  // Service logs
  serviceModalOpen = signal(false);
  serviceHistoryModalOpen = signal(false);
  selectedVehicleId = signal<string | null>(null);
  selectedVehicle = computed(() => this.vehicles().find(v => v.id === this.selectedVehicleId()) ?? null);
  serviceLogs = signal<any[]>([]);
  serviceLogsLoading = signal(false);

  serviceDate = signal('');
  serviceType = signal('');
  serviceCost = signal<number | null>(null);
  serviceOdometer = signal<number | null>(null);
  serviceBank = signal('');
  serviceNextDue = signal('');
  serviceRemarks = signal('');
  bankOptions = signal<any[]>([]);

  vehicleTypes = ['Truck', 'Pickup', 'Tipper', 'Trailer', 'Car', 'JCB', 'Crane', 'Mixer', 'Other'];
  fuelTypes = ['Diesel', 'Petrol', 'CNG', 'Electric'];

  filteredVehicles = computed(() => {
    let list = this.vehicles();
    const st = this.statusFilter();
    const q = this.searchQuery().toLowerCase();
    if (st) list = list.filter(v => v.status === st);
    if (q) list = list.filter(v =>
      (v.vehicle_number ?? '').toLowerCase().includes(q) ||
      (v.owner_name ?? '').toLowerCase().includes(q) ||
      (v.driver_name ?? '').toLowerCase().includes(q)
    );
    return list;
  });

  summaryCards = computed<SummaryCard[]>(() => {
    const all = this.vehicles();
    const dueServices = all.filter(v => {
      if (!v.next_service_date) return false;
      return new Date(v.next_service_date) <= new Date();
    }).length;
    return [
      { title: 'Total Vehicles', value: all.length, icon: 'ri-truck-line', color: 'primary' },
      { title: 'Active', value: all.filter(v => v.status === 'active' || !v.status).length, icon: 'ri-checkbox-circle-line', color: 'success' },
      { title: 'Maintenance', value: all.filter(v => v.status === 'maintenance').length, icon: 'ri-tools-line', color: 'warning' },
      { title: 'Services Due', value: dueServices, icon: 'ri-alarm-warning-line', color: dueServices > 0 ? 'danger' : 'info' },
    ];
  });

  serviceDueVehicles = computed(() =>
    this.vehicles().filter(v => {
      if (!v.next_service_date) return false;
      const days = Math.ceil((new Date(v.next_service_date).getTime() - Date.now()) / 86400000);
      return days <= 7;
    }).map(v => ({
      ...v,
      daysUntilService: Math.ceil((new Date(v.next_service_date).getTime() - Date.now()) / 86400000),
    }))
  );

  totalServiceExpense = computed(() =>
    this.serviceLogs().reduce((s, l) => s + (l.cost ?? 0), 0)
  );

  ngOnInit(): void {
    this.loadVehicles();
    this.loadSites();
    this.loadBanks();
  }

  loadVehicles(): void {
    this.loading.set(true);
    this.api.get<any[]>('/vehicles').subscribe({
      next: (data) => { this.vehicles.set(data); this.loading.set(false); },
      error: (err) => { this.notify.error('Failed to load vehicles: ' + err.message); this.loading.set(false); },
    });
  }

  loadSites(): void {
    this.api.get<any[]>('/sites').subscribe({
      next: (data) => this.sites.set(data),
      error: () => {},
    });
  }

  loadBanks(): void {
    this.api.get<any[]>('/banks').subscribe({
      next: (data) => this.bankOptions.set(data),
      error: () => {},
    });
  }

  saveVehicle(): void {
    if (!this.vehicleNo() || !this.vehicleType()) return;
    this.saving.set(true);
    const body = {
      vehicle_number: this.vehicleNo(),
      vehicle_type: this.vehicleType(),
      owner_name: this.owner(),
      driver_name: this.driver(),
      fuel_type: this.fuelType(),
      insurance_expiry: this.insuranceExpiry() || null,
      assigned_site_id: this.assignedSiteId() || null,
    };
    const id = this.editingId();
    const request = id
      ? this.api.put<any>(`/vehicles/${id}`, body)
      : this.api.post<any>('/vehicles', body);

    request.subscribe({
      next: (result) => {
        if (id) {
          this.vehicles.update(list => list.map(v => v.id === id ? { ...v, ...result } : v));
          this.notify.success('Vehicle updated');
        } else {
          this.vehicles.update(list => [result, ...list]);
          this.notify.success('Vehicle added');
        }
        this.resetForm();
        this.saving.set(false);
      },
      error: (err) => { this.notify.error('Failed to save: ' + err.message); this.saving.set(false); },
    });
  }

  editVehicle(v: any): void {
    this.editingId.set(v.id);
    this.vehicleNo.set(v.vehicle_number ?? '');
    this.vehicleType.set(v.vehicle_type ?? '');
    this.owner.set(v.owner_name ?? '');
    this.driver.set(v.driver_name ?? '');
    this.fuelType.set(v.fuel_type ?? '');
    this.insuranceExpiry.set(v.insurance_expiry ?? '');
    this.assignedSiteId.set(v.assigned_site_id ?? '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  cancelEdit(): void { this.resetForm(); }

  async deleteVehicle(v: any): Promise<void> {
    const confirmed = await this.confirmDialog.confirm({
      title: 'Delete Vehicle',
      message: `Delete vehicle "${v.vehicle_number}"?`,
      type: 'danger',
      confirmText: 'Delete',
    });
    if (!confirmed) return;

    this.api.delete<any>(`/vehicles/${v.id}`).subscribe({
      next: () => {
        this.vehicles.update(list => list.filter(ve => ve.id !== v.id));
        this.notify.success('Vehicle deleted');
      },
      error: (err) => this.notify.error('Failed to delete: ' + err.message),
    });
  }

  openServiceLog(vehicleId: string): void {
    this.selectedVehicleId.set(vehicleId);
    this.serviceModalOpen.set(true);
    this.resetServiceForm();
  }

  openServiceHistory(vehicleId: string): void {
    this.selectedVehicleId.set(vehicleId);
    this.serviceHistoryModalOpen.set(true);
    this.loadServiceLogs(vehicleId);
  }

  loadServiceLogs(vehicleId: string): void {
    this.serviceLogsLoading.set(true);
    this.api.get<any[]>(`/vehicles/${vehicleId}/service-logs`).subscribe({
      next: (data) => { this.serviceLogs.set(data); this.serviceLogsLoading.set(false); },
      error: (err) => { this.notify.error('Failed to load service logs: ' + err.message); this.serviceLogsLoading.set(false); },
    });
  }

  addServiceLog(): void {
    const vehicleId = this.selectedVehicleId();
    if (!vehicleId || !this.serviceType()) return;
    const body = {
      service_date: this.serviceDate() || new Date().toISOString().split('T')[0],
      service_type: this.serviceType(),
      cost: this.serviceCost() ?? 0,
      odometer_reading: this.serviceOdometer(),
      serviced_by: this.serviceBank(),
      next_service_date: this.serviceNextDue() || null,
      remarks: this.serviceRemarks(),
    };
    this.api.post<any>(`/vehicles/${vehicleId}/service-logs`, body).subscribe({
      next: (created) => {
        this.serviceLogs.update(list => [...list, created]);
        this.notify.success('Service log added');
        this.resetServiceForm();
        this.serviceModalOpen.set(false);
        if (body.next_service_date) {
          this.vehicles.update(list => list.map(v =>
            v.id === vehicleId ? { ...v, next_service_date: body.next_service_date } : v
          ));
        }
      },
      error: (err) => this.notify.error('Failed to add service log: ' + err.message),
    });
  }

  closeServiceModal(): void {
    this.serviceModalOpen.set(false);
  }

  closeServiceHistory(): void {
    this.serviceHistoryModalOpen.set(false);
    this.serviceLogs.set([]);
  }

  siteName(siteId: string): string {
    return this.sites().find(s => s.id === siteId)?.name ?? '—';
  }

  exportExcel(): void {
    this.exportService.exportToExcel(
      this.filteredVehicles().map(v => ({
        'Vehicle No': v.vehicle_number,
        Type: v.vehicle_type,
        Owner: v.owner_name,
        Driver: v.driver_name,
        Fuel: v.fuel_type,
        Site: v.assigned_site_id ? this.siteName(v.assigned_site_id) : '',
        'Insurance Expiry': v.insurance_expiry,
        Status: v.status,
      })),
      'vehicles'
    );
  }

  private resetForm(): void {
    this.editingId.set(null);
    this.vehicleNo.set('');
    this.vehicleType.set('');
    this.owner.set('');
    this.driver.set('');
    this.fuelType.set('');
    this.insuranceExpiry.set('');
    this.assignedSiteId.set('');
  }

  private resetServiceForm(): void {
    this.serviceDate.set('');
    this.serviceType.set('');
    this.serviceCost.set(null);
    this.serviceOdometer.set(null);
    this.serviceBank.set('');
    this.serviceNextDue.set('');
    this.serviceRemarks.set('');
  }
}
