'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useApi } from '@/hooks/useApi';
import { useNotification } from '@/contexts/NotificationContext';
import { useRole } from '@/hooks/useRole';
import { useIndianNumber } from '@/hooks/useIndianNumber';
import DataTable, { TableColumn, TableAction } from '@/components/DataTable';
import ModalDialog from '@/components/ModalDialog';
import PageHeader from '@/components/PageHeader';
import SearchableDropdown, { DropdownItem } from '@/components/SearchableDropdown';

interface BillRecord {
  id?: number;
  display_id?: string;
  date?: string;
  inv_type?: string;
  inv_no?: string;
  retailer_name?: string;
  retailer_id?: string;
  gst_applicable?: boolean;
  total_amount?: number;
  paid_amount?: number;
  due_amount?: number;
  status?: string;
  items?: CartItem[];
}

interface CartItem {
  item_name: string;
  qty: number;
  unit: string;
  price: number;
  gst_percent: number;
  line_total: number;
}

const emptyCartItem: CartItem = {
  item_name: '',
  qty: 0,
  unit: 'pcs',
  price: 0,
  gst_percent: 0,
  line_total: 0,
};

const emptyForm = {
  date: '',
  inv_type: 'purchase',
  inv_no: '',
  retailer_id: '',
  gst_applicable: false,
  paid_amount: 0,
  remarks: '',
};

function computeLineTotal(item: CartItem, gstApplicable: boolean): number {
  const base = item.qty * item.price;
  if (gstApplicable && item.gst_percent > 0) {
    return base + (base * item.gst_percent) / 100;
  }
  return base;
}

export default function SupervisorRetailerBillsPage() {
  const { apiGet, apiPost } = useApi();
  const { success, error: notifyError } = useNotification();
  const { getSiteId } = useRole();
  const { formatCurrency } = useIndianNumber();

  const siteId = getSiteId();

  const [records, setRecords] = useState<BillRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [retailerItems, setRetailerItems] = useState<DropdownItem[]>([]);

  // Filters
  const [filterRetailer, setFilterRetailer] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterGst, setFilterGst] = useState('');

  // Add Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [cartItems, setCartItems] = useState<CartItem[]>([{ ...emptyCartItem }]);
  const [saving, setSaving] = useState(false);

  // View Modal
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [viewBill, setViewBill] = useState<BillRecord | null>(null);

  const cartTotal = useMemo(() => {
    return cartItems.reduce((sum, item) => sum + computeLineTotal(item, form.gst_applicable), 0);
  }, [cartItems, form.gst_applicable]);

  const dueAmount = useMemo(() => {
    return Math.max(0, cartTotal - form.paid_amount);
  }, [cartTotal, form.paid_amount]);

  const loadRetailers = useCallback(async () => {
    try {
      const data = await apiGet<any[]>('/api/retailers');
      setRetailerItems(
        (data || []).map((r: any) => ({
          value: String(r.id),
          label: `${r.display_id || r.id} - ${r.name}`,
        }))
      );
    } catch (err: any) {
      notifyError(err.message || 'Failed to load retailers');
    }
  }, [apiGet, notifyError]);

  const loadBills = useCallback(async () => {
    if (!siteId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('site_id', siteId);
      if (filterRetailer) params.set('retailer_id', filterRetailer);
      if (filterStatus) params.set('status', filterStatus);
      if (filterGst) params.set('gst_applicable', filterGst);
      const data = await apiGet<BillRecord[]>(`/api/retailer-bills?${params.toString()}`);
      setRecords(data || []);
    } catch (err: any) {
      notifyError(err.message || 'Failed to load bills');
    } finally {
      setLoading(false);
    }
  }, [apiGet, siteId, filterRetailer, filterStatus, filterGst, notifyError]);

  useEffect(() => {
    loadRetailers();
  }, [loadRetailers]);

  useEffect(() => {
    loadBills();
  }, [loadBills]);

  const columns: TableColumn[] = [
    { key: 'display_id', label: 'Bill ID', sortable: true },
    { key: 'date', label: 'Date', type: 'date', sortable: true },
    { key: 'inv_type', label: 'Inv Type', sortable: true },
    { key: 'inv_no', label: 'Inv No', sortable: true },
    { key: 'retailer_name', label: 'Retailer', sortable: true },
    {
      key: 'gst_applicable',
      label: 'GST?',
      type: 'badge',
      badgeMap: { true: 'success', false: 'warning', Yes: 'success', No: 'warning' },
      sortable: true,
    },
    { key: 'total_amount', label: 'Total', type: 'currency', sortable: true },
    { key: 'paid_amount', label: 'Paid', type: 'currency', sortable: true },
    { key: 'due_amount', label: 'Due', type: 'currency', sortable: true },
    {
      key: 'status',
      label: 'Status',
      type: 'badge',
      sortable: true,
      badgeMap: { pending: 'warning', approved: 'success', paid: 'info', partial: 'warning', rejected: 'danger' },
    },
  ];

  const tableActions: TableAction[] = [
    { label: '', icon: 'ri-eye-line', action: 'view', class: 'btn-primary btn-sm' },
  ];

  const handleAction = useCallback((event: { action: string; row: any }) => {
    if (event.action === 'view') {
      setViewBill(event.row as BillRecord);
      setViewModalOpen(true);
    }
  }, []);

  const openAddModal = () => {
    setForm({
      ...emptyForm,
      date: new Date().toISOString().split('T')[0],
    });
    setCartItems([{ ...emptyCartItem }]);
    setModalOpen(true);
  };

  const updateForm = (field: string, value: any) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const updateCartItem = (index: number, field: string, value: any) => {
    setCartItems(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      updated[index].line_total = computeLineTotal(updated[index], form.gst_applicable);
      return updated;
    });
  };

  const addCartRow = () => {
    setCartItems(prev => [...prev, { ...emptyCartItem }]);
  };

  const removeCartRow = (index: number) => {
    if (cartItems.length <= 1) return;
    setCartItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!form.retailer_id) {
      notifyError('Please select a retailer');
      return;
    }
    if (!form.date) {
      notifyError('Please select a date');
      return;
    }
    const validItems = cartItems.filter(i => i.item_name && i.qty > 0 && i.price > 0);
    if (validItems.length === 0) {
      notifyError('Please add at least one item');
      return;
    }

    setSaving(true);
    const formData = {
      ...form,
      site_id: siteId,
      items: validItems.map(i => ({
        ...i,
        line_total: computeLineTotal(i, form.gst_applicable),
      })),
      total_amount: cartTotal,
      due_amount: dueAmount,
    };

    try {
      await apiPost('/api/approvals', {
        source: 'supervisor',
        module: 'retailer_bill',
        action_type: 'create',
        entity_id: null,
        new_data: formData,
        remarks: `Retailer bill: ${form.inv_no || 'N/A'}`,
      });
      success('Retailer bill submitted for approval');
      setModalOpen(false);
      setForm({ ...emptyForm });
      setCartItems([{ ...emptyCartItem }]);
      loadBills();
    } catch (err: any) {
      notifyError(err.message || 'Failed to submit bill');
    } finally {
      setSaving(false);
    }
  };

  const modalFooter = (
    <>
      <button className="btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
      <button className="btn-primary" onClick={handleSave} disabled={saving || !form.retailer_id}>
        {saving ? 'Submitting...' : 'Submit for Approval'}
      </button>
    </>
  );

  return (
    <div className="page-container">
      <PageHeader title="Retailer Bills" icon="ri-receipt-line">
        <button className="btn-primary" onClick={openAddModal}>
          <i className="ri-add-line"></i> Add Bill
        </button>
      </PageHeader>

      {/* Filters */}
      <div className="card-container">
        <div className="form-grid">
          <div className="form-group">
            <SearchableDropdown
              items={retailerItems}
              value={filterRetailer}
              onChange={setFilterRetailer}
              placeholder="All Retailers"
              label="Retailer"
            />
          </div>
          <div className="form-group">
            <label>Status</label>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              <option value="">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="paid">Paid</option>
              <option value="partial">Partial</option>
            </select>
          </div>
          <div className="form-group">
            <label>GST Applicable</label>
            <select value={filterGst} onChange={e => setFilterGst(e.target.value)}>
              <option value="">All</option>
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
          </div>
        </div>
      </div>

      {/* Data Table */}
      <div className="card-container" style={{ marginTop: 16 }}>
        <DataTable
          columns={columns}
          data={records}
          actions={tableActions}
          onActionClick={handleAction}
          loading={loading}
          fileName="Retailer_Bills"
          showFooterTotals
          emptyMessage="No retailer bills found."
        />
      </div>

      {/* Add Bill Modal */}
      <ModalDialog
        isOpen={modalOpen}
        title="Add Retailer Bill"
        size="xl"
        onClose={() => setModalOpen(false)}
        footer={modalFooter}
      >
        {/* Header Fields */}
        <div className="form-grid">
          <div className="form-group">
            <label>Date <span style={{ color: 'var(--danger)' }}>*</span></label>
            <input
              type="date"
              value={form.date}
              onChange={e => updateForm('date', e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label>Invoice Type</label>
            <select value={form.inv_type} onChange={e => updateForm('inv_type', e.target.value)}>
              <option value="purchase">Purchase</option>
              <option value="return">Return</option>
              <option value="credit_note">Credit Note</option>
            </select>
          </div>
          <div className="form-group">
            <label>Invoice No</label>
            <input
              type="text"
              value={form.inv_no}
              onChange={e => updateForm('inv_no', e.target.value)}
              placeholder="Invoice number"
            />
          </div>
          <div className="form-group">
            <SearchableDropdown
              items={retailerItems}
              value={form.retailer_id || null}
              onChange={(val: any) => updateForm('retailer_id', val || '')}
              placeholder="Select Retailer..."
              label="Retailer"
              required
            />
          </div>
          <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 24 }}>
            <input
              type="checkbox"
              id="gst_applicable"
              checked={form.gst_applicable}
              onChange={e => updateForm('gst_applicable', e.target.checked)}
              style={{ width: 18, height: 18 }}
            />
            <label htmlFor="gst_applicable" style={{ margin: 0, cursor: 'pointer' }}>GST Applicable</label>
          </div>
        </div>

        {/* Cart Items */}
        <div style={{ marginTop: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <h4 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
              <i className="ri-list-check-2"></i> Line Items
            </h4>
            <button className="btn-secondary" onClick={addCartRow} style={{ padding: '4px 12px', fontSize: 12 }}>
              <i className="ri-add-line"></i> Add Row
            </button>
          </div>

          <div className="table-responsive">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Item Name</th>
                  <th>Qty</th>
                  <th>Unit</th>
                  <th>Price</th>
                  {form.gst_applicable && <th>GST %</th>}
                  <th>Line Total</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {cartItems.map((item, index) => {
                  const lineTotal = computeLineTotal(item, form.gst_applicable);
                  return (
                    <tr key={index}>
                      <td>{index + 1}</td>
                      <td>
                        <input
                          type="text"
                          value={item.item_name}
                          onChange={e => updateCartItem(index, 'item_name', e.target.value)}
                          placeholder="Item name"
                          style={{ minWidth: 140 }}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          value={item.qty}
                          onChange={e => updateCartItem(index, 'qty', Number(e.target.value))}
                          min={0}
                          step={0.01}
                          style={{ width: 80 }}
                        />
                      </td>
                      <td>
                        <select
                          value={item.unit}
                          onChange={e => updateCartItem(index, 'unit', e.target.value)}
                          style={{ width: 80 }}
                        >
                          <option value="pcs">Pcs</option>
                          <option value="kg">Kg</option>
                          <option value="ltr">Ltr</option>
                          <option value="mtr">Mtr</option>
                          <option value="sqft">SqFt</option>
                          <option value="bag">Bag</option>
                          <option value="box">Box</option>
                          <option value="nos">Nos</option>
                        </select>
                      </td>
                      <td>
                        <input
                          type="number"
                          value={item.price}
                          onChange={e => updateCartItem(index, 'price', Number(e.target.value))}
                          min={0}
                          step={0.01}
                          style={{ width: 100 }}
                        />
                      </td>
                      {form.gst_applicable && (
                        <td>
                          <input
                            type="number"
                            value={item.gst_percent}
                            onChange={e => updateCartItem(index, 'gst_percent', Number(e.target.value))}
                            min={0}
                            max={28}
                            step={0.5}
                            style={{ width: 70 }}
                          />
                        </td>
                      )}
                      <td style={{ fontWeight: 600 }}>
                        {formatCurrency(lineTotal)}
                      </td>
                      <td>
                        <button
                          className="btn-danger btn-sm"
                          onClick={() => removeCartRow(index)}
                          disabled={cartItems.length <= 1}
                          style={{ padding: '2px 8px' }}
                        >
                          <i className="ri-delete-bin-line"></i>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Totals */}
        <div style={{ marginTop: 16, padding: 16, background: 'var(--bg-tertiary)', borderRadius: 8 }}>
          <div className="form-grid">
            <div className="form-group">
              <label style={{ fontSize: 11, color: 'var(--text-muted)' }}>Cart Total</label>
              <div style={{ fontWeight: 700, fontSize: 18, color: 'var(--accent)' }}>{formatCurrency(cartTotal)}</div>
            </div>
            <div className="form-group">
              <label>Paid Amount</label>
              <input
                type="number"
                value={form.paid_amount}
                onChange={e => updateForm('paid_amount', Number(e.target.value))}
                min={0}
                step={0.01}
              />
            </div>
            <div className="form-group">
              <label style={{ fontSize: 11, color: 'var(--text-muted)' }}>Due Amount</label>
              <div style={{ fontWeight: 700, fontSize: 18, color: dueAmount > 0 ? 'var(--danger)' : 'var(--success)' }}>
                {formatCurrency(dueAmount)}
              </div>
            </div>
          </div>
        </div>
      </ModalDialog>

      {/* View Bill Modal */}
      <ModalDialog
        isOpen={viewModalOpen}
        title={`Bill Detail - ${viewBill?.display_id || ''}`}
        size="lg"
        onClose={() => setViewModalOpen(false)}
        footer={
          <button className="btn-secondary" onClick={() => setViewModalOpen(false)}>Close</button>
        }
      >
        {viewBill && (
          <div>
            <div className="form-grid" style={{ marginBottom: 16 }}>
              <div className="form-group">
                <label style={{ fontSize: 11, color: 'var(--text-muted)' }}>Date</label>
                <div style={{ fontWeight: 600 }}>{viewBill.date || '-'}</div>
              </div>
              <div className="form-group">
                <label style={{ fontSize: 11, color: 'var(--text-muted)' }}>Invoice Type</label>
                <div style={{ fontWeight: 600 }}>{viewBill.inv_type || '-'}</div>
              </div>
              <div className="form-group">
                <label style={{ fontSize: 11, color: 'var(--text-muted)' }}>Invoice No</label>
                <div style={{ fontWeight: 600 }}>{viewBill.inv_no || '-'}</div>
              </div>
              <div className="form-group">
                <label style={{ fontSize: 11, color: 'var(--text-muted)' }}>Retailer</label>
                <div style={{ fontWeight: 600 }}>{viewBill.retailer_name || '-'}</div>
              </div>
              <div className="form-group">
                <label style={{ fontSize: 11, color: 'var(--text-muted)' }}>GST Applicable</label>
                <div>
                  <span className={`badge badge-${viewBill.gst_applicable ? 'success' : 'warning'}`}>
                    {viewBill.gst_applicable ? 'Yes' : 'No'}
                  </span>
                </div>
              </div>
              <div className="form-group">
                <label style={{ fontSize: 11, color: 'var(--text-muted)' }}>Status</label>
                <div>
                  <span className={`badge badge-${viewBill.status === 'approved' ? 'success' : viewBill.status === 'rejected' ? 'danger' : 'warning'}`}>
                    {viewBill.status || 'pending'}
                  </span>
                </div>
              </div>
            </div>

            {/* Bill Items */}
            {viewBill.items && viewBill.items.length > 0 && (
              <div className="table-responsive">
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Item</th>
                      <th>Qty</th>
                      <th>Unit</th>
                      <th>Price</th>
                      <th>Line Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {viewBill.items.map((item, i) => (
                      <tr key={i}>
                        <td>{i + 1}</td>
                        <td>{item.item_name}</td>
                        <td>{item.qty}</td>
                        <td>{item.unit}</td>
                        <td>{formatCurrency(item.price)}</td>
                        <td style={{ fontWeight: 600 }}>{formatCurrency(item.line_total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Totals */}
            <div style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 24,
              marginTop: 16,
              padding: '16px 0',
              borderTop: '2px solid var(--border-color)',
            }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Total</div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{formatCurrency(viewBill.total_amount || 0)}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Paid</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--success)' }}>{formatCurrency(viewBill.paid_amount || 0)}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Due</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--danger)' }}>{formatCurrency(viewBill.due_amount || 0)}</div>
              </div>
            </div>
          </div>
        )}
      </ModalDialog>
    </div>
  );
}
