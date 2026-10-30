'use client';

import React, { useEffect, useCallback, ReactNode } from 'react';
import styles from './ModalDialog.module.scss';

export interface ModalDialogProps {
  isOpen?: boolean;
  title?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  closeOnBackdrop?: boolean;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  showCloseButton?: boolean;
  onConfirm?: () => void;
  confirmText?: string;
  cancelText?: string;
  [extra: string]: any;
}

export default function ModalDialog({
  isOpen,
  title = '',
  size = 'md',
  closeOnBackdrop = true,
  onClose,
  children,
  footer,
  showCloseButton = true,
  onConfirm,
  confirmText,
  cancelText,
}: ModalDialogProps) {
  const handleEscape = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape' && isOpen) onClose();
  }, [isOpen, onClose]);

  useEffect(() => {
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [handleEscape]);

  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (isOpen === false) return null;

  const sizeMap: Record<string, string> = {
    sm: styles.modalSm, md: styles.modalMd, lg: styles.modalLg, xl: styles.modalXl,
  };

  return (
    <div className={styles.backdrop} onClick={() => closeOnBackdrop && onClose()}>
      <div className={`${styles.container} ${sizeMap[size] || styles.modalMd}`} onClick={e => e.stopPropagation()}>
        {(title || showCloseButton) && (
          <div className={styles.header}>
            {title ? <h3 className={styles.title}>{title}</h3> : <span />}
            {showCloseButton && (
              <button className={styles.closeBtn} onClick={onClose} aria-label="Close modal">
                <i className="ri-close-line"></i>
              </button>
            )}
          </div>
        )}
        <div className={styles.body}>{children}</div>
        {(footer || onConfirm) && (
          <div className={styles.footer}>
            {footer || (
              <>
                <button className="btn-secondary" onClick={onClose}>{cancelText || 'Cancel'}</button>
                <button className="btn-primary" onClick={onConfirm}>{confirmText || 'Confirm'}</button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
