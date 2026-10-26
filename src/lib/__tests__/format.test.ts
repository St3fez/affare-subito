import { formatCurrency, parseFlexibleNumber, toNumber } from "../format";

test("parseFlexibleNumber legge i formati italiani", () => {
  expect(parseFlexibleNumber("1.250.000")).toBe(1250000);
  expect(parseFlexibleNumber("41,8")).toBe(41.8);
  expect(parseFlexibleNumber("3.950 €/m²")).toBe(3950);
  expect(parseFlexibleNumber("€ 267/mese")).toBe(267);
  expect(parseFlexibleNumber("")).toBe(0);
});

test("toNumber", () => expect(toNumber("1.234,56")).toBe(1234.56));

test("formatCurrency raggruppa le migliaia all'italiana", () => {
  expect(formatCurrency(1234567)).toMatch(/^1\.234\.567\s?€$/);
  expect(formatCurrency(12345)).toMatch(/^12\.345\s?€$/);
});

test("formatCurrency non raggruppa i numeri a quattro cifre (regola italiana)", () => {
  expect(formatCurrency(1234)).toMatch(/^1234\s?€$/);
});
