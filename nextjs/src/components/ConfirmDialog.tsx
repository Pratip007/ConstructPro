'use client';

import React from 'react';
import { useConfirmDialog } from '@/contexts/ConfirmDialogContext';
import ModalDialog from './ModalDialog';
import styles from './ConfirmDialog.module.scss';

export default function ConfirmDialog() {
  const { isVisible, options, passwordValue, setPasswordValue, doConfirm, doCancel } = useConfirmDialog();

  if (!options) return null;

  const iconClass =
    options.type === 'danger' ? 'ri-error-warning-fill'
    : options.type === 'info' ? 'ri-information-fill'
    : 'ri-alert-fill';

  const iconColorClass =
    options.type === 'danger' ? styles.iconDanger
    : options.type === 'info' ? styles.iconInfo
    : styles.iconWarning;

  const footer = (
    <>
      <button className="btn-secondary" onClick={doCancel}>
        {options.cancelText || 'Cancel'}
      </button>
      <button
        className={options.type === 'danger' ? 'btn-danger' : 'btn-primary'}
        onClick={doConfirm}
        disabled={options.passwordRequired ? !passwordValue : false}
      >
        {options.confirmText || 'Confirm'}
      </button>
    </>
  );

  return (
    <ModalDialog isOpen={isVisible} title={options.title} size="sm" onClose={doCancel} footer={footer}>
      <div className={styles.body}>
        <div className={`${styles.icon} ${iconColorClass}`}>
          <i className={iconClass}></i>
        </div>
        <p className={styles.message}>{options.message}</p>
        {options.passwordRequired && (
          <div className={styles.passwordField}>
            <label>{options.passwordLabel || 'Admin Password'}</label>
            <input
              type="password"
              value={passwordValue}
              onChange={e => setPasswordValue(e.target.value)}
              placeholder="Enter password to confirm"
              onKeyDown={e => e.key === 'Enter' && doConfirm()}
              autoComplete="off"
            />
          </div>
        )}
      </div>
    </ModalDialog>
  );
}
