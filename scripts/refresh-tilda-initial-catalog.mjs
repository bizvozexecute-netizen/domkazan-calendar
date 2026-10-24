import {writeFile} from 'node:fs/promises';
import {loadCatalog} from '../ops/tilda-test-gateway/lib/catalog.js';
// Only sanitized public descriptions/media. Availability and customer records
// are never part of this first-paint cache; Tilda remains the content editor.
const catalog=await loadCatalog();
await writeFile(new URL('../data/tilda-catalog-initial.json',import.meta.url),JSON.stringify(catalog)+'\n','utf8');
console.log(`Refreshed public first-paint metadata: ${catalog.products.length} homes. No Tilda changes.`);
