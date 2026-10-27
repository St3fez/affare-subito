import { manualListing, readListing } from "../index";

test("readListing", () => {
  expect(readListing({ kind: "nextData", json: "<html>captcha</html>" })).toBeNull();
  expect(readListing({ kind: "text", text: "boh" })).toBeNull();
  expect(readListing({ kind: "text", text: "Bilocale Roma 249.000 € 48 m²" })?.price).toBe(249000);
});

test("manualListing", () => {
  const input = { price: 1, sqm: 2, city: "A", province: "B", condition: null };
  const first = manualListing(input);
  expect(first.source).toBe("manual");
  expect(manualListing(input).listingKey).toBe(first.listingKey);
  expect(manualListing({ ...input, price: 9 }).listingKey).not.toBe(first.listingKey);
});
