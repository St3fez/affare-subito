import { monthlyPayment } from "../mortgage";

test("monthlyPayment", () => {
  expect(monthlyPayment(200000, 3.5, 25)).toBeCloseTo(1001.25, 2);
  expect(monthlyPayment(120000, 0, 10)).toBe(1000);
  expect(monthlyPayment(0, 3, 20)).toBe(0);
  expect(monthlyPayment(100000, 3, 0)).toBe(0);
});
