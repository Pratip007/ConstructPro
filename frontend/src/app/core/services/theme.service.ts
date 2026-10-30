import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly storageKey = 'atr_theme';
  currentTheme = signal<'dark' | 'light'>(this.getSavedTheme());

  constructor() {
    window.addEventListener('storage', (e) => {
      if (e.key === this.storageKey && e.newValue) {
        this.applyTheme(e.newValue as 'dark' | 'light', false);
      }
    });
  }

  toggleTheme(): void {
    const newTheme = this.currentTheme() === 'dark' ? 'light' : 'dark';
    this.applyTheme(newTheme);
  }

  private applyTheme(theme: 'dark' | 'light', save = true): void {
    this.currentTheme.set(theme);
    document.documentElement.setAttribute('data-theme', theme);
    if (save) {
      localStorage.setItem(this.storageKey, theme);
    }
  }

  private getSavedTheme(): 'dark' | 'light' {
    return (localStorage.getItem(this.storageKey) as 'dark' | 'light') || 'dark';
  }
}
