import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {expect,test} from 'vitest';

test('the export gate refuses confirmed critical defects before touching output',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'facade-gate-'));
 try{
  const report=join(dir,'report.json');
  await writeFile(report,JSON.stringify({critical_defects:['exposed duplicate wall: fixture-wall']}));
  const result=spawnSync(process.execPath,['tools/pack-house.mjs','missing.glb',report,join(dir,'must-not-exist.glb')],{encoding:'utf8'});
  expect(result.status).not.toBe(0);expect(result.stderr).toContain('Critical geometry gate failed');
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('promotion refuses an unresolved dimensional comparison',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'facade-measurement-gate-'));
 try{
  await writeFile(join(dir,'measure.json'),JSON.stringify({critical_defects:['door width mismatch'],rows:[{status:'FAIL'}]}));
  await writeFile(join(dir,'regen.json'),'{}');
  const result=spawnSync(process.execPath,['tools/promote-exterior.mjs',dir,join(dir,'measure.json'),join(dir,'regen.json')],{encoding:'utf8'});
  expect(result.status).not.toBe(0);expect(result.stderr).toContain('Dimensional or dependency gate failed');
 }finally{await rm(dir,{recursive:true,force:true});}
});
