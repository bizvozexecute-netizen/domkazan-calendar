import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdirSync,mkdtempSync,readFileSync,readdirSync,rmSync,writeFileSync} from 'node:fs';
import {dirname,join,relative,resolve,sep} from 'node:path';

const require=createRequire(import.meta.url);
const pluginPath=require.resolve('@next/eslint-plugin-next');
const pluginRequire=createRequire(pluginPath);
const {getRootDirs}=pluginRequire('./utils/get-root-dirs.js');
const posix=value=>value.replaceAll('\\','/');

function fixture(run){
  const root=mkdtempSync(join(process.cwd(),'.local-eslint-'));
  try{
    for(const file of ['apps/one/app/page.tsx','apps/two/pages/about.tsx','apps/.hidden/app/page.tsx']){
      const target=join(root,file);mkdirSync(dirname(target),{recursive:true});writeFileSync(target,'export default function Page() {return null;}');
    }
    return run(root);
  }finally{
    // Recursive cleanup is restricted to the generated fixture inside this checkout.
    assert.ok(resolve(root).startsWith(resolve(process.cwd())+sep+'.local-eslint-'));
    rmSync(root,{recursive:true,force:true});
  }
}

test('Next ESLint discovers the same default, literal, glob, array and Windows roots',()=>fixture(root=>{
  const base=posix(root);
  const cases=[
    [undefined,[base]],
    [`${base}/apps`,[`${base}/apps`]],
    [`${base}/apps/one`,[`${base}/apps/one`]],
    [`${base}/apps/*`,[`${base}/apps/one`,`${base}/apps/two`]],
    [`${base}/apps/{one,two}`,[`${base}/apps/one`,`${base}/apps/two`]],
    [[`${base}/apps/one`,`${base}/apps/two`],[`${base}/apps/one`,`${base}/apps/two`]],
    [`${base}/apps/missing`,[]],
    [`${base}/apps/two/pages/about.tsx`,[]],
    [posix(relative(process.cwd(),join(root,'apps/one'))),[posix(relative(process.cwd(),join(root,'apps/one')))]],
    [`${base}\\apps\\one`,[`${base}/apps/one`]],
  ];
  for(const [rootDir,expected] of cases){
    const actual=getRootDirs({cwd:root,settings:{next:{rootDir}}});
    assert.deepEqual(actual.map(posix).sort(),expected.sort(),JSON.stringify(rootDir));
  }
}));

test('actual Next internal-link rule still reports violations in App and Pages routers',()=>fixture(root=>{
  const {Linter}=require('eslint');const plugin=require('@next/eslint-plugin-next');const base=posix(root);
  for(const [rootDir,url] of [[`${base}/apps/one`,'/'],[`${base}/apps/two`,'/about'],[`${base}/apps/*`,'/about'],[[`${base}/apps/one`,`${base}/apps/two`],'/']]){
    const messages=new Linter().verify(`const Page = () => <a href="${url}">House</a>;`,[{
      languageOptions:{parserOptions:{ecmaVersion:2022,ecmaFeatures:{jsx:true}}},
      plugins:{'@next/next':plugin},settings:{next:{rootDir}},rules:{'@next/next/no-html-link-for-pages':'error'},
    }]);
    assert.equal(messages.length,1);assert.equal(messages[0].ruleId,'@next/next/no-html-link-for-pages');assert.equal(messages[0].severity,2);
  }
}));

test('scoped adapter is used only by the audited Next plugin version and call site',()=>{
  assert.equal(pluginRequire('../package.json').version,'16.4.0');
  assert.equal(pluginRequire('fast-glob'),require('../tooling/next-eslint-glob/index.js'));
  const consumers=[];
  function walk(dir){for(const item of readdirSync(dir,{withFileTypes:true})){const path=join(dir,item.name);if(item.isDirectory())walk(path);else if(item.name.endsWith('.js')&&readFileSync(path,'utf8').includes('require("fast-glob")'))consumers.push(posix(path));}}
  walk(dirname(pluginPath));
  assert.equal(consumers.length,1);assert.ok(consumers[0].endsWith('/utils/get-root-dirs.js'));
  const source=readFileSync(consumers[0],'utf8');assert.match(source,/_fastglob\.globSync/);assert.match(source,/onlyDirectories:\s*true/);
});

test('replacement rejects excessive nesting, long patterns and unexpected consumer options',()=>{
  const {globSync}=pluginRequire('fast-glob');
  assert.throws(()=>globSync('{'.repeat(1000)+'x'+'}'.repeat(1000),{onlyDirectories:true}),/deeply nested/);
  assert.throws(()=>globSync('x'.repeat(4097),{onlyDirectories:true}),/too long/);
  assert.throws(()=>globSync('src',{onlyDirectories:true,absolute:true}),/Unsupported/);
  assert.throws(()=>globSync(['src'],{onlyDirectories:true}),/Unsupported/);
});

test('lockfile removes vulnerable braces and micromatch instead of hiding their audit',()=>{
  const lock=JSON.parse(readFileSync(new URL('../package-lock.json',import.meta.url),'utf8'));
  assert.equal(Object.keys(lock.packages).some(path=>/node_modules\/(braces|micromatch)$/.test(path)),false);
  assert.deepEqual(Object.entries(lock.packages).filter(([,pkg])=>pkg.dependencies?.['fast-glob']).map(([path])=>path),['node_modules/@next/eslint-plugin-next']);
  // Windows npm can prune these optional cross-platform records even during a
  // lock-only update. Their absence breaks clean Linux/Node 22 installations.
  for(const name of ['core','runtime'])assert.ok(lock.packages[`node_modules/@emnapi/${name}`]?.version,`Retain @emnapi/${name} for Linux installs`);
});
