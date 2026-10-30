const { calculateTDS } = require('../../src/services/tdsCalculation');

test('TDS 2% on 100000 → tds 2000, net 98000', () => {
  const r = calculateTDS(100000, 2);
  expect(r.tdsAmount).toBe(2000);
  expect(r.netAmount).toBe(98000);
});

test('TDS 0% → net equals gross exactly', () => {
  const r = calculateTDS(50000, 0);
  expect(r.tdsAmount).toBe(0);
  expect(r.netAmount).toBe(50000);
});

test('TDS 1.5% on 75000 → tds 1125, net 73875', () => {
  const r = calculateTDS(75000, 1.5);
  expect(r.tdsAmount).toBe(1125);
  expect(r.netAmount).toBe(73875);
});
