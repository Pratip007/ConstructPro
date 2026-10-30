import { Injectable, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { ApiService } from './api.service';
import { AuthService, PortalType } from './auth.service';

@Injectable({ providedIn: 'root' })
export class RoleService {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);

  private readonly _menuAllotments = signal<string[]>([]);
  readonly menuAllotments = this._menuAllotments.asReadonly();

  getCurrentRole(): PortalType {
    return this.auth.currentUser()?.role ?? 'employee';
  }

  isAdmin(): boolean {
    return this.getCurrentRole() === 'admin';
  }

  isOffice(): boolean {
    return this.getCurrentRole() === 'office';
  }

  isSupervisor(): boolean {
    return this.getCurrentRole() === 'supervisor';
  }

  isEmployee(): boolean {
    return this.getCurrentRole() === 'employee';
  }

  canEdit(): boolean {
    if (this.isAdmin()) return true;
    return this._menuAllotments().length > 0;
  }

  canDelete(): boolean {
    return this.isAdmin();
  }

  getSupervisorSiteId(): number | null {
    if (!this.isSupervisor()) return null;
    return this.auth.currentUser()?.siteId ?? null;
  }

  lockedSiteId(): number | null {
    return this.getSupervisorSiteId();
  }

  isSiteLocked(): boolean {
    return this.isSupervisor() && this.getSupervisorSiteId() !== null;
  }

  loadMenuAllotments(): Observable<string[]> {
    const userId = this.auth.currentUser()?.id;
    if (!userId) return new Observable(sub => { sub.next([]); sub.complete(); });
    return this.api.get<string[]>(`/settings/menus/${userId}`).pipe(
      tap(menus => this._menuAllotments.set(menus))
    );
  }

  hasMenuAccess(menuSlug: string): boolean {
    if (this.isAdmin()) return true;
    return this._menuAllotments().includes(menuSlug);
  }

  getRoleBadge(): { label: string; cssClass: string } {
    switch (this.getCurrentRole()) {
      case 'admin':
        return { label: 'Admin', cssClass: 'badge-success' };
      case 'office':
        return { label: 'Office', cssClass: 'badge-info' };
      case 'supervisor':
        return { label: 'Supervisor', cssClass: 'badge-warning' };
      case 'employee':
        return { label: 'Employee', cssClass: 'badge-secondary' };
    }
  }
}
