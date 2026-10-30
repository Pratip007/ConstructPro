import { Component, signal, inject, HostListener, PLATFORM_ID, OnInit } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ThemeService } from '../../core/services/theme.service';
import { AuthService } from '../../core/services/auth.service';
import { ApprovalService } from '../../core/services/approval.service';
import { ApiService } from '../../core/services/api.service';

@Component({
  selector: 'app-supervisor-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './supervisor-layout.html',
  styleUrl: './supervisor-layout.scss',
})
export class SupervisorLayoutComponent implements OnInit {
  sidebarHidden = signal(false);
  profileMenuOpen = signal(false);
  notifMenuOpen = signal(false);
  openTrees = signal<Set<string>>(new Set());
  readonly isMobile = signal(false);

  notifCount = signal(0);
  assignedSiteName = signal('');
  supervisorId = signal('');

  private readonly platformId = inject(PLATFORM_ID);
  private readonly api = inject(ApiService);
  private readonly approvals = inject(ApprovalService);

  constructor(
    public theme: ThemeService,
    public auth: AuthService
  ) {
    if (isPlatformBrowser(this.platformId) && window.innerWidth < 768) {
      this.sidebarHidden.set(true);
      this.isMobile.set(true);
    }
  }

  ngOnInit(): void {
    this.loadSupervisorInfo();
    this.loadNotificationCount();
  }

  private loadSupervisorInfo(): void {
    const user = this.auth.currentUser();
    if (user) {
      this.supervisorId.set(user.displayId || String(user.id) || '');
      this.api.get<any>(`/supervisors/${user.id}/site`).subscribe({
        next: (data) => this.assignedSiteName.set(data?.siteName || data?.site_name || ''),
        error: () => {},
      });
    }
  }

  private loadNotificationCount(): void {
    this.approvals.getPendingCounts().subscribe({
      next: (counts) => this.notifCount.set(counts.supervisor ?? counts.total ?? 0),
      error: () => {},
    });
  }

  toggleSidebar(): void {
    this.sidebarHidden.update((v) => !v);
  }

  toggleProfileMenu(event: Event): void {
    event.stopPropagation();
    this.notifMenuOpen.set(false);
    this.profileMenuOpen.update((v) => !v);
  }

  toggleNotification(event: Event): void {
    event.stopPropagation();
    this.profileMenuOpen.set(false);
    this.notifMenuOpen.update((v) => !v);
  }

  closeDropdowns(): void {
    this.profileMenuOpen.set(false);
    this.notifMenuOpen.set(false);
  }

  toggleTree(treeId: string): void {
    this.openTrees.update((trees) => {
      const next = new Set(trees);
      if (next.has(treeId)) {
        next.delete(treeId);
      } else {
        next.add(treeId);
      }
      return next;
    });
  }

  isTreeOpen(treeId: string): boolean {
    return this.openTrees().has(treeId);
  }

  logout(): void {
    this.auth.logout();
  }

  @HostListener('window:resize')
  onResize(): void {
    const mobile = window.innerWidth < 768;
    this.isMobile.set(mobile);
    if (mobile && !this.sidebarHidden()) {
      this.sidebarHidden.set(true);
    }
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.closeDropdowns();
  }
}
