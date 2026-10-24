import {readFile,writeFile,copyFile} from 'node:fs/promises';

// Defaults have one editable source; the plain-script distribution has no bundler.
const defaults=JSON.parse(await readFile(new URL('../src/config/client-ui-defaults.json',import.meta.url),'utf8'));
const searchPath=new URL('../public/embed/domkazan-search.js',import.meta.url);
const search=await readFile(searchPath,'utf8');
if(!/  const defaultUi = .*?;\r?\n/.test(search))throw new Error('Widget defaults marker not found');
await writeFile(searchPath,search.replace(/  const defaultUi = .*?;\r?\n/,`  const defaultUi = ${JSON.stringify(defaults)};\n`));
for(const name of ['domkazan-search.js','domkazan-catalog.js','domkazan-tilda.js','domkazan-test-bootstrap.js'])
  await copyFile(new URL(`../public/embed/${name}`,import.meta.url),new URL(`../ops/tilda-test-gateway/public/embed/${name}`,import.meta.url));
console.log('Widget defaults and test gateway assets synchronized. No external changes.');
