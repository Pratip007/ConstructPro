import { Component, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService, PortalType } from '../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class LoginComponent {
  email = signal('');
  password = signal('');
  showPassword = signal(false);
  errorMessage = signal('');
  successMessage = signal('');
  loading = signal(false);
  portalType = signal<PortalType>('admin');

  readonly portalOptions: { value: PortalType; label: string }[] = [
    { value: 'admin', label: 'Admin Portal' },
    { value: 'office', label: 'Office Portal' },
    { value: 'employee', label: 'Employee Portal' },
    { value: 'supervisor', label: 'Supervisor Portal' },
  ];

  readonly emailLabel = computed(() => {
    const labels: Record<PortalType, string> = {
      admin: 'Email',
      office: 'Office ID',
      employee: 'Employee ID',
      supervisor: 'Supervisor ID',
    };
    return labels[this.portalType()];
  });

  readonly emailPlaceholder = computed(() => {
    const placeholders: Record<PortalType, string> = {
      admin: 'Enter your email address',
      office: 'Enter your Office ID',
      employee: 'Enter your Employee ID',
      supervisor: 'Enter your Supervisor ID',
    };
    return placeholders[this.portalType()];
  });

  readonly passwordLabel = computed(() =>
    this.portalType() === 'employee' ? 'Aadhaar Number' : 'Password'
  );

  readonly passwordPlaceholder = computed(() =>
    this.portalType() === 'employee' ? 'XXXX XXXX XXXX' : '••••••••'
  );

  readonly isEmployeePortal = computed(() => this.portalType() === 'employee');

  readonly emailIcon = computed(() => {
    const icons: Record<PortalType, string> = {
      admin: 'ri-mail-line',
      office: 'ri-building-4-line',
      employee: 'ri-user-line',
      supervisor: 'ri-shield-user-line',
    };
    return icons[this.portalType()];
  });

  constructor(private auth: AuthService) {}

  togglePasswordVisibility(): void {
    this.showPassword.update((v) => !v);
  }

  onPortalChange(portal: string): void {
    this.portalType.set(portal as PortalType);
    this.email.set('');
    this.password.set('');
    this.errorMessage.set('');
    this.successMessage.set('');
  }

  formatAadhaar(event: Event): void {
    const input = event.target as HTMLInputElement;
    let digits = input.value.replace(/\D/g, '');
    if (digits.length > 12) digits = digits.slice(0, 12);
    const parts: string[] = [];
    for (let i = 0; i < digits.length; i += 4) {
      parts.push(digits.slice(i, i + 4));
    }
    const formatted = parts.join(' ');
    this.password.set(formatted);
    input.value = formatted;
  }

  onSubmit(): void {
    const emailVal = this.email().trim();
    const passVal = this.portalType() === 'employee'
      ? this.password().replace(/\s/g, '')
      : this.password();

    if (!emailVal || !passVal) {
      this.errorMessage.set('ACCESS DENIED: All fields are required.');
      return;
    }

    if (this.portalType() === 'employee' && passVal.length !== 12) {
      this.errorMessage.set('ACCESS DENIED: Aadhaar number must be 12 digits.');
      return;
    }

    this.errorMessage.set('');
    this.successMessage.set('');
    this.loading.set(true);

    this.auth.login(emailVal, passVal, this.portalType()).subscribe({
      next: () => {
        this.loading.set(false);
        this.successMessage.set('ACCESS GRANTED: Redirecting to your portal...');
      },
      error: (err: Error) => {
        this.loading.set(false);
        this.errorMessage.set(err.message || 'Login failed. Please check your credentials.');
      },
    });
  }
}
