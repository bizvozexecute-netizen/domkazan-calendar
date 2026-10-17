import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Public catalog facts only. Do not copy descriptions, contacts, or HomeReserve links.
const source = 'https://store.tildaapi.com/api/getproductslist/?storepartuid=213912569062&recid=4148990801&getparts=true&getoptions=true&size=100';
const output = fileURLToPath(new URL('../data/tilda-catalog-public.json', import.meta.url));

function plain(value) {
  return String(value ?? '').replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<[^>]*>/g, ' ').replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&').replace(/\u00a0/g, ' ');
}

function price(text, label) {
  const match = text.match(new RegExp(`${label}\\s*[-–—:]?\\s*([\\d\\s]+)\\s*(?:₽|руб)`, 'iu'));
  return match ? Number(match[1].replace(/\s/g, '')) : null;
}

function capacity(text) {
  const match = text.match(/вместимост[ьи]?\s*(?:до\s*)?(\d+)\s*гост/iu);
  return match ? Number(match[1]) : null;
}

const response = await fetch(source, { signal: AbortSignal.timeout(30000) });
if (!response.ok) throw new Error(`Tilda catalog returned HTTP ${response.status}`);
const data = await response.json();
if (!Array.isArray(data.products) || data.products.length !== data.total || data.total < 60) {
  throw new Error('Unexpected Tilda catalog shape or product count.');
}
const products = data.products.map((product) => {
  const text = plain(product.descr);
  const uid = String(product.uid);
  const tildaUrl = String(product.url ?? '');
  if (!/^\d+$/.test(uid) || !tildaUrl.startsWith(`https://domkazan116.ru/tproduct/${uid}-`)) {
    throw new Error(`Unexpected UID or URL: ${uid}`);
  }
  return {
    productUid: uid, name: String(product.title ?? '').trim(), tildaUrl,
    maxGuests: capacity(text),
    publicBaseRates: {
      weekday: price(text, 'будни'), friday: price(text, 'пятница'),
      saturday: price(text, 'суббота'), sunday: price(text, 'воскресенье'),
    },
  };
});
if (new Set(products.map((product) => product.productUid)).size !== products.length) {
  throw new Error('Duplicate Tilda Product UID.');
}
const snapshot = {
  source, capturedAt: new Date().toISOString(),
  caveat: 'Published catalog metadata only. Prices may omit guest supplements, service fees, seasonality and owner changes. No live occupancy is included.',
  products,
};
await mkdir(dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
const missingCapacity = products.filter((product) => !product.maxGuests);
const missingRates = products.filter((product) => Object.values(product.publicBaseRates).some((rate) => !rate));
console.log(`Snapshot: ${products.length} products, missing capacity ${missingCapacity.length}, missing base rates ${missingRates.length}.`);
if (missingCapacity.length) console.log(`Capacity review: ${missingCapacity.map((p) => p.productUid).join(', ')}`);
if (missingRates.length) console.log(`Rate review: ${missingRates.map((p) => p.productUid).join(', ')}`);
