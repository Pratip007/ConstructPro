'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { apiGet, apiPut } from '@/lib/api-client';
import { useNotification } from '@/contexts/NotificationContext';
import { useAuth } from '@/contexts/AuthContext';
import { isSupervisor, isOffice } from '@/lib/role-utils';
import { requiresApproval, submitForApproval } from '@/lib/approval-utils';
import ModalDialog from '@/components/ModalDialog';
import styles from './MenuAllotmentPage.module.scss';

interface UserOption {
  id: string;
  name: string;
  role: string;
  status: string;
  menus: string[];
}

interface MenuItemConfig {
  id: string;
  name: string;
  url: string;
  checked: boolean;
}

interface MenuSection {
  sectionName: string;
  expanded: boolean;
  selectAll: boolean;
  items: MenuItemConfig[];
}

const MASTER_MENU_CONFIG = [
  {
    sectionName: 'Master Section',
    items: [
      { id: 'menu_new_user', name: 'New User Entry', url: 'NewUserEntry' },
      { id: 'menu_allotment', name: 'Menu Allotment', url: 'MenuAlotment' },
      { id: 'menu_head_entry', name: 'Head Entry', url: 'HeadAllotment' },
      { id: 'menu_bank_entry', name: 'Bank Entry', url: 'BankEntry' },
      { id: 'menu_tc_entry', name: 'Add T&C Entry', url: 'TCEntry' },
    ]
  },
  {
    sectionName: 'Approval Section',
    items: [
      { id: 'menu_apprv_office', name: 'Office User Requests', url: 'ApproveOffice' },
      { id: 'menu_apprv_supervisor', name: 'Supervisor Requests', url: 'ApproveSupervisor' },
      { id: 'menu_apprv_logs', name: 'Approval History', url: 'ApprovalLogs' },
    ]
  },
  {
    sectionName: 'Employee Section',
    items: [
      { id: 'menu_emp_category', name: 'Position Category', url: 'EmployeeCategory' },
      { id: 'menu_emp_joining', name: 'Employee Joining', url: 'RegisteredEmployeeRecords' },
      { id: 'menu_emp_sitetag', name: 'Site Tagging', url: 'SiteTagging' },
      { id: 'menu_emp_subid', name: 'Sub ID Create', url: 'EmployeeSubId' },
      { id: 'menu_emp_paymentlist', name: 'Payment List', url: 'Paymentlist' },
      { id: 'menu_emp_attendance', name: 'Attendance', url: 'EmployeeAttendance' },
      { id: 'menu_emp_leave', name: 'Site Leave Entry', url: 'SiteLeaveEntry' },
      { id: 'menu_emp_ledger', name: 'Employee Ledger', url: 'EmployeeLedger' },
    ]
  },
  {
    sectionName: 'Contractor Section',
    items: [
      { id: 'menu_cont_add', name: 'Add Contractor', url: 'AddContractor' },
      { id: 'menu_cont_siteorder', name: 'Site Order Entry', url: 'SiteOrderEntry' },
      { id: 'menu_cont_product', name: 'Product Entry', url: 'ProductEntry' },
      { id: 'menu_cont_ledger', name: 'Contractor Ledger', url: 'ContractorLedger' },
    ]
  },
  {
    sectionName: 'Mobilization Section',
    items: [
      { id: 'menu_mob_addequip', name: 'Add Equipment', url: 'AddEquipment' },
      { id: 'menu_mob_orderequip', name: 'Site Order Equipment', url: 'SiteOrderEquipment' },
      { id: 'menu_mob_leave', name: 'Equipment Leave', url: 'EquipmentLeave' },
      { id: 'menu_mob_sitetag', name: 'Site Tagging Equipment', url: 'SiteTaggingEquipment' },
    ]
  },
  {
    sectionName: 'Company Section',
    items: [
      { id: 'menu_comp_add', name: 'Add Company', url: 'AddCompany' },
      { id: 'menu_comp_bal', name: 'Balance Received', url: 'BalanceReceived' },
      { id: 'menu_comp_ledger', name: 'Company Ledger', url: 'CompanyLedger' },
      { id: 'menu_comp_loan', name: 'Company Loan Management', url: 'CompanyLoanManagement' },
      { id: 'menu_comp_vehicle', name: 'Vehicle Management', url: 'VehicleManagement' },
      { id: 'menu_comp_incexp', name: 'Income Expense Entry', url: 'IncomeExpenseEntry' },
      { id: 'menu_comp_bank', name: 'Bank Statement', url: 'BankStatement' },
    ]
  },
  {
    sectionName: 'Supervisor Section',
    items: [
      { id: 'menu_sup_add', name: 'Add Supervisor', url: 'AddSupervisor' },
      { id: 'menu_sup_tag', name: 'Site Tagging Supervisor', url: 'SiteTaggingSupervisor' },
      { id: 'menu_sup_ledger', name: 'Supervisor Ledger', url: 'SupervisorLedger' },
    ]
  },
  {
    sectionName: 'Sales Section',
    items: [
      { id: 'menu_sale_po', name: 'Purchase Order Entry', url: 'PurchaseOrderEntry' },
      { id: 'menu_sale_invoice', name: 'Invoice Entry', url: 'InvoiceEntry' },
      { id: 'menu_sale_viewsite', name: 'View Site', url: 'ViewSite' },
    ]
  },
  {
    sectionName: 'Purchase Section',
    items: [
      { id: 'menu_pur_addret', name: 'Add Retailer', url: 'AddRetailer' },
      { id: 'menu_pur_invoice', name: 'Retail Site Invoice', url: 'RetailSiteInvoice' },
      { id: 'menu_pur_gst', name: 'GST Report', url: 'GstReport' },
      { id: 'menu_pur_nongst', name: 'Non GST Report', url: 'NonGstReport' },
      { id: 'menu_pur_ledger', name: 'Retail Ledger', url: 'RetailLedger' },
    ]
  },
  {
    sectionName: 'Payment Section',
    items: [
      { id: 'menu_pay_all', name: 'All Type Payment', url: 'AllTypePayment' },
    ]
  },
  {
    sectionName: 'Report Section',
    items: [
      { id: 'menu_rpt_mob', name: 'Mobilization Report', url: 'MobilizationReport' },
      { id: 'menu_rpt_emp', name: 'Employee Report', url: 'EmployeeReport' },
      { id: 'menu_rpt_cont', name: 'Contractor Report', url: 'ContractorReport' },
      { id: 'menu_rpt_comp', name: 'Company Report', url: 'CompanyReport' },
      { id: 'menu_rpt_sup', name: 'Supervisor Report', url: 'SupervisorReport' },
      { id: 'menu_rpt_sales', name: 'Sales Report', url: 'SalesReport' },
      { id: 'menu_rpt_pur', name: 'Purchase Report', url: 'PurchaseReport' },
      { id: 'menu_rpt_gst', name: 'GST Bill Download', url: 'GstBillDownload' },
      { id: 'menu_rpt_nongst', name: 'Non GST Bill Download', url: 'NonGstBillDownload' },
      { id: 'menu_rpt_fullsite', name: 'Full Site Report Ledger', url: 'FullSiteLedger' },
    ]
  },
  {
    sectionName: 'Stock Management',
    items: [
      { id: 'menu_stk_view', name: 'Add/View Stock', url: 'StockView' },
      { id: 'menu_stk_current', name: 'Current Stock', url: 'CurrentStock' },
      { id: 'menu_stk_transfer', name: 'Stock Transfer', url: 'StockTransfer' },
      { id: 'menu_stk_report', name: 'Stock Report', url: 'StockReport' },
    ]
  },
  {
    sectionName: 'Company Document',
    items: [
      { id: 'menu_doc_list', name: 'Create Doc List', url: 'CreateDocList' },
      { id: 'menu_doc_backup', name: 'Company Full Backup', url: 'Backup' },
    ]
  },
];

const ROLES = ['Manager', 'Accountant', 'Site Supervisor', 'Admin', 'HR', 'Staff', 'Engineer', 'Office Staff'];

export default function MenuAllotmentPage() {
  const { success, error: notifyError } = useNotification();
  const { currentUser } = useAuth();

  const [users, setUsers] = useState<UserOption[]>([]);
  const [permissions, setPermissions] = useState<Record<string, string[]>>({});
  const [menuSections, setMenuSections] = useState<MenuSection[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedRole, setSelectedRole] = useState('');

  const roleBadge = useMemo(() => {
    if (isOffice(currentUser)) return 'Office Mode - Requires Approval';
    if (isSupervisor(currentUser)) return 'Supervisor Mode - View Only';
    return '';
  }, [currentUser]);

  const filteredUsers = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return users
      .filter(u => u.status === 'Active')
      .filter(u => !q || u.name.toLowerCase().includes(q) || u.id.toLowerCase().includes(q))
      .map(u => ({ ...u, menus: permissions[u.id] ?? [] }));
  }, [users, permissions, searchQuery]);

  const loadPermissions = useCallback(async () => {
    try {
      const perms = await apiGet<Record<string, string[]>>('/settings/permissions');
      setPermissions(perms ?? {});
    } catch { /* silent */ }
  }, []);

  const loadUsers = useCallback(async () => {
    setLoadingUsers(true);
    try {
      const [employees, supervisors] = await Promise.all([
        apiGet<Record<string, unknown>[]>('/employees'),
        apiGet<Record<string, unknown>[]>('/supervisors'),
      ]);
      const userList: UserOption[] = [];
      (employees ?? []).forEach((e: Record<string, unknown>) => {
        if (e.profile_id || e.id) {
          userList.push({
            id: String(e.profile_id ?? e.id),
            name: String(e.name ?? ''),
            role: String(e.designation ?? e.role ?? 'Office Staff'),
            status: String(e.status ?? 'Active'),
            menus: [],
          });
        }
      });
      (supervisors ?? []).forEach((s: Record<string, unknown>) => {
        if (s.profile_id || s.id) {
          userList.push({
            id: String(s.profile_id ?? s.id),
            name: String(s.name ?? ''),
            role: String(s.designation ?? 'Site Supervisor'),
            status: String(s.status ?? 'Active'),
            menus: [],
          });
        }
      });
      setUsers(userList);
      loadPermissions();
    } catch {
      notifyError('Failed to load user list');
    }
    setLoadingUsers(false);
  }, [notifyError, loadPermissions]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const getMenuLabel = (menuUrl: string): string => {
    for (const sec of MASTER_MENU_CONFIG) {
      const item = sec.items.find(i => i.url === menuUrl || i.id === menuUrl);
      if (item) return item.name;
    }
    return menuUrl;
  };

  const openModal = (userId?: string) => {
    if (isSupervisor(currentUser)) {
      notifyError('Supervisors cannot edit menu allotments');
      return;
    }

    const sections: MenuSection[] = MASTER_MENU_CONFIG.map(sec => ({
      sectionName: sec.sectionName,
      expanded: false,
      selectAll: false,
      items: sec.items.map(item => ({
        id: item.id,
        name: item.name,
        url: item.url,
        checked: false,
      })),
    }));

    if (userId) {
      setSelectedUserId(userId);
      const user = users.find(u => u.id === userId);
      if (user) setSelectedRole(user.role);
      const userMenus = permissions[userId] ?? [];
      const updatedSections = sections.map(sec => {
        const items = sec.items.map(item => ({
          ...item,
          checked: userMenus.includes(item.url) || userMenus.includes(item.id),
        }));
        const hasChecked = items.some(i => i.checked);
        return {
          ...sec,
          expanded: hasChecked,
          selectAll: items.every(i => i.checked),
          items,
        };
      });
      setMenuSections(updatedSections);
    } else {
      setSelectedUserId('');
      setSelectedRole('');
      setMenuSections(sections);
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
  };

  const onUserChange = (userId: string) => {
    setSelectedUserId(userId);
    if (userId) {
      const user = users.find(u => u.id === userId);
      if (user) setSelectedRole(user.role);
      const userMenus = permissions[userId] ?? [];
      setMenuSections(sections =>
        sections.map(sec => {
          const items = sec.items.map(item => ({
            ...item,
            checked: userMenus.includes(item.url) || userMenus.includes(item.id),
          }));
          const hasChecked = items.some(i => i.checked);
          return {
            ...sec,
            expanded: hasChecked,
            selectAll: items.every(i => i.checked),
            items,
          };
        })
      );
    } else {
      setMenuSections(sections =>
        sections.map(sec => ({
          ...sec,
          selectAll: false,
          items: sec.items.map(item => ({ ...item, checked: false })),
        }))
      );
    }
  };

  const toggleSection = (index: number) => {
    setMenuSections(sections => {
      const copy = [...sections];
      copy[index] = { ...copy[index], expanded: !copy[index].expanded };
      return copy;
    });
  };

  const toggleSectionAll = (index: number, checked: boolean) => {
    setMenuSections(sections => {
      const copy = [...sections];
      copy[index] = {
        ...copy[index],
        selectAll: checked,
        items: copy[index].items.map(item => ({ ...item, checked })),
      };
      return copy;
    });
  };

  const toggleItem = (sectionIndex: number, itemIndex: number, checked: boolean) => {
    setMenuSections(sections => {
      const copy = [...sections];
      const items = [...copy[sectionIndex].items];
      items[itemIndex] = { ...items[itemIndex], checked };
      const allChecked = items.every(i => i.checked);
      copy[sectionIndex] = { ...copy[sectionIndex], items, selectAll: allChecked };
      return copy;
    });
  };

  const saveAllotment = async () => {
    if (!selectedUserId) {
      notifyError('Please select a user first');
      return;
    }
    if (!selectedRole) {
      notifyError('Please assign a role');
      return;
    }

    const selectedMenus = menuSections
      .flatMap(sec => sec.items.filter(i => i.checked).map(i => i.url));

    if (requiresApproval(currentUser)) {
      try {
        const user = users.find(u => u.id === selectedUserId);
        await submitForApproval(
          'MenuAllotment',
          Number(selectedUserId) || 0,
          'update',
          { id: selectedUserId, menus: selectedMenus, role: selectedRole }
        );
        success('Menu allotment request sent for approval');
        closeModal();
        loadUsers();
      } catch (err: unknown) {
        notifyError((err as Error)?.message ?? 'Failed to submit request');
      }
      return;
    }

    setSaving(true);
    try {
      await apiPut(`/settings/menus/${selectedUserId}`, {
        menuItems: selectedMenus.map(url => ({ menuUrl: url, granted: true })),
        role: selectedRole,
      });
      success('User role & access menus saved');
      setPermissions(prev => ({ ...prev, [selectedUserId]: selectedMenus }));
      closeModal();
    } catch (err: unknown) {
      notifyError((err as Error)?.message ?? 'Failed to save allotment');
    }
    setSaving(false);
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1><i className="ri-shield-keyhole-line" /> User Menu Allotment</h1>
        {roleBadge && <span className="role-badge">{roleBadge}</span>}
      </div>

      <div className={styles.filterBar}>
        <input
          type="text"
          className={styles.searchInput}
          placeholder="Search user..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        {!isSupervisor(currentUser) && (
          <button className="btn-primary" onClick={() => openModal()}>
            <i className="ri-add-line" /> Allot / Edit Menus
          </button>
        )}
      </div>

      <div className="card-container" style={{ marginTop: 0 }}>
        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                <th>User Name</th>
                <th>Role</th>
                <th>Status</th>
                <th>Allotted Menus</th>
                {!isSupervisor(currentUser) && <th style={{ textAlign: 'center' }}>Action</th>}
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={isSupervisor(currentUser) ? 4 : 5} className="empty-state">
                    {loadingUsers ? 'Loading users...' : 'No active users found.'}
                  </td>
                </tr>
              ) : filteredUsers.map(user => (
                <tr key={user.id}>
                  <td>
                    <strong>{user.name}</strong>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginLeft: '4px' }}>({user.id})</span>
                  </td>
                  <td style={{ color: 'var(--accent)', fontWeight: 500 }}>{user.role}</td>
                  <td><span className="badge badge-success">Active</span></td>
                  <td>
                    {user.menus.length > 0 ? (
                      user.menus.map(menu => (
                        <span key={menu} className="badge badge-info" style={{ margin: '2px' }}>
                          {getMenuLabel(menu)}
                        </span>
                      ))
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontSize: '12px', fontStyle: 'italic' }}>
                        No menus allotted
                      </span>
                    )}
                  </td>
                  {!isSupervisor(currentUser) && (
                    <td style={{ textAlign: 'center' }}>
                      <button className="btn-icon" onClick={() => openModal(user.id)}>
                        <i className="ri-edit-line" /> Edit Access
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <ModalDialog isOpen={showModal} onClose={closeModal} title="Manage User Access">
        <div className="form-grid" style={{ marginBottom: '20px' }}>
          <div className="form-group">
            <label>1. Select Active User</label>
            <select value={selectedUserId} onChange={(e) => onUserChange(e.target.value)}>
              <option value="">-- Choose User --</option>
              {users.filter(u => u.status === 'Active').map(user => (
                <option key={user.id} value={user.id}>{user.name} ({user.id})</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>2. Employee Category (Role)</label>
            <select value={selectedRole} onChange={(e) => setSelectedRole(e.target.value)}>
              <option value="">-- Select Role --</option>
              {ROLES.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ marginBottom: '10px', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
          3. Select Module Access (Tree View)
        </div>

        {menuSections.map((section, si) => (
          <div key={section.sectionName} className={styles.menuSection}>
            <div className={styles.menuSectionHeader} onClick={() => toggleSection(si)}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className={`${styles.treeArrow} ${section.expanded ? styles.open : ''}`}>&#9654;</span>
                {section.sectionName}
              </span>
              <label className={styles.selectAllLabel} onClick={(e) => e.stopPropagation()}>
                <input
                  type="checkbox"
                  checked={section.selectAll}
                  onChange={(e) => toggleSectionAll(si, e.target.checked)}
                />
                Select All
              </label>
            </div>
            {section.expanded && (
              <div className={styles.menuTree}>
                {section.items.map((item, ii) => (
                  <div key={item.id} className={styles.menuItem}>
                    <input
                      type="checkbox"
                      id={`chk_${item.id}`}
                      checked={item.checked}
                      onChange={(e) => toggleItem(si, ii, e.target.checked)}
                    />
                    <label htmlFor={`chk_${item.id}`}>{item.name}</label>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '1rem' }}>
          <button className="btn-secondary" onClick={closeModal}>Cancel</button>
          <button className="btn-primary" onClick={saveAllotment} disabled={saving}>
            {requiresApproval(currentUser)
              ? (saving ? 'Submitting...' : 'Request Menu Allotment Approval')
              : (saving ? 'Saving...' : 'Save User Access')
            }
          </button>
        </div>
      </ModalDialog>
    </div>
  );
}
