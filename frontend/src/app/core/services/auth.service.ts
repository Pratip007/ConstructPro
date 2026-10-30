import { Injectable, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, map, tap } from 'rxjs';
import { ApiService } from './api.service';

export type PortalType = 'admin' | 'office' | 'employee' | 'supervisor';

export interface UserProfile {
  id: number;
  authUid: string;
  displayId: string;
  name: string;
  role: PortalType;
  siteId: number | null;
}

interface LoginApiResponse {
  access_token: string;
  refresh_token: string;
  user: {
    id: number;
    display_id: string;
    name: string;
    role: string;
    site_id: number | null;
    created_at: string;
  };
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly TOKEN_KEY = 'atr_access_token';
  private readonly REFRESH_KEY = 'atr_refresh_token';
  private readonly PORTAL_KEY = 'atr_current_logged_portal';
  private readonly USER_KEY = 'atr_current_logged_user';

  private readonly _currentUser = signal<UserProfile | null>(null);

  readonly currentUser = this._currentUser.asReadonly();
  readonly currentPortal = computed<PortalType | null>(() => this._currentUser()?.role ?? null);
  readonly isLoggedIn = computed(() => !!this._currentUser());

  private readonly ROLE_ROUTES: Record<PortalType, string> = {
    admin: '/admin',
    office: '/office',
    supervisor: '/supervisor',
    employee: '/admin/employee/employee-ledger',
  };

  constructor(
    private router: Router,
    private api: ApiService
  ) {
    this.loadStoredUser();
  }

  login(email: string, password: string, portalType?: PortalType): Observable<void> {
    return this.api
      .post<LoginApiResponse>('/auth/login', { email, password, portalType })
      .pipe(
        tap((res) => {
          localStorage.setItem(this.TOKEN_KEY, res.access_token);
          localStorage.setItem(this.REFRESH_KEY, res.refresh_token);

          const profile: UserProfile = {
            id: res.user.id,
            // authUid is the Supabase UUID — not returned by POST /auth/login;
            // GET /auth/me will populate it when that endpoint is wired up.
            authUid: '',
            displayId: res.user.display_id,
            name: res.user.name,
            role: res.user.role as PortalType,
            siteId: res.user.site_id,
          };

          localStorage.setItem(this.PORTAL_KEY, profile.role);
          localStorage.setItem(this.USER_KEY, JSON.stringify(profile));
          this._currentUser.set(profile);

          const route = this.ROLE_ROUTES[profile.role] ?? '/login';
          this.router.navigate([route]);
        }),
        map(() => undefined)
      );
  }

  logout(): void {
    Object.keys(localStorage)
      .filter((key) => key.startsWith('atr_'))
      .forEach((key) => localStorage.removeItem(key));

    this._currentUser.set(null);
    this.router.navigate(['/login']);
  }

  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  private loadStoredUser(): void {
    // Without a token, treat the session as expired and don't restore user state
    if (!localStorage.getItem(this.TOKEN_KEY)) return;

    const stored = localStorage.getItem(this.USER_KEY);
    if (!stored) return;

    try {
      const profile = JSON.parse(stored) as UserProfile;
      this._currentUser.set(profile);
    } catch {
      // Corrupted stored data — clear all atr_ keys silently
      Object.keys(localStorage)
        .filter((key) => key.startsWith('atr_'))
        .forEach((key) => localStorage.removeItem(key));
    }
  }
}
