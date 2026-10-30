# Frontend–Backend Integration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire every Angular 21 frontend page to the existing Express + Supabase backend API, replacing all hardcoded data and fake auth with real HTTP calls and JWT authentication.

**Architecture:** A shared `ApiService` wraps Angular `HttpClient` with the backend's `{ success, data }` / `{ success, error }` envelope. A functional `authInterceptor` injects the JWT Bearer token on every request. Each page component injects the relevant API service and replaces its hardcoded signals with data fetched from the backend. Loading/error states use a shared `NotificationService` for toast feedback.

**Tech Stack:** Angular 21 (standalone components, signals, FormsModule), `@angular/common/http` (HttpClient + functional interceptors), RxJS (HTTP only), Express 5.3 backend on port 3000.

**Spec:** This plan is derived from the existing backend API routes (`backend/src/routes/*.js`) and frontend page components (`frontend/src/app/pages/**/*.ts`). The backend API documentation lives at `backend/API_ROUTES.md`.

## Global Constraints

- Angular 21 standalone components — no NgModules
- All state via Angular signals (`signal()`, `computed()`) — no RxJS BehaviorSubjects for component state
- Template-driven forms (`FormsModule`) — do not switch to ReactiveFormsModule
- Backend envelope: success → `{ success: true, data: T }`, error → `{ success: false, error: string }`
- All monetary values arrive as strings from Postgres `NUMERIC(15,2)` — parse with `parseFloat()` and display with INR formatting
- Backend runs on `http://localhost:3000` in dev — configurable via `environment.ts`
- Every `DELETE` in the backend is a soft-delete (sets `status = 'inactive'` or similar) — frontend should remove from local list on success
- Supervisor users are site-locked by backend middleware — frontend need not filter, but should send `site_id` when available
- IDs from backend are `bigint` — use `number` in TypeScript (JSON serialization handles it)

## Review Focus

1. **Expired JWT during active session** — interceptor must catch 401 responses and redirect to `/login` with token cleanup, not show a cryptic error
2. **Empty-state pages after fresh seed** — pages must handle `data: []` gracefully (show empty-state message), not crash on `.length` of undefined
3. **Concurrent form submissions** — submit buttons must disable during HTTP flight to prevent double-creates
4. **Backend validation errors** — 400 responses with `{ success: false, error: "..." }` must display the error string to the user, not silently fail
5. **Portal-role mismatch** — a supervisor logging in must be routed to `/supervisor`, not `/admin`; the backend `profile.role` determines the portal, not user selection

---

### Task 1: HTTP Foundation Layer

**Files:**
- Create: `frontend/src/app/core/services/api.service.ts`
- Create: `frontend/src/app/core/interceptors/auth.interceptor.ts`
- Create: `frontend/src/app/core/services/notification.service.ts`
- Create: `frontend/src/environments/environment.ts`
- Create: `frontend/src/environments/environment.development.ts`
- Modify: `frontend/src/app/app.config.ts`

**Interfaces:**
- Consumes: nothing (foundational)
- Produces:
  - `ApiService` with methods:
    - `get<T>(path: string, params?: Record<string, string>): Observable<T>` — unwraps `{ success, data }` envelope, throws on `success: false`
    - `post<T>(path: string, body: unknown): Observable<T>` — same unwrap
    - `put<T>(path: string, body: unknown): Observable<T>` — same unwrap
    - `delete<T>(path: string): Observable<T>` — same unwrap
  - `authInterceptor: HttpInterceptorFn` — reads token from `localStorage('atr_access_token')`, adds `Authorization: Bearer <token>`, catches 401 → clears tokens + redirects to `/login`
  - `NotificationService` with methods:
    - `success(message: string): void` — shows green toast, auto-dismiss 3s
    - `error(message: string): void` — shows red toast, auto-dismiss 5s
  - `environment.apiUrl: string` — `'http://localhost:3000/api'`

- [ ] **Step 1: Create environment files**

`frontend/src/environments/environment.ts` — `export const environment = { production: true, apiUrl: 'http://localhost:3000/api' };`

`frontend/src/environments/environment.development.ts` — same but `production: false`.

- [ ] **Step 2: Update `angular.json` to use `fileReplacements` for dev environment**

In the `build` configuration under `development`, add `fileReplacements` swapping `environment.ts` for `environment.development.ts`.

- [ ] **Step 3: Create `NotificationService`**

Injectable `providedIn: 'root'`. Maintains a `notifications = signal<{id: number, type: 'success'|'error', message: string}[]>([])`. `success()` and `error()` push a notification and `setTimeout` to remove it. Export a `NotificationToastComponent` (standalone) that reads the signal and renders a fixed-position toast stack in the bottom-right corner. Add `<app-notification-toast />` in `frontend/src/app/app.ts` alongside `<router-outlet />`.

- [ ] **Step 4: Create `authInterceptor`**

Functional interceptor (`HttpInterceptorFn`). Reads `localStorage.getItem('atr_access_token')`. If present, clones request with `Authorization: Bearer ${token}`. Pipes the response: on 401 status, clears `atr_access_token` and `atr_refresh_token` from localStorage, injects `Router`, navigates to `/login`. Re-throws the error.

- [ ] **Step 5: Create `ApiService`**

Injectable `providedIn: 'root'`. Injects `HttpClient`. Each method builds the full URL from `environment.apiUrl + path`, calls `HttpClient`, and pipes through `map(res => res.data)` to unwrap the envelope. On error responses where `body.success === false`, throws the `body.error` string. The `get` method accepts an optional `params` object converted to `HttpParams`.

- [ ] **Step 6: Update `app.config.ts`**

Add `provideHttpClient(withInterceptors([authInterceptor]))` to the providers array. Import from `@angular/common/http`.

- [ ] **Step 7: Verify build compiles**

Run: `cd frontend && npx ng build --configuration development 2>&1 | tail -5`
Expected: Build succeeds with no errors.

- [ ] **Step 8: Commit**

```
git add frontend/src/environments/ frontend/src/app/core/services/api.service.ts frontend/src/app/core/interceptors/auth.interceptor.ts frontend/src/app/core/services/notification.service.ts frontend/src/app/app.config.ts frontend/src/app/app.ts frontend/angular.json
git commit -m "feat(frontend): add HTTP foundation - ApiService, auth interceptor, notifications"
```

---

### Task 2: Auth Integration

**Files:**
- Modify: `frontend/src/app/core/services/auth.service.ts`
- Modify: `frontend/src/app/core/guards/auth.guard.ts`
- Modify: `frontend/src/app/auth/login/login.ts`
- Modify: `frontend/src/app/auth/login/login.html`
- Modify: `frontend/src/app/pages/shared/change-password/change-password.ts`
- Modify: `frontend/src/app/layouts/admin-layout/admin-layout.ts` (logout wiring)
- Modify: `frontend/src/app/layouts/office-layout/office-layout.ts` (logout wiring)
- Modify: `frontend/src/app/layouts/supervisor-layout/supervisor-layout.ts` (logout wiring)

**Interfaces:**
- Consumes: `ApiService` (Task 1), `NotificationService` (Task 1)
- Produces:
  - `AuthService` with methods:
    - `login(email: string, password: string): Observable<void>` — calls `POST /auth/login`, stores tokens + profile, navigates by role
    - `logout(): void` — clears all `atr_*` localStorage, navigates to `/login`
    - `getToken(): string | null` — returns stored access token
    - `currentUser: Signal<UserProfile | null>` — reactive current user
    - `currentPortal: Signal<PortalType | null>` — derived from `currentUser().role`
    - `isLoggedIn: Signal<boolean>`
  - `UserProfile` interface: `{ id: number, authUid: string, displayId: string, name: string, role: PortalType, siteId: number | null }`

- [ ] **Step 1: Define `UserProfile` interface in `auth.service.ts`**

```typescript
export interface UserProfile {
  id: number;
  authUid: string;
  displayId: string;
  name: string;
  role: PortalType;
  siteId: number | null;
}
```

- [ ] **Step 2: Rewrite `AuthService`**

Replace the fake login with real API call. `login(email, password)` calls `this.api.post<{access_token: string, refresh_token: string, user: any}>('/auth/login', {email, password})`. On success: store `atr_access_token`, `atr_refresh_token`, `atr_current_logged_portal` (from `user.role`), and `atr_current_logged_user` (JSON stringify user profile) in localStorage. Update signals. Navigate based on `user.role`: admin→`/admin`, office→`/office`, supervisor→`/supervisor`, employee→`/admin/employee/employee-ledger`. Return the observable. `logout()` clears all `atr_*` keys from localStorage, resets signals, navigates to `/login`. Add `loadStoredUser()` private method that reads localStorage on construction to restore session across page refreshes.

- [ ] **Step 3: Update `authGuard`**

Check `auth.isLoggedIn()` AND that `localStorage.getItem('atr_access_token')` exists. If either is false, clear everything and redirect to `/login`.

- [ ] **Step 4: Update `LoginComponent`**

Change the form to use `email` field instead of generic username. The portal selector becomes informational only — the backend returns the user's actual role. Add `loading = signal(false)` and `isLoading` state to disable the submit button during the API call. In `onSubmit()`, call `this.auth.login(email, password).subscribe({ next: () => {}, error: (err) => this.errorMessage.set(err) })`. Remove the `setTimeout` delay.

- [ ] **Step 5: Update `login.html`**

Change the username input label to "Email" with `type="email"`. Remove or simplify portal selector (keep it for UX but don't use it for routing — backend determines role). Remove Aadhaar-specific formatting for employee portal (employees log in with email+password too via the API).

- [ ] **Step 6: Wire `ChangePasswordComponent`**

Inject `ApiService`. In `onSubmit()`, call `this.api.put('/auth/password', { currentPassword, newPassword })`. On success, show success notification. On error, show the backend error message. Add `loading` signal to disable button during flight.

- [ ] **Step 7: Wire logout in all three layout components**

Each layout component already has a logout button/link. Ensure it calls `auth.logout()`. Inject `AuthService` if not already injected. Display `auth.currentUser()?.name` in the header profile area and `auth.currentUser()?.displayId` where the display ID is shown.

- [ ] **Step 8: Verify build compiles**

Run: `cd frontend && npx ng build --configuration development 2>&1 | tail -5`
Expected: Build succeeds.

- [ ] **Step 9: Commit**

```
git add frontend/src/app/core/services/auth.service.ts frontend/src/app/core/guards/auth.guard.ts frontend/src/app/auth/login/ frontend/src/app/pages/shared/change-password/ frontend/src/app/layouts/
git commit -m "feat(frontend): real JWT auth - login, logout, token management, change password"
```

---

### Task 3: Dashboard & Approval Pages

**Files:**
- Modify: `frontend/src/app/pages/dashboard-home/dashboard-home.ts`
- Modify: `frontend/src/app/pages/approval/approve-office/approve-office.ts`
- Modify: `frontend/src/app/pages/approval/approve-supervisor/approve-supervisor.ts`
- Modify: `frontend/src/app/pages/approval/approval-logs/approval-logs.ts`
- Modify: `frontend/src/app/pages/office/office-dashboard-home/office-dashboard-home.ts`
- Modify: `frontend/src/app/pages/supervisor/supervisor-dashboard-home/supervisor-dashboard-home.ts`

**Interfaces:**
- Consumes: `ApiService` (Task 1), `NotificationService` (Task 1), `AuthService` (Task 2)
- Produces: nothing (leaf pages)

**API mappings:**
| Component | API Endpoint | Method |
|-----------|-------------|--------|
| DashboardHomeComponent — KPIs | `GET /dashboard/kpis` | load on init |
| DashboardHomeComponent — Pending Dues | `GET /dashboard/pending-dues` | load on init |
| DashboardHomeComponent — Notifications | `GET /dashboard/notifications` | load on init |
| DashboardHomeComponent — Activity Logs | `GET /approvals?status=approved` | load on init |
| ApproveOfficeComponent | `GET /approvals?source=office&status=pending` | load on init |
| ApproveOfficeComponent — approve | `PUT /approvals/:id/approve` | on click |
| ApproveOfficeComponent — reject | `PUT /approvals/:id/reject` | on click |
| ApproveSupervisorComponent | `GET /approvals?source=supervisor&status=pending` | load on init |
| ApproveSupervisorComponent — approve/reject | same as above | on click |
| ApprovalLogsComponent | `GET /approvals` | load on init |

- [ ] **Step 1: Wire `DashboardHomeComponent`**

Inject `ApiService`. Add `loading = signal(true)`. In an `ngOnInit` method (implement `OnInit`), make three parallel calls: `forkJoin({ kpis: api.get('/dashboard/kpis'), dues: api.get('/dashboard/pending-dues'), notifs: api.get('/dashboard/notifications') })`. Map `kpis` response to the `kpiCards` array format — the backend returns `{ active_sites, active_employees, contractors, supervisors, retailers, total_bank_balance }`. Map `dues` response to `pendingDues` signal. Map `notifs` to notification badges. Set `loading` to false. For activity logs, call `api.get('/approvals', {status: 'approved'})` and map to `activityLogs` signal. Remove all hardcoded data arrays.

- [ ] **Step 2: Wire `ApproveOfficeComponent`**

Inject `ApiService`, `NotificationService`. Load pending office approvals: `api.get('/approvals', {source: 'office', status: 'pending'})`. Display in table. Approve button calls `api.put('/approvals/${id}/approve', {})` → on success, remove from list, show success toast. Reject button shows a prompt for remarks, then calls `api.put('/approvals/${id}/reject', {remarks})`.

- [ ] **Step 3: Wire `ApproveSupervisorComponent`**

Same pattern as Step 2 but with `source: 'supervisor'`.

- [ ] **Step 4: Wire `ApprovalLogsComponent`**

Load all approvals: `api.get('/approvals')`. Display in table with status badges. Add date range and status filters as query params.

- [ ] **Step 5: Wire `OfficeDashboardHomeComponent` and `SupervisorDashboardHomeComponent`**

These are currently stubs. Add basic KPI display — office can show `GET /approvals/pending-counts` and a welcome message with user info from `AuthService`. Supervisor dashboard shows employee count for their site via `GET /employees?site_id=X`.

- [ ] **Step 6: Verify build compiles and commit**

```
git commit -m "feat(frontend): wire dashboard, approvals, portal home pages to backend API"
```

---

### Task 4: Master & Settings Pages

**Files:**
- Modify: `frontend/src/app/pages/master/new-user-entry/new-user-entry.ts`
- Modify: `frontend/src/app/pages/master/menu-allotment/menu-allotment.ts`
- Modify: `frontend/src/app/pages/master/head-allotment/head-allotment.ts`
- Modify: `frontend/src/app/pages/master/bank-entry/bank-entry.ts`
- Modify: `frontend/src/app/pages/master/tc-entry/tc-entry.ts`

**Interfaces:**
- Consumes: `ApiService` (Task 1), `NotificationService` (Task 1)
- Produces: nothing (leaf pages)

**API mappings:**
| Component | Load | Create | Update | Delete |
|-----------|------|--------|--------|--------|
| NewUserEntryComponent | — | `POST /auth/signup` | — | — |
| MenuAllotmentComponent | `GET /settings/menus/:profileId` | — | `PUT /settings/menus/:profileId` | — |
| HeadAllotmentComponent | `GET /settings/heads` | `POST /settings/heads` | `PUT /settings/heads/:id` | `DELETE /settings/heads/:id` |
| BankEntryComponent | `GET /banks` | `POST /banks` | `PUT /banks/:id` | `DELETE /banks/:id` |
| TcEntryComponent | `GET /settings/terms` | `POST /settings/terms` | `PUT /settings/terms/:id` | `DELETE /settings/terms/:id` |

- [ ] **Step 1: Wire `NewUserEntryComponent`**

Inject `ApiService`, `NotificationService`. The form collects name, email, password, role, displayId, siteId, aadhaar. On submit, call `api.post('/auth/signup', formData)`. On success, show notification and reset form. Also load sites for the site dropdown: `api.get('/sites')` on init.

- [ ] **Step 2: Wire `MenuAllotmentComponent`**

Load user list from profiles (use `api.get('/approvals/pending-counts')` as a proxy or add a user-list concept — the backend's `GET /settings/menus/:profileId` requires a known profile ID). On user select, load their menu allotments. On save, call `PUT /settings/menus/:profileId` with the updated menu array.

- [ ] **Step 3: Wire `HeadAllotmentComponent`**

Standard CRUD: load on init with `GET /settings/heads`. Create with `POST /settings/heads`. Edit inline, save with `PUT /settings/heads/:id`. Delete with `DELETE /settings/heads/:id`.

- [ ] **Step 4: Wire `BankEntryComponent`**

Standard CRUD: `GET /banks`, `POST /banks`, `PUT /banks/:id`, `DELETE /banks/:id`. Display opening_balance formatted as INR.

- [ ] **Step 5: Wire `TcEntryComponent`**

Standard CRUD: `GET /settings/terms`, `POST /settings/terms`, `PUT /settings/terms/:id`, `DELETE /settings/terms/:id`.

- [ ] **Step 6: Verify build compiles and commit**

```
git commit -m "feat(frontend): wire master & settings pages (users, menus, heads, banks, T&C)"
```

---

### Task 5: Employee Module Pages

**Files:**
- Modify: `frontend/src/app/pages/employee/employee-category/employee-category.ts`
- Modify: `frontend/src/app/pages/employee/registered-employee-records/registered-employee-records.ts`
- Modify: `frontend/src/app/pages/employee/employee-joining/employee-joining.ts`
- Modify: `frontend/src/app/pages/employee/site-tagging/site-tagging.ts`
- Modify: `frontend/src/app/pages/employee/employee-sub-id/employee-sub-id.ts`
- Modify: `frontend/src/app/pages/employee/employee-attendance/employee-attendance.ts`
- Modify: `frontend/src/app/pages/employee/site-leave-entry/site-leave-entry.ts`
- Modify: `frontend/src/app/pages/employee/employee-ledger/employee-ledger.ts`
- Modify: `frontend/src/app/pages/employee/payment-list/payment-list.ts`

**Interfaces:**
- Consumes: `ApiService` (Task 1), `NotificationService` (Task 1), `AuthService` (Task 2)
- Produces: nothing (leaf pages)

**API mappings:**
| Component | Load | Create | Update | Delete |
|-----------|------|--------|--------|--------|
| EmployeeCategoryComponent | `GET /employee-categories` | `POST /employee-categories` | `PUT /employee-categories/:id` | `DELETE /employee-categories/:id` |
| RegisteredEmployeeRecordsComponent | `GET /employees` | — | `PUT /employees/:id` | `DELETE /employees/:id` |
| EmployeeJoiningComponent | `GET /employee-categories`, `GET /sites` (dropdowns) | `POST /employees` | — | — |
| SiteTaggingComponent | `GET /site-tagging`, `GET /employees`, `GET /sites` | `POST /site-tagging` | — | — |
| EmployeeSubIdComponent | `GET /employees/:id/sub-ids`, `GET /employees` | `POST /employees/:id/sub-ids` | — | — |
| EmployeeAttendanceComponent | `GET /attendance`, `GET /sites` | `POST /attendance` | — | — |
| SiteLeaveEntryComponent | `GET /site-leaves`, `GET /employees`, `GET /sites` | `POST /site-leaves` | — | — |
| EmployeeLedgerComponent | `GET /employee-ledger/:employeeId`, `GET /employees` | — | — | — |
| PaymentListComponent | `GET /payments?category=employee` | — | — | — |

- [ ] **Step 1: Wire `EmployeeCategoryComponent`**

Inject `ApiService`, `NotificationService`. Replace hardcoded categories array. On init: `api.get('/employee-categories')`. `addCategory()` calls `api.post('/employee-categories', {name})` or `api.put('/employee-categories/${id}', {name})` when editing. `deleteCategory()` calls `api.delete('/employee-categories/${id}')`. Refresh list after each mutation.

- [ ] **Step 2: Wire `RegisteredEmployeeRecordsComponent`**

Load `api.get('/employees')` on init. Display in table. Wire edit (inline or modal) to `PUT /employees/:id`. Wire delete to `DELETE /employees/:id` with confirmation dialog.

- [ ] **Step 3: Wire `EmployeeJoiningComponent`**

Load categories from `api.get('/employee-categories')` and sites from `api.get('/sites')` to populate dropdowns — replace hardcoded arrays. On form submit, call `api.post('/employees', body)` where body includes `name, father_name, aadhaar, phone, address, category_id, current_site_id, designation`. On success, show notification and reset form.

- [ ] **Step 4: Wire `SiteTaggingComponent`**

Load employees and sites for dropdowns. Load existing tags from `GET /site-tagging`. Create new tagging with `POST /site-tagging` sending `{employee_id, site_id, from_site, to_site, tagged_date}`.

- [ ] **Step 5: Wire `EmployeeSubIdComponent`**

Load employees for selection. On employee select, load sub-IDs: `GET /employees/:id/sub-ids`. Create sub-ID: `POST /employees/:id/sub-ids` with `{site_id, type, rate, salary_basis}`. Load sites for dropdown.

- [ ] **Step 6: Wire `EmployeeAttendanceComponent`**

Load sites for dropdown. Load attendance records: `GET /attendance` with optional query params `site_id`, `month`. Replace hardcoded records. `saveAttendance()` calls `POST /attendance` with each record's data. Handle bulk submission.

- [ ] **Step 7: Wire `SiteLeaveEntryComponent`**

Load employees and sites. Load leaves: `GET /site-leaves`. Create: `POST /site-leaves` with `{date, employee_id, site_id, reason}`.

- [ ] **Step 8: Wire `EmployeeLedgerComponent`**

Load employees for dropdown. On employee select, load ledger: `GET /employee-ledger/:employeeId`. Display credit/debit entries with running balance. Add date range filter as query params.

- [ ] **Step 9: Wire `PaymentListComponent`**

Load payments filtered by employee category: `GET /payments?category=employee`. Display in table with status badges.

- [ ] **Step 10: Verify build compiles and commit**

```
git commit -m "feat(frontend): wire all employee module pages to backend API"
```

---

### Task 6: Contractor & Supervisor Pages

**Files:**
- Modify: `frontend/src/app/pages/contractor/add-contractor/add-contractor.ts`
- Modify: `frontend/src/app/pages/contractor/site-order-entry/site-order-entry.ts`
- Modify: `frontend/src/app/pages/contractor/product-entry/product-entry.ts`
- Modify: `frontend/src/app/pages/contractor/contractor-ledger/contractor-ledger.ts`
- Modify: `frontend/src/app/pages/supervisor/add-supervisor/add-supervisor.ts`
- Modify: `frontend/src/app/pages/supervisor/site-tagging-supervisor/site-tagging-supervisor.ts`
- Modify: `frontend/src/app/pages/supervisor/supervisor-ledger/supervisor-ledger.ts`

**Interfaces:**
- Consumes: `ApiService` (Task 1), `NotificationService` (Task 1)
- Produces: nothing (leaf pages)

**API mappings:**
| Component | Load | Create | Update | Delete |
|-----------|------|--------|--------|--------|
| AddContractorComponent | `GET /contractors` | `POST /contractors` | `PUT /contractors/:id` | `DELETE /contractors/:id` |
| SiteOrderEntryComponent | `GET /purchase-orders`, `GET /contractors`, `GET /sites` | `POST /purchase-orders` (with items) | `PUT /purchase-orders/:id` | `DELETE /purchase-orders/:id` |
| ProductEntryComponent | `GET /stock-products` | `POST /stock-products` | — | — |
| ContractorLedgerComponent | `GET /ledger/contractor/:id`, `GET /contractors` | — | — | — |
| AddSupervisorComponent | `GET /supervisors` | `POST /supervisors` | `PUT /supervisors/:id` | `DELETE /supervisors/:id` |
| SiteTaggingSupervisorComponent | `GET /supervisor-site-tagging`, `GET /supervisors`, `GET /sites` | `POST /supervisor-site-tagging` | — | — |
| SupervisorLedgerComponent | `GET /ledger/supervisor/:id`, `GET /supervisors` | — | — | — |

- [ ] **Step 1: Wire `AddContractorComponent`**

Replace hardcoded contractors array. Load on init: `GET /contractors`. Create: `POST /contractors` with `{name, phone, email, pan, gst_number, category, address, tds_applicable, tds_percent}`. Map frontend field `company` → backend field `category`. Delete: `DELETE /contractors/:id`.

- [ ] **Step 2: Wire `SiteOrderEntryComponent`**

Load contractors (`GET /contractors`) and sites (`GET /sites`) for dropdowns. Load existing POs: `GET /purchase-orders`. Create: `POST /purchase-orders` with body including `items[]` array. Each item has `{product_id, name, hsn, unit, qty, price, gst_percent}`.

- [ ] **Step 3: Wire `ProductEntryComponent`**

Load products: `GET /stock-products`. Create: `POST /stock-products` with `{name, unit, hsn, category, gst_percent}`.

- [ ] **Step 4: Wire `ContractorLedgerComponent`**

Load contractors for dropdown. On select, load: `GET /ledger/contractor/:id`. Display payments with running balance.

- [ ] **Step 5: Wire `AddSupervisorComponent`**

Load supervisors: `GET /supervisors`. Create: `POST /supervisors` with `{name, contact, address, employee_id, assigned_site_id}` — note the backend also creates an auth user and profile for the supervisor. Load employees (`GET /employees`) and sites (`GET /sites`) for dropdowns. Update: `PUT /supervisors/:id`. Delete: `DELETE /supervisors/:id`.

- [ ] **Step 6: Wire `SiteTaggingSupervisorComponent`**

Load supervisors and sites. Load tags: relevant data from supervisors list. Create: `POST /supervisor-site-tagging`.

- [ ] **Step 7: Wire `SupervisorLedgerComponent`**

Load supervisors for dropdown. On select: `GET /ledger/supervisor/:id`.

- [ ] **Step 8: Verify build compiles and commit**

```
git commit -m "feat(frontend): wire contractor & supervisor pages to backend API"
```

---

### Task 7: Company Module Pages

**Files:**
- Modify: `frontend/src/app/pages/company/add-company/add-company.ts`
- Modify: `frontend/src/app/pages/company/balance-received/balance-received.ts`
- Modify: `frontend/src/app/pages/company/company-ledger/company-ledger.ts`
- Modify: `frontend/src/app/pages/company/company-loan-management/company-loan-management.ts`
- Modify: `frontend/src/app/pages/company/vehicle-management/vehicle-management.ts`
- Modify: `frontend/src/app/pages/company/income-expense-entry/income-expense-entry.ts`
- Modify: `frontend/src/app/pages/company/bank-statement/bank-statement.ts`
- Modify: `frontend/src/app/pages/sales/view-site/view-site.ts`

**Interfaces:**
- Consumes: `ApiService` (Task 1), `NotificationService` (Task 1)
- Produces: nothing (leaf pages)

**API mappings:**
| Component | Load | Create | Update | Delete |
|-----------|------|--------|--------|--------|
| AddCompanyComponent | `GET /companies` | `POST /companies` | `PUT /companies/:id` | `DELETE /companies/:id` |
| BalanceReceivedComponent | `GET /balance-received`, `GET /invoices` | `POST /balance-received` | — | — |
| CompanyLedgerComponent | `GET /ledger/company/:id`, `GET /companies` | — | — | — |
| CompanyLoanManagementComponent | `GET /loans` | `POST /loans` | `PUT /loans/:id` | — |
| CompanyLoanManagementComponent (EMIs) | `GET /loans/:id/emis` | `POST /loans/:id/emis` | — | — |
| VehicleManagementComponent | `GET /vehicles` | `POST /vehicles` | `PUT /vehicles/:id` | `DELETE /vehicles/:id` |
| VehicleManagementComponent (service) | `GET /vehicles/:id/service-logs` | `POST /vehicles/:id/service-logs` | — | — |
| IncomeExpenseEntryComponent | `GET /income-expenses` | `POST /income-expenses` | `PUT /income-expenses/:id` | `DELETE /income-expenses/:id` |
| BankStatementComponent | `GET /banks` | — | — | — |
| ViewSiteComponent | `GET /sites` | `POST /sites` | `PUT /sites/:id` | `DELETE /sites/:id` |

- [ ] **Step 1: Wire `AddCompanyComponent`**

Replace hardcoded companies. Load: `GET /companies`. Create: `POST /companies` with `{name, phone, email, gst_number, address, custom_fields}`. Map frontend `companyType` → backend `custom_fields.type` (JSONB). Delete: `DELETE /companies/:id`.

- [ ] **Step 2: Wire `BalanceReceivedComponent`**

Load invoices for dropdown: `GET /invoices`. Load balance received records: `GET /balance-received`. Create: `POST /balance-received` with `{invoice_id, date, entry_type, amount, tds_amount, payment_method, reference_number, remarks}`.

- [ ] **Step 3: Wire `CompanyLedgerComponent`**

Load companies for dropdown. On select: `GET /ledger/company/:id`. Display invoices and balance-received with running totals.

- [ ] **Step 4: Wire `CompanyLoanManagementComponent`**

Load loans: `GET /loans`. Show reminders: `GET /loans/reminders`. Create loan: `POST /loans`. View EMIs: `GET /loans/:id/emis`. Add EMI payment: `POST /loans/:id/emis`.

- [ ] **Step 5: Wire `VehicleManagementComponent`**

Load vehicles: `GET /vehicles`. Create: `POST /vehicles`. Update: `PUT /vehicles/:id`. Delete: `DELETE /vehicles/:id`. Service logs: `GET /vehicles/:id/service-logs` and `POST /vehicles/:id/service-logs`. Load sites for assigned_site_id dropdown.

- [ ] **Step 6: Wire `IncomeExpenseEntryComponent`**

Load entries: `GET /income-expenses`. Create: `POST /income-expenses`. Update: `PUT /income-expenses/:id`. Delete: `DELETE /income-expenses/:id`. Load head allotments for the purpose dropdown: `GET /settings/heads`.

- [ ] **Step 7: Wire `BankStatementComponent`**

Load banks: `GET /banks`. Display bank details and balances. This is a read-only view.

- [ ] **Step 8: Wire `ViewSiteComponent`**

Load sites: `GET /sites`. Create: `POST /sites` with `{name, company_id, address}`. Load companies for dropdown: `GET /companies`. Update: `PUT /sites/:id`. Delete: `DELETE /sites/:id`.

- [ ] **Step 9: Verify build compiles and commit**

```
git commit -m "feat(frontend): wire company module pages (companies, loans, vehicles, income/expense, sites)"
```

---

### Task 8: Sales & Purchase Module Pages

**Files:**
- Modify: `frontend/src/app/pages/sales/invoice-entry/invoice-entry.ts`
- Modify: `frontend/src/app/pages/sales/purchase-order-entry/purchase-order-entry.ts`
- Modify: `frontend/src/app/pages/purchase/add-retailer/add-retailer.ts`
- Modify: `frontend/src/app/pages/purchase/retail-site-invoice/retail-site-invoice.ts`
- Modify: `frontend/src/app/pages/purchase/gst-report/gst-report.ts`
- Modify: `frontend/src/app/pages/purchase/non-gst-report/non-gst-report.ts`
- Modify: `frontend/src/app/pages/purchase/retail-ledger/retail-ledger.ts`

**Interfaces:**
- Consumes: `ApiService` (Task 1), `NotificationService` (Task 1)
- Produces: nothing (leaf pages)

**API mappings:**
| Component | Load | Create | Update | Delete |
|-----------|------|--------|--------|--------|
| InvoiceEntryComponent | `GET /invoices`, `GET /companies`, `GET /sites`, `GET /purchase-orders` | `POST /invoices` | `PUT /invoices/:id` | `DELETE /invoices/:id` |
| PurchaseOrderEntryComponent | `GET /purchase-orders`, `GET /retailers`, `GET /sites` | `POST /purchase-orders` (with items) | `PUT /purchase-orders/:id` | `DELETE /purchase-orders/:id` |
| AddRetailerComponent | `GET /retailers`, `GET /retailer-categories`, `GET /sites` | `POST /retailers` | `PUT /retailers/:id` | `DELETE /retailers/:id` |
| RetailSiteInvoiceComponent | `GET /retailer-bills`, `GET /retailers`, `GET /sites` | `POST /retailer-bills` (with items) | `PUT /retailer-bills/:id` | `DELETE /retailer-bills/:id` |
| GstReportComponent | `GET /retailer-bills/gst-report` | — | — | — |
| NonGstReportComponent | `GET /retailer-bills/non-gst-report` | — | — | — |
| RetailLedgerComponent | `GET /ledger/retailer/:id`, `GET /retailers` | — | — | — |

- [ ] **Step 1: Wire `InvoiceEntryComponent`**

Load companies, sites, and POs for dropdowns. Load existing invoices: `GET /invoices`. Create: `POST /invoices` with `{po_id, company_id, site_name, date, base_amount, gst_amount, is_gst}`. Backend computes `gross_amount`. Remove local total calculation — keep UI calculation for display but send `base_amount` and `gst_amount` to API.

- [ ] **Step 2: Wire `PurchaseOrderEntryComponent`**

Load retailers and sites for dropdowns. Load POs: `GET /purchase-orders`. Create with line items: `POST /purchase-orders` with `{date, site_id, retailer_id, items: [{product_id, name, hsn, unit, qty, price, gst_percent}]}`. Backend computes totals.

- [ ] **Step 3: Wire `AddRetailerComponent`**

Load retailer categories: `GET /retailer-categories`. Load sites: `GET /sites`. Load retailers: `GET /retailers`. Create: `POST /retailers` with `{category_id, name, phone, address, gst_status, gst_number, site_id}`. CRUD pattern.

- [ ] **Step 4: Wire `RetailSiteInvoiceComponent`**

Load retailers and sites. Load bills: `GET /retailer-bills`. Create bill with items: `POST /retailer-bills`. Each item includes `{item, qty, unit, price, gst_percent, add_to_stock}`.

- [ ] **Step 5: Wire `GstReportComponent` and `NonGstReportComponent`**

Read-only. Load: `GET /retailer-bills/gst-report` and `GET /retailer-bills/non-gst-report` respectively. Display in table.

- [ ] **Step 6: Wire `RetailLedgerComponent`**

Load retailers for dropdown. On select: `GET /ledger/retailer/:id`.

- [ ] **Step 7: Verify build compiles and commit**

```
git commit -m "feat(frontend): wire sales & purchase pages (invoices, POs, retailers, bills, GST reports)"
```

---

### Task 9: Payment & Stock & Mobilization Pages

**Files:**
- Modify: `frontend/src/app/pages/payment/all-type-payment/all-type-payment.ts`
- Modify: `frontend/src/app/pages/payment/payment-view/payment-view.ts`
- Modify: `frontend/src/app/pages/stock/stock-view/stock-view.ts`
- Modify: `frontend/src/app/pages/stock/current-stock/current-stock.ts`
- Modify: `frontend/src/app/pages/stock/stock-transfer/stock-transfer.ts`
- Modify: `frontend/src/app/pages/stock/stock-report/stock-report.ts`
- Modify: `frontend/src/app/pages/mobilization/add-equipment/add-equipment.ts`
- Modify: `frontend/src/app/pages/mobilization/site-order-equipment/site-order-equipment.ts`
- Modify: `frontend/src/app/pages/mobilization/equipment-leave/equipment-leave.ts`
- Modify: `frontend/src/app/pages/mobilization/site-tagging-equipment/site-tagging-equipment.ts`

**Interfaces:**
- Consumes: `ApiService` (Task 1), `NotificationService` (Task 1)
- Produces: nothing (leaf pages)

**API mappings:**
| Component | API Endpoints |
|-----------|--------------|
| AllTypePaymentComponent | `GET /payments`, `POST /payments`, `GET /payment-modes`, `GET /banks`, `GET /sites` |
| PaymentViewComponent | `GET /payments` (read-only view with filters) |
| StockViewComponent | `GET /stock-products` |
| CurrentStockComponent | `GET /site-inventory`, `GET /sites` |
| StockTransferComponent | `GET /stock-transfers`, `POST /stock-transfers`, `GET /sites`, `GET /stock-products` |
| StockReportComponent | `GET /damaged-stocks`, `POST /damaged-stocks`, `GET /stock-products`, `GET /sites` |
| AddEquipmentComponent | `GET /equipment`, `POST /equipment`, `PUT /equipment/:id`, `DELETE /equipment/:id`, `GET /equipment-categories` |
| SiteOrderEquipmentComponent | `GET /equipment-site-assignments`, `POST /equipment-site-assignments`, `GET /equipment`, `GET /sites` |
| EquipmentLeaveComponent | `GET /equipment-site-assignments` (filter released), `GET /equipment` |
| SiteTaggingEquipmentComponent | `GET /equipment-site-assignments`, `GET /equipment`, `GET /sites` |

- [ ] **Step 1: Wire `AllTypePaymentComponent`**

Load payment modes (`GET /payment-modes`), banks (`GET /banks`), sites (`GET /sites`) for dropdowns. Load payments: `GET /payments`. Create: `POST /payments` with `{date, category, party_id, party_name, party_type, site_id, amount, tds_percentage, payment_mode_id, bank_id, remarks}`. Backend computes `tds_amount` and `net_amount`. Add category filter (employee, contractor, retailer, supervisor).

- [ ] **Step 2: Wire `PaymentViewComponent`**

Read-only. Load: `GET /payments` with query filters for date range, category, status. Display with status badges. Wire update (`PUT /payments/:id`) and void (`DELETE /payments/:id`) for admin.

- [ ] **Step 3: Wire stock pages (`StockViewComponent`, `CurrentStockComponent`, `StockTransferComponent`, `StockReportComponent`)**

`StockViewComponent`: Load `GET /stock-products`. Display product catalog.
`CurrentStockComponent`: Load `GET /site-inventory` with site filter. Display quantities per site.
`StockTransferComponent`: Load sites, products. Create transfer: `POST /stock-transfers` with `{date, from_site_id, to_site_id, items: [{product_id, quantity, unit}]}`. Backend validates stock and adjusts inventory.
`StockReportComponent`: Load damaged stocks: `GET /damaged-stocks`. Create: `POST /damaged-stocks` with `{date, product_id, site_id, quantity, unit, reason}`.

- [ ] **Step 4: Wire mobilization pages**

`AddEquipmentComponent`: Load categories (`GET /equipment-categories`). CRUD equipment parties: `GET/POST/PUT/DELETE /equipment`.
`SiteOrderEquipmentComponent`: Load equipment and sites. Create assignment: `POST /equipment-site-assignments`.
`EquipmentLeaveComponent`: Display released assignments from `GET /equipment-site-assignments` filtered by released status.
`SiteTaggingEquipmentComponent`: Display current assignments from `GET /equipment-site-assignments`.

- [ ] **Step 5: Verify build compiles and commit**

```
git commit -m "feat(frontend): wire payment, stock, mobilization pages to backend API"
```

---

### Task 10: Report & Document Pages

**Files:**
- Modify: `frontend/src/app/pages/reports/mobilization-report/mobilization-report.ts`
- Modify: `frontend/src/app/pages/reports/employee-report/employee-report.ts`
- Modify: `frontend/src/app/pages/reports/contractor-report/contractor-report.ts`
- Modify: `frontend/src/app/pages/reports/company-report/company-report.ts`
- Modify: `frontend/src/app/pages/reports/supervisor-report/supervisor-report.ts`
- Modify: `frontend/src/app/pages/reports/sales-report/sales-report.ts`
- Modify: `frontend/src/app/pages/reports/purchase-report/purchase-report.ts`
- Modify: `frontend/src/app/pages/reports/gst-bill-download/gst-bill-download.ts`
- Modify: `frontend/src/app/pages/reports/non-gst-bill-download/non-gst-bill-download.ts`
- Modify: `frontend/src/app/pages/reports/full-site-ledger/full-site-ledger.ts`
- Modify: `frontend/src/app/pages/documents/create-doc-list/create-doc-list.ts`
- Modify: `frontend/src/app/pages/documents/backup/backup.ts`

**Interfaces:**
- Consumes: `ApiService` (Task 1), `NotificationService` (Task 1)
- Produces: nothing (leaf pages)

**API mappings:**
| Component | API Endpoints |
|-----------|--------------|
| MobilizationReportComponent | `GET /reports/mobilization` |
| EmployeeReportComponent | `GET /employees` (with filters) |
| ContractorReportComponent | `GET /contractors` (with filters) |
| CompanyReportComponent | `GET /companies` (with filters) |
| SupervisorReportComponent | `GET /supervisors` (with filters) |
| SalesReportComponent | `GET /reports/sales` |
| PurchaseReportComponent | `GET /purchase-orders` (with filters) |
| GstBillDownloadComponent | `GET /retailer-bills/gst-report` |
| NonGstBillDownloadComponent | `GET /retailer-bills/non-gst-report` |
| FullSiteLedgerComponent | `GET /reports/site-ledger`, `GET /sites` |
| CreateDocListComponent | `GET /document-folders`, `POST /document-folders`, `DELETE /document-folders/:id`, `GET /documents`, `POST /documents`, `GET /documents/:id/download`, `DELETE /documents/:id` |
| BackupComponent | `POST /backup/export`, `POST /backup/import` |

- [ ] **Step 1: Wire report pages**

All report pages follow the same pattern: load data on init, display in a read-only table with filters (date range, site, entity). Each page loads its data from the corresponding API endpoint. Add `loading` and `error` signals.

`MobilizationReportComponent`: `GET /reports/mobilization` with optional `site_id` and `date_from`/`date_to` query params.
`SalesReportComponent`: `GET /reports/sales` with optional `fiscal_year` param.
`FullSiteLedgerComponent`: `GET /reports/site-ledger` with `site_id` and `month` params. Load sites for dropdown.

Entity report pages (`Employee`, `Contractor`, `Company`, `Supervisor`): load the entity list from their respective endpoints with search/filter params and display summary data.

`GstBillDownloadComponent` and `NonGstBillDownloadComponent`: same as the purchase GST/non-GST report pages but with download functionality — for now, just display the data (PDF export can be a future enhancement).
`PurchaseReportComponent`: `GET /purchase-orders` with date/site filters.

- [ ] **Step 2: Wire `CreateDocListComponent`**

Load folders: `GET /document-folders`. Create folder: `POST /document-folders` with `{name, site_id}`. Delete folder: `DELETE /document-folders/:id`. Load documents per folder: `GET /documents?folder_id=X`. Upload document: `POST /documents` with `{name, folder_id, site_id, file_data (base64), file_type, file_size, description}`. Download: `GET /documents/:id/download` — backend returns a signed URL, open in new tab. Delete document: `DELETE /documents/:id`.

- [ ] **Step 3: Wire `BackupComponent`**

Export: call `POST /backup/export`. Backend returns all table data as JSON. Trigger browser download of the JSON response as a `.json` file using `Blob` + `URL.createObjectURL`. Import: file input that reads a JSON file, then calls `POST /backup/import` with the parsed JSON body. Show progress/status via notifications.

- [ ] **Step 4: Verify build compiles and commit**

```
git commit -m "feat(frontend): wire report, document, backup pages to backend API"
```

---

### Task 11: CORS & Proxy Configuration

**Files:**
- Create: `frontend/proxy.conf.json`
- Modify: `frontend/angular.json` (add proxyConfig to serve)
- Modify: `backend/server.js` (tighten CORS for production)

**Interfaces:**
- Consumes: everything above
- Produces: working dev proxy so `ng serve` on port 4200 proxies `/api/*` to backend on port 3000

- [ ] **Step 1: Create `frontend/proxy.conf.json`**

```json
{
  "/api": {
    "target": "http://localhost:3000",
    "secure": false,
    "changeOrigin": true
  }
}
```

- [ ] **Step 2: Update `angular.json` serve configuration**

Add `"proxyConfig": "proxy.conf.json"` under `architect.serve.options`.

- [ ] **Step 3: Update `environment.ts` and `environment.development.ts`**

Development: `apiUrl: '/api'` (uses proxy). Production: `apiUrl: 'http://localhost:3000/api'` (or deploy URL).

- [ ] **Step 4: Verify end-to-end**

Start backend: `cd backend && npm start`. Start frontend: `cd frontend && npx ng serve`. Navigate to `http://localhost:4200/login`. Log in with seed credentials (`admin@atr.com` / `Admin@123`). Verify dashboard loads real KPI data. Navigate to Employee Category, create a category, verify it persists across page refresh.

- [ ] **Step 5: Commit**

```
git commit -m "feat: add dev proxy config and finalize frontend-backend integration"
```
