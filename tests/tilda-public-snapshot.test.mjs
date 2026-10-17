import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const snapshot = JSON.parse(readFileSync(new URL('../data/tilda-catalog-public.json', import.meta.url), 'utf8'));
const proposed = JSON.parse(readFileSync(new URL('../public/embed/tilda-house-mapping.proposed.json', import.meta.url), 'utf8'));

test('public Tilda snapshot matches the currently displayed Product UIDs', () => {
  const current = snapshot.products.map((product) => product.productUid);
  assert.equal(current.length, 63);
  assert.equal(new Set(current).size, current.length);
  assert.deepEqual(proposed.map((row) => row.productUid).filter((uid) => !current.includes(uid)), ['851186077552']);
  for (const product of snapshot.products) {
    assert.ok(proposed.some((row) => row.productUid === product.productUid));
    assert.match(product.tildaUrl, new RegExp(`^https://domkazan116\\.ru/tproduct/${product.productUid}-`));
    assert.ok(Object.values(product.publicBaseRates).every((price) => Number.isSafeInteger(price) && price > 0));
  }
  assert.deepEqual(snapshot.products.filter((product) => product.maxGuests === null).map((product) => product.productUid), ['920959845222']);
});
