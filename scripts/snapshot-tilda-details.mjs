import { writeFile } from 'node:fs/promises';
import { loadCatalog } from '../ops/tilda-test-gateway/lib/catalog.js';
const catalog = await loadCatalog();
await writeFile(new URL('../data/tilda-catalog-details.json', import.meta.url), `${JSON.stringify(catalog, null, 2)}\n`);
console.log(`Public Tilda details: ${catalog.products.length} homes; no client or occupancy records.`);
