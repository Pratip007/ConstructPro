import { Injectable } from '@angular/core';

export interface TdsBreakdown {
  tdsAmount: number;
  netAmount: number;
}

@Injectable({ providedIn: 'root' })
export class TdsService {

  calculateTds(grossAmount: number, tdsPercentage: number): TdsBreakdown {
    const tdsAmount = Math.round(grossAmount * tdsPercentage / 100 * 100) / 100;
    return {
      tdsAmount,
      netAmount: Math.round((grossAmount - tdsAmount) * 100) / 100,
    };
  }
}
