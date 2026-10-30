import {
  Injectable, ApplicationRef, ComponentRef,
  createComponent, EnvironmentInjector
} from '@angular/core';
import {
  ConfirmDialogComponent,
  ConfirmOptions,
  ConfirmResult
} from '../../shared/confirm-dialog/confirm-dialog.component';

@Injectable({ providedIn: 'root' })
export class ConfirmDialogService {
  private componentRef: ComponentRef<ConfirmDialogComponent> | null = null;

  constructor(
    private appRef: ApplicationRef,
    private injector: EnvironmentInjector
  ) {}

  private ensureComponent(): ConfirmDialogComponent {
    if (!this.componentRef) {
      this.componentRef = createComponent(ConfirmDialogComponent, {
        environmentInjector: this.injector
      });
      this.appRef.attachView(this.componentRef.hostView);
      document.body.appendChild(this.componentRef.location.nativeElement);
    }
    return this.componentRef.instance;
  }

  confirm(options: ConfirmOptions): Promise<boolean> {
    const comp = this.ensureComponent();
    return comp.show({ ...options, passwordRequired: false })
      .then(r => r.confirmed);
  }

  confirmWithPassword(options: ConfirmOptions): Promise<ConfirmResult> {
    const comp = this.ensureComponent();
    return comp.show({ ...options, passwordRequired: true });
  }
}
