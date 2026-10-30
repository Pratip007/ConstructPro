'use client';

import React from 'react';
import styles from './SummaryCards.module.scss';

export interface SummaryCard {
  title: string;
  value: string | number;
  icon?: string;
  color?: string;
  prefix?: string;
  suffix?: string;
  trend?: 'up' | 'down';
}

interface SummaryCardsProps {
  cards: SummaryCard[];
}

function formatNumber(val: string | number): string {
  if (typeof val === 'string') return val;
  if (val == null) return '0';
  return val.toLocaleString('en-IN');
}

export default function SummaryCards({ cards }: SummaryCardsProps) {
  const colorMap: Record<string, string> = {
    success: styles.cardSuccess, danger: styles.cardDanger,
    warning: styles.cardWarning, info: styles.cardInfo, primary: styles.cardPrimary,
  };

  return (
    <div className={styles.grid}>
      {cards.map(card => (
        <div key={card.title} className={`${styles.card} ${colorMap[card.color || 'primary'] || styles.cardPrimary}`}>
          <div className={styles.iconArea}>{card.icon && <i className={card.icon}></i>}</div>
          <div className={styles.content}>
            <span className={styles.title}>{card.title}</span>
            <span className={styles.value}>
              {card.prefix && <span className={styles.prefix}>{card.prefix}</span>}
              {formatNumber(card.value)}
              {card.suffix && <span className={styles.suffix}>{card.suffix}</span>}
              {card.trend && (
                <i className={card.trend === 'up' ? `ri-arrow-up-line ${styles.trendUp}` : `ri-arrow-down-line ${styles.trendDown}`}></i>
              )}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
