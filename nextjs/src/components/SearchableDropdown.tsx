'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import styles from './SearchableDropdown.module.scss';

export interface DropdownItem {
  value: any;
  label: string;
}

export interface SearchableDropdownProps {
  items: DropdownItem[];
  value: any;
  onChange: (val: any) => void;
  placeholder?: string;
  label?: string;
  required?: boolean;
  disabled?: boolean;
  allowAdd?: boolean;
  onAddNew?: (...args: any[]) => any;
  onAdd?: (...args: any[]) => any;
  [extra: string]: any;
}

export default function SearchableDropdown({
  items, value, onChange, placeholder = 'Select...',
  label, required, disabled, allowAdd, onAddNew, onAdd,
  ...rest
}: SearchableDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [highlightIndex, setHighlightIndex] = useState(0);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const selectedLabel = useMemo(() => {
    if (value == null) return '';
    return items.find(i => i.value === value)?.label ?? '';
  }, [value, items]);

  const filteredItems = useMemo(() => {
    const text = searchText.toLowerCase();
    if (!text) return items;
    return items.filter(i => i.label.toLowerCase().includes(text));
  }, [items, searchText]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false); setSearchText('');
      }
    };
    document.addEventListener('click', handler, true);
    return () => document.removeEventListener('click', handler, true);
  }, []);

  const open = () => { if (disabled) return; setIsOpen(true); setSearchText(''); setHighlightIndex(0); };
  const close = () => { setIsOpen(false); setSearchText(''); };
  const select = (item: DropdownItem) => { onChange(item.value); close(); };
  const clear = (e: React.MouseEvent) => { e.stopPropagation(); onChange(null); };

  const onKeydown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown': e.preventDefault(); if (!isOpen) { open(); return; }
        setHighlightIndex(i => Math.min(i + 1, filteredItems.length - 1)); break;
      case 'ArrowUp': e.preventDefault(); setHighlightIndex(i => Math.max(i - 1, 0)); break;
      case 'Enter': e.preventDefault();
        if (isOpen && filteredItems[highlightIndex]) select(filteredItems[highlightIndex]); break;
      case 'Escape': close(); break;
    }
  };

  return (
    <div ref={wrapperRef} className={[styles.wrapper, disabled ? styles.disabled : ''].filter(Boolean).join(' ')}>
      {label && <label className={styles.label}>{label}{required && <span className={styles.req}>*</span>}</label>}
      <div className={styles.control} onClick={() => isOpen ? close() : open()}>
        <input type="text"
          className={`${styles.input} ${selectedLabel && !isOpen ? styles.hasValue : ''}`}
          placeholder={selectedLabel || placeholder}
          value={isOpen ? searchText : selectedLabel}
          disabled={disabled}
          onChange={e => { setSearchText(e.target.value); setHighlightIndex(0); }}
          onFocus={open} onKeyDown={onKeydown} autoComplete="off" />
        <span className={`${styles.arrow} ${isOpen ? styles.rotated : ''}`}>
          <i className="ri-arrow-down-s-line"></i></span>
        {selectedLabel && !disabled && (
          <span className={styles.clearBtn} onClick={clear}><i className="ri-close-line"></i></span>
        )}
      </div>
      {isOpen && (
        <div className={styles.menu}>
          {filteredItems.length === 0 && <div className={styles.empty}>No results found</div>}
          {filteredItems.map((item, i) => (
            <div key={item.value}
              className={[styles.item, i === highlightIndex ? styles.highlighted : '', item.value === value ? styles.selected : ''].filter(Boolean).join(' ')}
              onClick={() => select(item)} onMouseEnter={() => setHighlightIndex(i)}>
              {item.label}
            </div>
          ))}
          {allowAdd && (
            <div className={`${styles.item} ${styles.addNew}`} onClick={() => { (onAddNew ?? onAdd)?.(searchText); close(); }}>
              <i className="ri-add-line"></i> Add New
            </div>
          )}
        </div>
      )}
    </div>
  );
}
