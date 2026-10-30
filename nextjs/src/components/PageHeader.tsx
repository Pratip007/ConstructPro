'use client';

import React from 'react';

export interface PageHeaderProps {
  title: string;
  icon?: string;
  children?: React.ReactNode;
}

export default function PageHeader({ title, icon, children }: PageHeaderProps) {
  return (
    <div className="page-header">
      <h1>
        {icon && <i className={icon} />}
        {title}
      </h1>
      {children && <div className="header-actions">{children}</div>}
    </div>
  );
}
