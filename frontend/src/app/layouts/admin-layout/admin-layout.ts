import { Component, signal, inject, HostListener, PLATFORM_ID, OnInit } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ThemeService } from '../../core/services/theme.service';
import { AuthService } from '../../core/services/auth.service';
import { ApprovalService } from '../../core/services/approval.service';

interface NotificationItem {
  icon: string;
  label: string;
  route: string;
}

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './admin-layout.html',
  styleUrl: './admin-layout.scss',
})
export class AdminLayoutComponent implements OnInit {
  private theme = inject(ThemeService);
  private auth = inject(AuthService);
  private approvals = inject(ApprovalService);

  sidebarHidden = signal(false);
  readonly isMobile = signal(false);

  constructor() {
    const platformId = inject(PLATFORM_ID);
    if (isPlatformBrowser(platformId) && window.innerWidth < 768) {
      this.sidebarHidden.set(true);
      this.isMobile.set(true);
    }
  }

  profileMenuOpen = signal(false);
  notifMenuOpen = signal(false);
  openTrees = signal<Set<string>>(new Set());

  profileImage = signal(
    localStorage.getItem('atr_admin_avatar') ||
      'https://ui-avatars.com/api/?name=Rahul+Sk&background=2b2b2b&color=ffc107'
  );

  notifCount = signal(0);
  notifItems = signal<NotificationItem[]>([]);

  currentUser = this.auth.currentUser;
  themeIcon = () => (this.theme.currentTheme() === 'dark' ? '🌓' : '☀️');

  ngOnInit(): void {
    this.loadNotifications();
  }

  private loadNotifications(): void {
    this.approvals.getPendingCounts().subscribe({
      next: (counts) => {
        const total = counts.total ?? (counts.office + counts.supervisor);
        this.notifCount.set(total);

        const items: NotificationItem[] = [];
        if (counts.office > 0) {
          items.push({ icon: 'ri-building-4-line', label: `${counts.office} Office Requests`, route: 'approval/approve-office' });
        }
        if (counts.supervisor > 0) {
          items.push({ icon: 'ri-shield-star-line', label: `${counts.supervisor} Supervisor Requests`, route: 'approval/approve-supervisor' });
        }
        if (total === 0) {
          items.push({ icon: 'ri-checkbox-circle-line', label: 'No pending approvals', route: 'approval/approval-logs' });
        }
        this.notifItems.set(items);
      },
      error: () => {},
    });
  }

  toggleSidebar(): void {
    this.sidebarHidden.update((v) => !v);
  }

  toggleTheme(): void {
    this.theme.toggleTheme();
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

  toggleTreeMenu(treeId: string): void {
    this.openTrees.update((set) => {
      const next = new Set(set);
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

  closeDropdowns(): void {
    this.profileMenuOpen.set(false);
    this.notifMenuOpen.set(false);
  }

  logout(): void {
    this.auth.logout();
  }

  onProfileImageChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.[0]) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      this.profileImage.set(result);
      try {
        localStorage.setItem('atr_admin_avatar', result);
      } catch {}
    };
    reader.readAsDataURL(input.files[0]);
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.closeDropdowns();
  }

  @HostListener('window:resize')
  onResize(): void {
    const mobile = window.innerWidth < 768;
    this.isMobile.set(mobile);
    if (mobile && !this.sidebarHidden()) {
      this.sidebarHidden.set(true);
    }
  }
}
