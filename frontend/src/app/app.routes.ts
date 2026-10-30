import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./auth/login/login').then((m) => m.LoginComponent),
  },

  // Admin Portal
  {
    path: 'admin',
    loadComponent: () =>
      import('./layouts/admin-layout/admin-layout').then((m) => m.AdminLayoutComponent),
    canActivate: [authGuard],
    data: { requiredRole: 'admin' },
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./pages/dashboard-home/dashboard-home').then((m) => m.DashboardHomeComponent),
      },
      // Master Section
      {
        path: 'master/new-user-entry',
        loadComponent: () =>
          import('./pages/master/new-user-entry/new-user-entry').then(
            (m) => m.NewUserEntryComponent
          ),
      },
      {
        path: 'master/menu-allotment',
        loadComponent: () =>
          import('./pages/master/menu-allotment/menu-allotment').then(
            (m) => m.MenuAllotmentComponent
          ),
      },
      {
        path: 'master/head-allotment',
        loadComponent: () =>
          import('./pages/master/head-allotment/head-allotment').then(
            (m) => m.HeadAllotmentComponent
          ),
      },
      {
        path: 'master/bank-entry',
        loadComponent: () =>
          import('./pages/master/bank-entry/bank-entry').then((m) => m.BankEntryComponent),
      },
      {
        path: 'master/tc-entry',
        loadComponent: () =>
          import('./pages/master/tc-entry/tc-entry').then((m) => m.TcEntryComponent),
      },
      // Approval Section
      {
        path: 'approval/approve-office',
        loadComponent: () =>
          import('./pages/approval/approve-office/approve-office').then(
            (m) => m.ApproveOfficeComponent
          ),
      },
      {
        path: 'approval/approve-supervisor',
        loadComponent: () =>
          import('./pages/approval/approve-supervisor/approve-supervisor').then(
            (m) => m.ApproveSupervisorComponent
          ),
      },
      {
        path: 'approval/approval-logs',
        loadComponent: () =>
          import('./pages/approval/approval-logs/approval-logs').then(
            (m) => m.ApprovalLogsComponent
          ),
      },
      // Employee Section
      {
        path: 'employee/employee-category',
        loadComponent: () =>
          import('./pages/employee/employee-category/employee-category').then(
            (m) => m.EmployeeCategoryComponent
          ),
      },
      {
        path: 'employee/registered-employees',
        loadComponent: () =>
          import('./pages/employee/registered-employee-records/registered-employee-records').then(
            (m) => m.RegisteredEmployeeRecordsComponent
          ),
      },
      {
        path: 'employee/site-tagging',
        loadComponent: () =>
          import('./pages/employee/site-tagging/site-tagging').then(
            (m) => m.SiteTaggingComponent
          ),
      },
      {
        path: 'employee/employee-sub-id',
        loadComponent: () =>
          import('./pages/employee/employee-sub-id/employee-sub-id').then(
            (m) => m.EmployeeSubIdComponent
          ),
      },
      {
        path: 'employee/payment-list',
        loadComponent: () =>
          import('./pages/employee/payment-list/payment-list').then(
            (m) => m.PaymentListComponent
          ),
      },
      {
        path: 'employee/employee-attendance',
        loadComponent: () =>
          import('./pages/employee/employee-attendance/employee-attendance').then(
            (m) => m.EmployeeAttendanceComponent
          ),
      },
      {
        path: 'employee/site-leave-entry',
        loadComponent: () =>
          import('./pages/employee/site-leave-entry/site-leave-entry').then(
            (m) => m.SiteLeaveEntryComponent
          ),
      },
      {
        path: 'employee/employee-ledger',
        loadComponent: () =>
          import('./pages/employee/employee-ledger/employee-ledger').then(
            (m) => m.EmployeeLedgerComponent
          ),
      },
      {
        path: 'employee/employee-joining',
        loadComponent: () =>
          import('./pages/employee/employee-joining/employee-joining').then(
            (m) => m.EmployeeJoiningComponent
          ),
      },
      // Contractor Section
      {
        path: 'contractor/add-contractor',
        loadComponent: () =>
          import('./pages/contractor/add-contractor/add-contractor').then(
            (m) => m.AddContractorComponent
          ),
      },
      {
        path: 'contractor/site-order-entry',
        loadComponent: () =>
          import('./pages/contractor/site-order-entry/site-order-entry').then(
            (m) => m.SiteOrderEntryComponent
          ),
      },
      {
        path: 'contractor/product-entry',
        loadComponent: () =>
          import('./pages/contractor/product-entry/product-entry').then(
            (m) => m.ProductEntryComponent
          ),
      },
      {
        path: 'contractor/contractor-ledger',
        loadComponent: () =>
          import('./pages/contractor/contractor-ledger/contractor-ledger').then(
            (m) => m.ContractorLedgerComponent
          ),
      },
      // Mobilization Section
      {
        path: 'mobilization/add-equipment',
        loadComponent: () =>
          import('./pages/mobilization/add-equipment/add-equipment').then(
            (m) => m.AddEquipmentComponent
          ),
      },
      {
        path: 'mobilization/site-order-equipment',
        loadComponent: () =>
          import('./pages/mobilization/site-order-equipment/site-order-equipment').then(
            (m) => m.SiteOrderEquipmentComponent
          ),
      },
      {
        path: 'mobilization/equipment-leave',
        loadComponent: () =>
          import('./pages/mobilization/equipment-leave/equipment-leave').then(
            (m) => m.EquipmentLeaveComponent
          ),
      },
      {
        path: 'mobilization/site-tagging-equipment',
        loadComponent: () =>
          import('./pages/mobilization/site-tagging-equipment/site-tagging-equipment').then(
            (m) => m.SiteTaggingEquipmentComponent
          ),
      },
      // Company Section
      {
        path: 'company/add-company',
        loadComponent: () =>
          import('./pages/company/add-company/add-company').then((m) => m.AddCompanyComponent),
      },
      {
        path: 'company/balance-received',
        loadComponent: () =>
          import('./pages/company/balance-received/balance-received').then(
            (m) => m.BalanceReceivedComponent
          ),
      },
      {
        path: 'company/company-ledger',
        loadComponent: () =>
          import('./pages/company/company-ledger/company-ledger').then(
            (m) => m.CompanyLedgerComponent
          ),
      },
      {
        path: 'company/company-loan-management',
        loadComponent: () =>
          import('./pages/company/company-loan-management/company-loan-management').then(
            (m) => m.CompanyLoanManagementComponent
          ),
      },
      {
        path: 'company/vehicle-management',
        loadComponent: () =>
          import('./pages/company/vehicle-management/vehicle-management').then(
            (m) => m.VehicleManagementComponent
          ),
      },
      {
        path: 'company/income-expense-entry',
        loadComponent: () =>
          import('./pages/company/income-expense-entry/income-expense-entry').then(
            (m) => m.IncomeExpenseEntryComponent
          ),
      },
      {
        path: 'company/bank-statement',
        loadComponent: () =>
          import('./pages/company/bank-statement/bank-statement').then(
            (m) => m.BankStatementComponent
          ),
      },
      // Supervisor Section
      {
        path: 'supervisor/add-supervisor',
        loadComponent: () =>
          import('./pages/supervisor/add-supervisor/add-supervisor').then(
            (m) => m.AddSupervisorComponent
          ),
      },
      {
        path: 'supervisor/site-tagging-supervisor',
        loadComponent: () =>
          import('./pages/supervisor/site-tagging-supervisor/site-tagging-supervisor').then(
            (m) => m.SiteTaggingSupervisorComponent
          ),
      },
      {
        path: 'supervisor/supervisor-ledger',
        loadComponent: () =>
          import('./pages/supervisor/supervisor-ledger/supervisor-ledger').then(
            (m) => m.SupervisorLedgerComponent
          ),
      },
      // Sales Section
      {
        path: 'sales/purchase-order-entry',
        loadComponent: () =>
          import('./pages/sales/purchase-order-entry/purchase-order-entry').then(
            (m) => m.PurchaseOrderEntryComponent
          ),
      },
      {
        path: 'sales/invoice-entry',
        loadComponent: () =>
          import('./pages/sales/invoice-entry/invoice-entry').then(
            (m) => m.InvoiceEntryComponent
          ),
      },
      {
        path: 'sales/view-site',
        loadComponent: () =>
          import('./pages/sales/view-site/view-site').then((m) => m.ViewSiteComponent),
      },
      // Purchase Section
      {
        path: 'purchase/add-retailer',
        loadComponent: () =>
          import('./pages/purchase/add-retailer/add-retailer').then(
            (m) => m.AddRetailerComponent
          ),
      },
      {
        path: 'purchase/retail-site-invoice',
        loadComponent: () =>
          import('./pages/purchase/retail-site-invoice/retail-site-invoice').then(
            (m) => m.RetailSiteInvoiceComponent
          ),
      },
      {
        path: 'purchase/gst-report',
        loadComponent: () =>
          import('./pages/purchase/gst-report/gst-report').then((m) => m.GstReportComponent),
      },
      {
        path: 'purchase/non-gst-report',
        loadComponent: () =>
          import('./pages/purchase/non-gst-report/non-gst-report').then(
            (m) => m.NonGstReportComponent
          ),
      },
      {
        path: 'purchase/retail-ledger',
        loadComponent: () =>
          import('./pages/purchase/retail-ledger/retail-ledger').then(
            (m) => m.RetailLedgerComponent
          ),
      },
      // Payment Section
      {
        path: 'payment/all-type-payment',
        loadComponent: () =>
          import('./pages/payment/all-type-payment/all-type-payment').then(
            (m) => m.AllTypePaymentComponent
          ),
      },
      {
        path: 'payment/payment-view',
        loadComponent: () =>
          import('./pages/payment/payment-view/payment-view').then(
            (m) => m.PaymentViewComponent
          ),
      },
      // Reports Section
      {
        path: 'reports/mobilization-report',
        loadComponent: () =>
          import('./pages/reports/mobilization-report/mobilization-report').then(
            (m) => m.MobilizationReportComponent
          ),
      },
      {
        path: 'reports/employee-report',
        loadComponent: () =>
          import('./pages/reports/employee-report/employee-report').then(
            (m) => m.EmployeeReportComponent
          ),
      },
      {
        path: 'reports/contractor-report',
        loadComponent: () =>
          import('./pages/reports/contractor-report/contractor-report').then(
            (m) => m.ContractorReportComponent
          ),
      },
      {
        path: 'reports/company-report',
        loadComponent: () =>
          import('./pages/reports/company-report/company-report').then(
            (m) => m.CompanyReportComponent
          ),
      },
      {
        path: 'reports/supervisor-report',
        loadComponent: () =>
          import('./pages/reports/supervisor-report/supervisor-report').then(
            (m) => m.SupervisorReportComponent
          ),
      },
      {
        path: 'reports/sales-report',
        loadComponent: () =>
          import('./pages/reports/sales-report/sales-report').then(
            (m) => m.SalesReportComponent
          ),
      },
      {
        path: 'reports/purchase-report',
        loadComponent: () =>
          import('./pages/reports/purchase-report/purchase-report').then(
            (m) => m.PurchaseReportComponent
          ),
      },
      {
        path: 'reports/gst-bill-download',
        loadComponent: () =>
          import('./pages/reports/gst-bill-download/gst-bill-download').then(
            (m) => m.GstBillDownloadComponent
          ),
      },
      {
        path: 'reports/non-gst-bill-download',
        loadComponent: () =>
          import('./pages/reports/non-gst-bill-download/non-gst-bill-download').then(
            (m) => m.NonGstBillDownloadComponent
          ),
      },
      {
        path: 'reports/full-site-ledger',
        loadComponent: () =>
          import('./pages/reports/full-site-ledger/full-site-ledger').then(
            (m) => m.FullSiteLedgerComponent
          ),
      },
      // Stock Section
      {
        path: 'stock/stock-view',
        loadComponent: () =>
          import('./pages/stock/stock-view/stock-view').then((m) => m.StockViewComponent),
      },
      {
        path: 'stock/current-stock',
        loadComponent: () =>
          import('./pages/stock/current-stock/current-stock').then(
            (m) => m.CurrentStockComponent
          ),
      },
      {
        path: 'stock/stock-transfer',
        loadComponent: () =>
          import('./pages/stock/stock-transfer/stock-transfer').then(
            (m) => m.StockTransferComponent
          ),
      },
      {
        path: 'stock/stock-report',
        loadComponent: () =>
          import('./pages/stock/stock-report/stock-report').then((m) => m.StockReportComponent),
      },
      // Documents Section
      {
        path: 'documents/create-doc-list',
        loadComponent: () =>
          import('./pages/documents/create-doc-list/create-doc-list').then(
            (m) => m.CreateDocListComponent
          ),
      },
      {
        path: 'documents/backup',
        loadComponent: () =>
          import('./pages/documents/backup/backup').then((m) => m.BackupComponent),
      },
      // Shared
      {
        path: 'change-password',
        loadComponent: () =>
          import('./pages/shared/change-password/change-password').then(
            (m) => m.ChangePasswordComponent
          ),
      },
    ],
  },

  // Office Portal
  {
    path: 'office',
    loadComponent: () =>
      import('./layouts/office-layout/office-layout').then((m) => m.OfficeLayoutComponent),
    canActivate: [authGuard],
    data: { requiredRole: 'office' },
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./pages/office/office-dashboard-home/office-dashboard-home').then(
            (m) => m.OfficeDashboardHomeComponent
          ),
      },
      {
        path: 'employee/employee-category',
        loadComponent: () =>
          import('./pages/employee/employee-category/employee-category').then(
            (m) => m.EmployeeCategoryComponent
          ),
      },
      {
        path: 'employee/registered-employees',
        loadComponent: () =>
          import('./pages/employee/registered-employee-records/registered-employee-records').then(
            (m) => m.RegisteredEmployeeRecordsComponent
          ),
      },
      {
        path: 'employee/site-tagging',
        loadComponent: () =>
          import('./pages/employee/site-tagging/site-tagging').then(
            (m) => m.SiteTaggingComponent
          ),
      },
      {
        path: 'employee/employee-sub-id',
        loadComponent: () =>
          import('./pages/employee/employee-sub-id/employee-sub-id').then(
            (m) => m.EmployeeSubIdComponent
          ),
      },
      {
        path: 'employee/payment-list',
        loadComponent: () =>
          import('./pages/employee/payment-list/payment-list').then(
            (m) => m.PaymentListComponent
          ),
      },
      {
        path: 'employee/employee-attendance',
        loadComponent: () =>
          import('./pages/employee/employee-attendance/employee-attendance').then(
            (m) => m.EmployeeAttendanceComponent
          ),
      },
      {
        path: 'employee/site-leave-entry',
        loadComponent: () =>
          import('./pages/employee/site-leave-entry/site-leave-entry').then(
            (m) => m.SiteLeaveEntryComponent
          ),
      },
      {
        path: 'employee/employee-ledger',
        loadComponent: () =>
          import('./pages/employee/employee-ledger/employee-ledger').then(
            (m) => m.EmployeeLedgerComponent
          ),
      },
      {
        path: 'contractor/add-contractor',
        loadComponent: () =>
          import('./pages/contractor/add-contractor/add-contractor').then(
            (m) => m.AddContractorComponent
          ),
      },
      {
        path: 'contractor/site-order-entry',
        loadComponent: () =>
          import('./pages/contractor/site-order-entry/site-order-entry').then(
            (m) => m.SiteOrderEntryComponent
          ),
      },
      {
        path: 'contractor/product-entry',
        loadComponent: () =>
          import('./pages/contractor/product-entry/product-entry').then(
            (m) => m.ProductEntryComponent
          ),
      },
      {
        path: 'contractor/contractor-ledger',
        loadComponent: () =>
          import('./pages/contractor/contractor-ledger/contractor-ledger').then(
            (m) => m.ContractorLedgerComponent
          ),
      },
      {
        path: 'purchase/add-retailer',
        loadComponent: () =>
          import('./pages/purchase/add-retailer/add-retailer').then(
            (m) => m.AddRetailerComponent
          ),
      },
      {
        path: 'purchase/retail-site-invoice',
        loadComponent: () =>
          import('./pages/purchase/retail-site-invoice/retail-site-invoice').then(
            (m) => m.RetailSiteInvoiceComponent
          ),
      },
      {
        path: 'purchase/gst-report',
        loadComponent: () =>
          import('./pages/purchase/gst-report/gst-report').then((m) => m.GstReportComponent),
      },
      {
        path: 'purchase/non-gst-report',
        loadComponent: () =>
          import('./pages/purchase/non-gst-report/non-gst-report').then(
            (m) => m.NonGstReportComponent
          ),
      },
      {
        path: 'purchase/retail-ledger',
        loadComponent: () =>
          import('./pages/purchase/retail-ledger/retail-ledger').then(
            (m) => m.RetailLedgerComponent
          ),
      },
      {
        path: 'payment/all-type-payment',
        loadComponent: () =>
          import('./pages/payment/all-type-payment/all-type-payment').then(
            (m) => m.AllTypePaymentComponent
          ),
      },
      {
        path: 'supervisor/add-supervisor',
        loadComponent: () =>
          import('./pages/supervisor/add-supervisor/add-supervisor').then(
            (m) => m.AddSupervisorComponent
          ),
      },
      {
        path: 'supervisor/site-tagging-supervisor',
        loadComponent: () =>
          import('./pages/supervisor/site-tagging-supervisor/site-tagging-supervisor').then(
            (m) => m.SiteTaggingSupervisorComponent
          ),
      },
      {
        path: 'supervisor/supervisor-ledger',
        loadComponent: () =>
          import('./pages/supervisor/supervisor-ledger/supervisor-ledger').then(
            (m) => m.SupervisorLedgerComponent
          ),
      },
      {
        path: 'change-password',
        loadComponent: () =>
          import('./pages/shared/change-password/change-password').then(
            (m) => m.ChangePasswordComponent
          ),
      },
    ],
  },

  // Supervisor Portal
  {
    path: 'supervisor',
    data: { requiredRole: 'supervisor' },
    loadComponent: () =>
      import('./layouts/supervisor-layout/supervisor-layout').then(
        (m) => m.SupervisorLayoutComponent
      ),
    canActivate: [authGuard],
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./pages/supervisor/supervisor-dashboard-home/supervisor-dashboard-home').then(
            (m) => m.SupervisorDashboardHomeComponent
          ),
      },
      {
        path: 'employee/employee-attendance',
        loadComponent: () =>
          import('./pages/employee/employee-attendance/employee-attendance').then(
            (m) => m.EmployeeAttendanceComponent
          ),
      },
      {
        path: 'employee/site-leave-entry',
        loadComponent: () =>
          import('./pages/employee/site-leave-entry/site-leave-entry').then(
            (m) => m.SiteLeaveEntryComponent
          ),
      },
      {
        path: 'employee/employee-ledger',
        loadComponent: () =>
          import('./pages/employee/employee-ledger/employee-ledger').then(
            (m) => m.EmployeeLedgerComponent
          ),
      },
      {
        path: 'purchase/retail-site-invoice',
        loadComponent: () =>
          import('./pages/purchase/retail-site-invoice/retail-site-invoice').then(
            (m) => m.RetailSiteInvoiceComponent
          ),
      },
      {
        path: 'payment/all-type-payment',
        loadComponent: () =>
          import('./pages/payment/all-type-payment/all-type-payment').then(
            (m) => m.AllTypePaymentComponent
          ),
      },
      {
        path: 'supervisor/supervisor-ledger',
        loadComponent: () =>
          import('./pages/supervisor/supervisor-ledger/supervisor-ledger').then(
            (m) => m.SupervisorLedgerComponent
          ),
      },
      {
        path: 'change-password',
        loadComponent: () =>
          import('./pages/shared/change-password/change-password').then(
            (m) => m.ChangePasswordComponent
          ),
      },
    ],
  },

  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: '**', redirectTo: 'login' },
];
