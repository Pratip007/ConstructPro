'use client';

import React, { useState, useEffect } from 'react';
import styles from './ThemeToggle.module.scss';

export default function ThemeToggle() {
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('theme');
    if (stored) {
      setIsDark(stored === 'dark');
      document.documentElement.setAttribute('data-theme', stored);
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = isDark ? 'light' : 'dark';
    setIsDark(!isDark);
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
  };

  return (
    <button className={styles.toggle} onClick={toggleTheme} title={`Switch to ${isDark ? 'light' : 'dark'} mode`}>
      <i className={isDark ? 'ri-sun-line' : 'ri-moon-line'} />
    </button>
  );
}
