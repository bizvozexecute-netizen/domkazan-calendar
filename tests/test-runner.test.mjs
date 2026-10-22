import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync,rmdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';

test('integration command propagates test failures and cannot pass after a killed or unstarted child',()=>{
  const directory=mkdtempSync(join(tmpdir(),'domkazan-runner-'));
  const hook=join(directory,'child-outcomes.mjs');
  // Intercept only the child's subprocess boundary: no Prisma or DB is started.
  writeFileSync(hook,`import childProcess from 'node:child_process';
import {syncBuiltinESMExports} from 'node:module';
let calls=0;
childProcess.spawnSync=()=>++calls<3?{status:0}:JSON.parse(process.env.SYNTHETIC_CHILD_OUTCOME);
syncBuiltinESMExports();`);
  try{
    for(const [outcome,expected] of [[{status:0},0],[{status:7},7],[{status:null,signal:'SIGTERM'},1],[{status:null,error:{code:'ENOENT'}},1]]){
      const result=spawnSync(process.execPath,['--import',pathToFileURL(hook).href,'scripts/test-integration.mjs'],{
        env:{...process.env,DATABASE_URL:'postgresql://synthetic:synthetic@localhost/unused',TEST_DATABASE_URL:'postgresql://synthetic:synthetic@localhost/runner_test',SYNTHETIC_CHILD_OUTCOME:JSON.stringify(outcome)},
        encoding:'utf8',timeout:10000,
      });
      assert.equal(result.status,expected,result.stderr);
    }
  }finally{rmSync(hook,{force:true});rmdirSync(directory);}
});
