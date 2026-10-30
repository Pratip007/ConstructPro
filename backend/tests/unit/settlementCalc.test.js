const { calculateSettlement } = require('../../src/services/settlementCalc');

test('50000 due, 30000 paid → 20000 remaining, not settled', () => {
  const r = calculateSettlement(50000, 30000);
  expect(r.remaining).toBe(20000);
  expect(r.isFullySettled).toBe(false);
});

test('50000 due, 50000 paid → 0 remaining, fully settled', () => {
  const r = calculateSettlement(50000, 50000);
  expect(r.remaining).toBe(0);
  expect(r.isFullySettled).toBe(true);
});
