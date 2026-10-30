const { calculateOT } = require('../../src/services/otCalculation');

test('Per Day: 800/day, 5 days, 4 OT hrs → wage 4000, otRate 100, ot 400, total 4400', () => {
  const r = calculateOT('Per Day', 800, 5, 4);
  expect(r.presentWage).toBe(4000);
  expect(r.otRatePerHr).toBe(100);
  expect(r.otAmount).toBe(400);
  expect(r.totalAmount).toBe(4400);
});

test('Monthly: 500/day, 26 days, 10 OT hrs → ot always 0, total 13000', () => {
  const r = calculateOT('Monthly', 500, 26, 10);
  expect(r.otAmount).toBe(0);
  expect(r.totalAmount).toBe(13000);
});

test('Per Day with 0 otHours → otAmount 0, not NaN', () => {
  const r = calculateOT('Per Day', 800, 5, 0);
  expect(r.otAmount).toBe(0);
  expect(r.totalAmount).toBe(4000);
});

test('Per Day with fractional wage: 750/day, 3 days, 2 OT hrs → rounded', () => {
  const r = calculateOT('Per Day', 750, 3, 2);
  expect(r.presentWage).toBe(2250);
  expect(r.otRatePerHr).toBe(93.75);
  expect(r.otAmount).toBe(188); // Math.round(93.75 * 2)
  expect(r.totalAmount).toBe(2438);
});
