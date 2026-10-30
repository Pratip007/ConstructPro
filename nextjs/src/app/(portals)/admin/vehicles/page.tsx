'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api-client';
import { useNotification } from '@/contexts/NotificationContext';
import { useConfirmDialog } from '@/contexts/ConfirmDialogContext';
import SearchableDropdown from '@/components/SearchableDropdown';
import ModalDialog from '@/components/ModalDialog';
import SummaryCards, { type SummaryCard } from '@/components/SummaryCards';

const VEHICLE_TYPES = ['Truck', 'Pickup', 'Tipper', 'Trailer', 'Car', 'JCB', 'Crane', 'Mixer', 'Excavator', 'Roller', 'Other'];
const FUEL_TYPES = ['Diesel', 'Petrol', 'CNG', 'Electric'];
const SERVICE_TYPES = ['Oil Change', 'Tyre Replacement', 'Brake Service', 'Engine Repair', 'Battery Replacement', 'General Service', 'Painting', 'Accident Repair', 'Other'];

interface Vehicle {
  id: string;
  display_id?: string;
  vehicle_number: string;
  vehicle_type?: string;
  make?: string;
  model?: string;
  year?: number;
  owner_name?: string;
  owner_contact?: string;
  driver_name?: string;
  fuel_type?: string;
  insurance_expiry?: string;
  assigned_site_id?: string;
  status?: string;
}

interface Site { id: string; name: string; }

export default function VehiclesPage() {
  const { success, error: notifyError } = useNotification();
  const { confirm } = useConfirmDialog();

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Vehicle form fields
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [vehicleType, setVehicleType] = useState('');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [ownerContact, setOwnerContact] = useState('');
  const [driverName, setDriverName] = useState('');
  const [fuelType, setFuelType] = useState('');
  const [insuranceExpiry, setInsuranceExpiry] = useState('');
  const [assignedSiteId, setAssignedSiteId] = useState('');
  const [vehicleStatus, setVehicleStatus] = useState('active');

  // Service log modal
  const [serviceModalOpen, setServiceModalOpen] = useState(false);
  const [serviceVehicle, setServiceVehicle] = useState<Vehicle | null>(null);
  const [serviceDate, setServiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [serviceType, setServiceType] = useState('');
  const [serviceCost, setServiceCost] = useState('');
  const [serviceOdometer, setServiceOdometer] = useState('');
  const [serviceRemarks, setServiceRemarks] = useState('');
  const [serviceSaving, setServiceSaving] = useState(false);

  // Service history modal
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [historyVehicle, setHistoryVehicle] = useState<Vehicle | null>(null);
  const [serviceHistory, setServiceHistory] = useState<any[]>([]);

  const loadSites = useCallback(async () => {
    try {
      const data = await apiGet<Site[]>('/sites');
      setSites(Array.isArray(data) ? data : []);
    } catch {}
  }, []);

  const loadVehicles = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet<Vehicle[]>('/vehicles');
      setVehicles(Array.isArray(data) ? data : []);
    } catch (err: any) {
      notifyError('Failed to load vehicles: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [notifyError]);

  useEffect(() => {
    loadSites();
    loadVehicles();
  }, [loadSites, loadVehicles]);

  const siteItems = useMemo(() => sites.map(s => ({ value: s.id, label: s.name })), [sites]);

  const getSiteName = (id?: string) => {
    if (!id) return '--';
    return sites.find(s => s.id === id)?.name ?? '--';
  };

  const filteredVehicles = useMemo(() => {
    let result = vehicles;
    if (statusFilter !== 'all') result = result.filter(v => v.status === statusFilter);
    const q = searchQuery.toLowerCase();
    if (q) result = result.filter(v =>
      (v.vehicle_number ?? '').toLowerCase().includes(q) ||
      (v.owner_name ?? '').toLowerCase().includes(q) ||
      (v.driver_name ?? '').toLowerCase().includes(q) ||
      (v.make ?? '').toLowerCase().includes(q) ||
      (v.model ?? '').toLowerCase().includes(q)
    );
    return result;
  }, [vehicles, statusFilter, searchQuery]);

  const summaryCards = useMemo<SummaryCard[]>(() => [
    { title: 'Total Vehicles', value: vehicles.length, icon: 'ri-truck-line', color: 'primary' },
    { title: 'Active', value: vehicles.filter(v => v.status === 'active').length, icon: 'ri-checkbox-circle-line', color: 'success' },
    { title: 'Inactive', value: vehicles.filter(v => v.status === 'inactive').length, icon: 'ri-close-circle-line', color: 'danger' },
    { title: 'Maintenance', value: vehicles.filter(v => v.status === 'maintenance').length, icon: 'ri-tools-line', color: 'warning' },
  ], [vehicles]);

  const resetForm = useCallback(() => {
    setEditingId(null);
    setVehicleNumber('');
    setVehicleType('');
    setMake('');
    setModel('');
    setYear('');
    setOwnerName('');
    setOwnerContact('');
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
      make: make || null,
      model: model || null,
      year: year ? parseInt(year) : null,
      owner_name: ownerName || null,
      owner_contact: ownerContact || null,
      driver_name: driverName || null,
      fuel_type: fuelType || null,
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
  }, [vehicleNumber, vehicleType, make, model, year, ownerName, ownerContact, driverName, fuelType, insuranceExpiry, assignedSiteId, vehicleStatus, editingId, success, notifyError, resetForm, loadVehicles]);

  const editVehicle = useCallback((v: Vehicle) => {
    setEditingId(v.id);
    setVehicleNumber(v.vehicle_number ?? '');
    setVehicleType(v.vehicle_type ?? '');
    setMake(v.make ?? '');
    setModel(v.model ?? '');
    setYear(v.year ? String(v.year) : '');
    setOwnerName(v.owner_name ?? '');
    setOwnerContact(v.owner_contact ?? '');
    setDriverName(v.driver_name ?? '');
    setFuelType(v.fuel_type ?? '');
    setInsuranceExpiry(v.insurance_expiry?.split('T')[0] ?? '');
    setAssignedSiteId(v.assigned_site_id ?? '');
    setVehicleStatus(v.status ?? 'active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const deleteVehicle = useCallback(async (v: Vehicle) => {
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

  // Service Log
  const openServiceLog = (vehicle: Vehicle) => {
    setServiceVehicle(vehicle);
    setServiceDate(new Date().toISOString().split('T')[0]);
    setServiceType('');
    setServiceCost('');
    setServiceOdometer('');
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
        remarks: serviceRemarks || null,
      });
      success('Service log added');
      setServiceModalOpen(false);
      loadVehicles();
    } catch (err: any) {
      notifyError('Failed to save service log: ' + err.message);
    } finally {
      setServiceSaving(false);
    }
  }, [serviceVehicle, serviceDate, serviceType, serviceCost, serviceOdometer, serviceRemarks, success, notifyError, loadVehicles]);

  const showServiceHistory = useCallback(async (vehicle: Vehicle) => {
    setHistoryVehicle(vehicle);
    setHistoryModalOpen(true);
    try {
      const data = await apiGet<any[]>(`/vehicles/${vehicle.id}/service-logs`);
      setServiceHistory(Array.isArray(data) ? data : []);
    } catch {
      setServiceHistory([]);
    }
  }, []);

  const getStatusBadge = (st?: string) => {
    switch (st) {
      case 'active': return 'badge badge-success';
      case 'inactive': return 'badge badge-danger';
      case 'maintenance': return 'badge badge-warning';
      default: return 'badge badge-info';
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1><i className="ri-truck-line" /> Vehicles</h1>
      </div>

      <SummaryCards cards={summaryCards} />

      {/* Add/Edit Form */}
      <div className="card-container" style={{ marginTop: 16 }}>
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
              <label>Make</label>
              <input type="text" value={make} onChange={e => setMake(e.target.value)} placeholder="e.g. Tata, Ashok Leyland" />
            </div>
            <div className="form-group">
              <label>Model</label>
              <input type="text" value={model} onChange={e => setModel(e.target.value)} placeholder="e.g. 407, 2523" />
            </div>
            <div className="form-group">
              <label>Year</label>
              <input type="number" value={year} onChange={e => setYear(e.target.value)} placeholder="e.g. 2022" min="1990" max="2099" />
            </div>
            <div className="form-group">
              <label>Owner Name</label>
              <input type="text" value={ownerName} onChange={e => setOwnerName(e.target.value)} placeholder="Owner name" />
            </div>
            <div className="form-group">
              <label>Owner Contact</label>
              <input type="text" value={ownerContact} onChange={e => setOwnerContact(e.target.value)} placeholder="Phone number" />
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
              <i className={editingId ? 'ri-save-line' : 'ri-add-line'} />
              {editingId ? ' Update Vehicle' : ' Add Vehicle'}
            </button>
            {editingId && <button type="button" className="btn-secondary" onClick={resetForm}>Cancel</button>}
          </div>
        </form>
      </div>

      {/* Filters */}
      <div className="card-container" style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 4 }}>
            {['all', 'active', 'inactive', 'maintenance'].map(s => (
              <button
                key={s}
                className={`btn-secondary`}
                style={{
                  padding: '6px 14px',
                  fontSize: 13,
                  background: statusFilter === s ? 'var(--accent)' : undefined,
                  color: statusFilter === s ? '#fff' : undefined,
                }}
                onClick={() => setStatusFilter(s)}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search vehicle number, owner, driver, make, model..."
            style={{ flex: 1, minWidth: 200 }}
          />
        </div>
      </div>

      {/* Vehicle Table */}
      <div className="table-responsive" style={{ marginTop: 16 }}>
        {loading ? (
          <div className="empty-state"><div className="skeleton" style={{ height: 200 }} /></div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Display ID</th>
                <th>Vehicle No</th>
                <th>Type</th>
                <th>Make</th>
                <th>Model</th>
                <th>Year</th>
                <th>Owner</th>
                <th>Driver</th>
                <th>Fuel</th>
                <th>Insurance Expiry</th>
                <th>Site</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredVehicles.length === 0 ? (
                <tr><td colSpan={13} className="empty-state">No vehicles found.</td></tr>
              ) : filteredVehicles.map(v => (
                <tr key={v.id}>
                  <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{v.display_id ?? '--'}</td>
                  <td style={{ fontWeight: 700, fontFamily: 'monospace' }}>{v.vehicle_number}</td>
                  <td><span className="badge badge-info">{v.vehicle_type}</span></td>
                  <td>{v.make ?? '--'}</td>
                  <td>{v.model ?? '--'}</td>
                  <td>{v.year ?? '--'}</td>
                  <td>{v.owner_name ?? '--'}</td>
                  <td>{v.driver_name ?? '--'}</td>
                  <td>{v.fuel_type ?? '--'}</td>
                  <td>{v.insurance_expiry?.split('T')[0] ?? '--'}</td>
                  <td>{getSiteName(v.assigned_site_id)}</td>
                  <td><span className={getStatusBadge(v.status)}>{v.status ?? '--'}</span></td>
                  <td>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <button className="btn-success" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => openServiceLog(v)} title="Add Service Log">
                        <i className="ri-tools-line" />
                      </button>
                      <button className="btn-secondary" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => showServiceHistory(v)} title="Service History">
                        <i className="ri-history-line" />
                      </button>
                      <button className="btn-primary" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => editVehicle(v)} title="Edit">
                        <i className="ri-pencil-line" />
                      </button>
                      <button className="btn-danger" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => deleteVehicle(v)} title="Delete">
                        <i className="ri-delete-bin-line" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add Service Log Modal */}
      <ModalDialog isOpen={serviceModalOpen} title={`Add Service - ${serviceVehicle?.vehicle_number ?? ''}`} onClose={() => setServiceModalOpen(false)}>
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
            <label>Remarks</label>
            <textarea value={serviceRemarks} onChange={e => setServiceRemarks(e.target.value)} rows={2} placeholder="Optional remarks" />
          </div>
          <div className="modal-footer">
            <button type="submit" className="btn-primary" disabled={serviceSaving || !serviceType || !serviceCost}>
              <i className="ri-check-line" /> {serviceSaving ? 'Saving...' : 'Save Service Log'}
            </button>
            <button type="button" className="btn-secondary" onClick={() => setServiceModalOpen(false)}>Cancel</button>
          </div>
        </form>
      </ModalDialog>

      {/* Service History Modal */}
      <ModalDialog isOpen={historyModalOpen} title={`Service History - ${historyVehicle?.vehicle_number ?? ''}`} size="lg" onClose={() => setHistoryModalOpen(false)}>
        <table>
          <thead>
            <tr><th>#</th><th>Date</th><th>Type</th><th>Cost</th><th>Odometer</th><th>Remarks</th></tr>
          </thead>
          <tbody>
            {serviceHistory.length === 0 ? (
              <tr><td colSpan={6} className="empty-state">No service records found.</td></tr>
            ) : serviceHistory.map((s, i) => (
              <tr key={s.id ?? i}>
                <td>{i + 1}</td>
                <td>{s.service_date?.split('T')[0] ?? '--'}</td>
                <td>{s.service_type ?? '--'}</td>
                <td style={{ fontWeight: 700 }}>₹{(s.cost ?? 0).toLocaleString('en-IN')}</td>
                <td>{s.odometer_reading ? `${s.odometer_reading.toLocaleString()} km` : '--'}</td>
                <td>{s.remarks ?? '--'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {serviceHistory.length > 0 && (
          <div style={{ textAlign: 'right', marginTop: 12, fontWeight: 700, fontSize: 14 }}>
            Total Service Cost: ₹{serviceHistory.reduce((s, e) => s + (e.cost ?? 0), 0).toLocaleString('en-IN')}
          </div>
        )}
      </ModalDialog>
    </div>
  );
}
