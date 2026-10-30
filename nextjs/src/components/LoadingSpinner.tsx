'use client';

import React from 'react';

interface LoadingSpinnerProps {
  message?: string;
}

export default function LoadingSpinner({ message }: LoadingSpinnerProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 20px',
        gap: 14,
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          border: '3px solid var(--border-color)',
          borderTopColor: 'var(--accent)',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
        }}
      />
      {message && (
        <span
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--text-muted)',
          }}
        >
          {message}
        </span>
      )}
    </div>
  );
}
