'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api-client';
import { useNotification } from '@/contexts/NotificationContext';
import { useConfirmDialog } from '@/contexts/ConfirmDialogContext';
import { exportToExcel } from '@/lib/export-utils';
import SearchableDropdown from '@/components/SearchableDropdown';
import ModalDialog from '@/components/ModalDialog';
import SummaryCards from '@/components/SummaryCards';
import styles from './VehicleManagementPage.module.scss';

const VEHICLE_TYPES = ['Truck', 'Pickup', 'Tipper', 'Trailer', 'Car', 'JCB', 'Crane', 'Mixer', 'Other'];
const FUEL_TYPES = ['Diesel', 'Petrol', 'CNG', 'Electric'];
const SERVICE_TYPES = ['Oil Change', 'Tyre Replacement', 'Brake Service', 'Engine Repair', 'Battery Replacement', 'General Service', 'Painting', 'Accident Repair', 'Other'];
const STATUS_OPTIONS = ['all', 'active', 'inactive', 'maintenance'];

export default function VehicleManagementPage() {
  const { success, error: notifyError } = useNotification();
  const { confirm } = useConfirmDialog();

  const [vehicles, setVehicles] = useState<any[]>([]);
  const [sites, setSites] = useState<any[]>([]);
  const [banks, setBanks] = useState<any[]>([]);

  const [vehicleNumber, setVehicleNumber] = useState('');
  const [vehicleType, setVehicleType] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [driverName, setDriverName] = useState('');
  const [fuelType, setFuelType] = useState('');
  const [insuranceExpiry, setInsuranceExpiry] = useState('');
  const [assignedSiteId, setAssignedSiteId] = useState('');
  const [vehicleStatus, setVehicleStatus] = useState('active');

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const [serviceModalOpen, setServiceModalOpen] = useState(false);
  const [serviceVehicle, setServiceVehicle] = useState<any>(null);
  const [serviceDate, setServiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [serviceType, setServiceType] = useState('');
  const [serviceCost, setServiceCost] = useState('');
  const [serviceOdometer, setServiceOdometer] = useState('');
  const [serviceBankId, setServiceBankId] = useState('');
  const [serviceNextDate, setServiceNextDate] = useState('');
  const [serviceRemarks, setServiceRemarks] = useState('');
  const [serviceSaving, setServiceSaving] = useState(false);

  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [historyVehicle, setHistoryVehicle] = useState<any>(null);
  const [serviceHistory, setServiceHistory] = useState<any[]>([]);

  const [serviceDueAlerts, setServiceDueAlerts] = useState<any[]>([]);

  const loadMasters = useCallback(async () => {
    try {
      const [s, b] = await Promise.all([
        apiGet<any[]>('/sites'),
        apiGet<any[]>('/banks'),
      ]);
      setSites(s);
      setBanks(b);
    } catch (err: any) {
      notifyError('Failed to load masters: ' + err.message);
    }
  }, [notifyError]);

  const loadVehicles = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet<any[]>('/vehicles');
      setVehicles(data);
      const now = new Date();
      const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      const alerts = data.filter(v => v.next_service_date && new Date(v.next_service_date) <= weekFromNow);
      setServiceDueAlerts(alerts);
    } catch (err: any) {
      notifyError('Failed to load vehicles: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [notifyError]);

  useEffect(() => { loadMasters(); loadVehicles(); }, [loadMasters, loadVehicles]);

  const siteItems = useMemo(() => sites.map(s => ({ value: s.id, label: s.name })), [sites]);
  const bankItems = useMemo(() => banks.map(b => ({ value: b.id, label: `${b.bank_name} - ${b.account_number}` })), [banks]);

  const filteredVehicles = useMemo(() => {
    let result = vehicles;
    if (statusFilter !== 'all') result = result.filter(v => v.status === statusFilter);
    const q = searchQuery.toLowerCase();
    if (q) result = result.filter(v =>
      (v.vehicle_number ?? '').toLowerCase().includes(q) ||
      (v.owner_name ?? '').toLowerCase().includes(q) ||
      (v.driver_name ?? '').toLowerCase().includes(q)
    );
    return result;
  }, [vehicles, statusFilter, searchQuery]);

  const summaryCards = useMemo(() => [
    { title: 'Total Vehicles', value: vehicles.length, icon: 'ri-truck-line', color: 'primary' as const },
    { title: 'Active', value: vehicles.filter(v => v.status === 'active').length, icon: 'ri-checkbox-circle-line', color: 'success' as const },
    { title: 'Maintenance', value: vehicles.filter(v => v.status === 'maintenance').length, icon: 'ri-tools-line', color: 'warning' as const },
    { title: 'Services Due', value: serviceDueAlerts.length, icon: 'ri-alarm-warning-line', color: 'danger' as const },
  ], [vehicles, serviceDueAlerts]);

  const resetForm = useCallback(() => {
    setEditingId(null);
    setVehicleNumber('');
    setVehicleType('');
    setOwnerName('');
    setDriverName('');
    setFuelType('');
    setInsuranceExpiry('');
    setAssignedSiteId('');
    setVehicleStatus('active');
  }, []);

  const saveVehicle = useCallback(async () => {
    if (!vehicleNumber || !vehicleType) return;
    setSaving(true);
    const body = {
      vehicle_number: vehicleNumber.toUpperCase(),
      vehicle_type: vehicleType,
      owner_name: ownerName,
      driver_name: driverName,
      fuel_type: fuelType,
      insurance_expiry: insuranceExpiry || null,
      assigned_site_id: assignedSiteId || null,
      status: vehicleStatus,
    };
    try {
      if (editingId) {
        await apiPut(`/vehicles/${editingId}`, body);
        success('Vehicle updated');
      } else {
        await apiPost('/vehicles', body);
        success('Vehicle added');
      }
      resetForm();
      loadVehicles();
    } catch (err: any) {
      notifyError('Failed to save vehicle: ' + err.message);
    } finally {
      setSaving(false);
    }
  }, [vehicleNumber, vehicleType, ownerName, driverName, fuelType, insuranceExpiry, assignedSiteId, vehicleStatus, editingId, success, notifyError, resetForm, loadVehicles]);

  const editVehicle = useCallback((v: any) => {
    setEditingId(v.id);
    setVehicleNumber(v.vehicle_number ?? '');
    setVehicleType(v.vehicle_type ?? '');
    setOwnerName(v.owner_name ?? '');
    setDriverName(v.driver_name ?? '');
    setFuelType(v.fuel_type ?? '');
    setInsuranceExpiry(v.insurance_expiry?.split('T')[0] ?? '');
    setAssignedSiteId(v.assigned_site_id ?? '');
    setVehicleStatus(v.status ?? 'active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const deleteVehicle = useCallback(async (v: any) => {
    const ok = await confirm({ title: 'Delete Vehicle', message: `Delete vehicle "${v.vehicle_number}"?`, type: 'danger', confirmText: 'Delete' });
    if (!ok) return;
    try {
      await apiDelete(`/vehicles/${v.id}`);
      success('Vehicle deleted');
      loadVehicles();
    } catch (err: any) {
      notifyError('Delete failed: ' + err.message);
    }
  }, [confirm, success, notifyError, loadVehicles]);

  const openServiceLog = (vehicle: any) => {
    setServiceVehicle(vehicle);
    setServiceDate(new Date().toISOString().split('T')[0]);
    setServiceType('');
    setServiceCost('');
    setServiceOdometer('');
    setServiceBankId('');
    setServiceNextDate('');
    setServiceRemarks('');
    setServiceModalOpen(true);
  };

  const saveServiceLog = useCallback(async () => {
    if (!serviceVehicle || !serviceType || !serviceCost) return;
    setServiceSaving(true);
    try {
      await apiPost(`/vehicles/${serviceVehicle.id}/service-logs`, {
        service_date: serviceDate,
        service_type: serviceType,
        cost: parseFloat(serviceCost),
        odometer_reading: serviceOdometer ? parseInt(serviceOdometer) : null,
        bank_id: serviceBankId || null,
        next_service_date: serviceNextDate || null,
        remarks: serviceRemarks,
      });
      success('Service log added');
      setServiceModalOpen(false);
      loadVehicles();
    } catch (err: any) {
      notifyError('Failed to save service log: ' + err.message);
    } finally {
      setServiceSaving(false);
    }
  }, [serviceVehicle, serviceDate, serviceType, serviceCost, serviceOdometer, serviceBankId, serviceNextDate, serviceRemarks, success, notifyError, loadVehicles]);

  const showServiceHistory = useCallback(async (vehicle: any) => {
    setHistoryVehicle(vehicle);
    setHistoryModalOpen(true);
    try {
      const data = await apiGet<any[]>(`/vehicles/${vehicle.id}/service-logs`);
      setServiceHistory(data);
    } catch { setServiceHistory([]); }
  }, []);

  const getSiteName = (id: string) => sites.find(s => s.id === id)?.name ?? '--';

  const getStatusClass = (st: string) => {
    switch (st) {
      case 'active': return styles.active;
      case 'inactive': return styles.inactive;
      case 'maintenance': return styles.maintenance;
      default: return '';
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1><i className="ri-truck-line"></i> Vehicle Management</h1>
        <button className="btn-export" onClick={() => exportToExcel(filteredVehicles.map(v => ({
          'Vehicle No': v.vehicle_number, Type: v.vehicle_type, Owner: v.owner_name, Driver: v.driver_name,
          Fuel: v.fuel_type, Insurance: v.insurance_expiry?.split('T')[0], Status: v.status,
        })), 'vehicles')}>
          <i className="ri-file-excel-2-line"></i> Export Excel
        </button>
      </div>

      <SummaryCards cards={summaryCards} />

      {serviceDueAlerts.length > 0 && (
        <div className={styles.alertBanner}>
          <i className="ri-alarm-warning-line" style={{ fontSize: 20 }}></i>
          <span>{serviceDueAlerts.length} vehicle{serviceDueAlerts.length > 1 ? 's' : ''} due for service within 7 days</span>
        </div>
      )}

      <div className="card-container" style={{ marginTop: 20 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, color: 'var(--accent)' }}>
          {editingId ? 'Edit Vehicle' : 'Add New Vehicle'}
        </h3>
        <form onSubmit={e => { e.preventDefault(); saveVehicle(); }}>
          <div className="form-grid">
            <div className="form-group">
              <label>Vehicle Number <span style={{ color: 'var(--danger)' }}>*</span></label>
              <input type="text" value={vehicleNumber} onChange={e => setVehicleNumber(e.target.value)} placeholder="e.g. MH12AB1234" style={{ textTransform: 'uppercase' }} required />
            </div>
            <div className="form-group">
              <label>Vehicle Type <span style={{ color: 'var(--danger)' }}>*</span></label>
              <select value={vehicleType} onChange={e => setVehicleType(e.target.value)} required>
                <option value="">-- Select Type --</option>
                {VEHICLE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Owner Name</label>
              <input type="text" value={ownerName} onChange={e => setOwnerName(e.target.value)} placeholder="Owner name" />
            </div>
            <div className="form-group">
              <label>Driver Name</label>
              <input type="text" value={driverName} onChange={e => setDriverName(e.target.value)} placeholder="Driver name" />
            </div>
            <div className="form-group">
              <label>Fuel Type</label>
              <select value={fuelType} onChange={e => setFuelType(e.target.value)}>
                <option value="">-- Select --</option>
                {FUEL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Insurance Expiry</label>
              <input type="date" value={insuranceExpiry} onChange={e => setInsuranceExpiry(e.target.value)} />
            </div>
            <div className="form-group">
              <SearchableDropdown items={siteItems} label="Assigned Site" placeholder="Select Site..." value={assignedSiteId} onChange={setAssignedSiteId} />
            </div>
            <div className="form-group">
              <label>Status</label>
              <select value={vehicleStatus} onChange={e => setVehicleStatus(e.target.value)}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="maintenance">Maintenance</option>
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
            <button type="submit" className="btn-primary" disabled={saving || !vehicleNumber || !vehicleType}>
              <i className={editingId ? 'ri-save-line' : 'ri-add-line'}></i>
              {editingId ? 'Update Vehicle' : 'Add Vehicle'}
            </button>
            {editingId && <button type="button" className="btn-secondary" onClick={resetForm}>Cancel</button>}
          </div>
        </form>
      </div>

      <div className="card-container" style={{ marginTop: 20 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div className={styles.statusFilter}>
            {STATUS_OPTIONS.map(s => (
              <button key={s} className={`${styles.filterBtn} ${statusFilter === s ? styles.filterBtnActive : ''}`} onClick={() => setStatusFilter(s)}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
          <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search vehicle number, owner, driver..." style={{ flex: 1, minWidth: 200 }} />
        </div>
      </div>

      <div className="table-responsive" style={{ marginTop: 20 }}>
        {loading ? (
          <div className="empty-state"><div className="skeleton" style={{ height: 200 }}></div></div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Vehicle No</th>
                <th>Type</th>
                <th>Owner</th>
                <th>Driver</th>
                <th>Fuel</th>
                <th>Site</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredVehicles.length === 0 ? (
                <tr><td colSpan={8} className="empty-state">No vehicles found.</td></tr>
              ) : filteredVehicles.map(v => (
                <tr key={v.id}>
                  <td style={{ fontWeight: 700, fontFamily: 'monospace' }}>{v.vehicle_number}</td>
                  <td><span className="badge badge-info">{v.vehicle_type}</span></td>
                  <td>{v.owner_name ?? '--'}</td>
                  <td>{v.driver_name ?? '--'}</td>
                  <td>{v.fuel_type ?? '--'}</td>
                  <td>{getSiteName(v.assigned_site_id)}</td>
                  <td><span className={`${styles.statusBadge} ${getStatusClass(v.status)}`}>{v.status}</span></td>
                  <td>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <button className="btn-success" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => openServiceLog(v)} title="Add Service"><i className="ri-tools-line"></i></button>
                      <button className="btn-secondary" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => showServiceHistory(v)} title="Service History"><i className="ri-history-line"></i></button>
                      <button className="btn-primary" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => editVehicle(v)} title="Edit"><i className="ri-pencil-line"></i></button>
                      <button className="btn-danger" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => deleteVehicle(v)} title="Delete"><i className="ri-delete-bin-line"></i></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Service Log Modal */}
      <ModalDialog isOpen={serviceModalOpen} title={`Add Service — ${serviceVehicle?.vehicle_number ?? ''}`} onClose={() => setServiceModalOpen(false)}>
        <form onSubmit={e => { e.preventDefault(); saveServiceLog(); }}>
          <div className="form-group">
            <label>Service Date</label>
            <input type="date" value={serviceDate} onChange={e => setServiceDate(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Service Type <span style={{ color: 'var(--danger)' }}>*</span></label>
            <select value={serviceType} onChange={e => setServiceType(e.target.value)} required>
              <option value="">-- Select --</option>
              {SERVICE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Cost <span style={{ color: 'var(--danger)' }}>*</span></label>
            <input type="number" value={serviceCost} onChange={e => setServiceCost(e.target.value)} placeholder="0.00" min="0" step="0.01" required />
          </div>
          <div className="form-group">
            <label>Odometer Reading</label>
            <input type="number" value={serviceOdometer} onChange={e => setServiceOdometer(e.target.value)} placeholder="km" min="0" />
          </div>
          <div className="form-group">
            <SearchableDropdown items={bankItems} label="Bank (for payment)" placeholder="Select Bank..." value={serviceBankId} onChange={setServiceBankId} />
          </div>
          <div className="form-group">
            <label>Next Service Date</label>
            <input type="date" value={serviceNextDate} onChange={e => setServiceNextDate(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Remarks</label>
            <textarea value={serviceRemarks} onChange={e => setServiceRemarks(e.target.value)} rows={2} placeholder="Optional remarks" />
          </div>
          <div className="modal-footer">
            <button type="submit" className="btn-primary" disabled={serviceSaving || !serviceType || !serviceCost}>
              <i className="ri-check-line"></i> {serviceSaving ? 'Saving...' : 'Save Service Log'}
            </button>
            <button type="button" className="btn-secondary" onClick={() => setServiceModalOpen(false)}>Cancel</button>
          </div>
        </form>
      </ModalDialog>

      {/* Service History Modal */}
      <ModalDialog isOpen={historyModalOpen} title={`Service History — ${historyVehicle?.vehicle_number ?? ''}`} size="lg" onClose={() => setHistoryModalOpen(false)}>
        <table>
          <thead>
            <tr><th>Date</th><th>Type</th><th>Cost</th><th>Odometer</th><th>Remarks</th></tr>
          </thead>
          <tbody>
            {serviceHistory.length === 0 ? (
              <tr><td colSpan={5} className="empty-state">No service records found.</td></tr>
            ) : serviceHistory.map(s => (
              <tr key={s.id}>
                <td>{s.service_date?.split('T')[0]}</td>
                <td>{s.service_type}</td>
                <td style={{ fontWeight: 700 }}>₹{(s.cost ?? 0).toLocaleString('en-IN')}</td>
                <td>{s.odometer_reading ? `${s.odometer_reading.toLocaleString()} km` : '--'}</td>
                <td>{s.remarks ?? '--'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {serviceHistory.length > 0 && (
          <div className={styles.serviceTotal}>
            Total Service Expense: ₹{serviceHistory.reduce((s, e) => s + (e.cost ?? 0), 0).toLocaleString('en-IN')}
          </div>
        )}
      </ModalDialog>
    </div>
  );
}
