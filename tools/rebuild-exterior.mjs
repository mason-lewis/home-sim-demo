/** Rebuild private authoring files and stage a gated browser house.
 * node tools/rebuild-exterior.mjs configuration.local.json [--promote]
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {runtimeAssets} from './runtime-assets.mjs';
const configPath=process.argv[2];if(!configPath)throw Error('Pass a private configuration.local.json');
const config=JSON.parse(await fs.readFile(configPath,'utf8'));
for(const key of ['blender','baseline','house','scene','workRoot'])if(!config[key])throw Error('Missing private configuration: '+key);
const out=path.resolve(config.workRoot,new Date().toISOString().replaceAll(':','-')),evidence=path.join(out,'evidence');await fs.mkdir(evidence,{recursive:true});
function run(executable,args){const r=spawnSync(executable,args,{stdio:'inherit'});if(r.status!==0)throw Error(`${path.basename(executable)} failed (${r.status})`);}
const read=async file=>JSON.parse(await fs.readFile(file,'utf8'));
function blender(script,args){run(config.blender,['--background','--factory-startup','--disable-autoexec','--python','tools/blender/'+script,'--',...args]);}
for(const index of [1,2])blender('regenerate_exterior.py',['--source',config.baseline,'--house',config.house,'--output',path.join(out,'source-'+index)]);
const first=await read(path.join(out,'source-1/current.json')),second=await read(path.join(out,'source-2/current.json'));
const a=await read(first.report),b=await read(second.report);
const regeneration={same_geometry:a.canonical_geometry_sha256===b.canonical_geometry_sha256,same_generated_count:a.generated_object_count===b.generated_object_count,generated_objects:a.generated_object_count,geometry_sha256:a.canonical_geometry_sha256,critical_defects:[...a.critical_defects,...b.critical_defects]};
if(!regeneration.same_geometry||!regeneration.same_generated_count||regeneration.critical_defects.length)throw Error('Regeneration gate failed');
const regenerationPath=path.join(evidence,'regeneration.json');await fs.writeFile(regenerationPath,JSON.stringify(regeneration,null,2));
const exportDir=path.join(out,'export');blender('export_browser_exterior.py',['--source',first.source,'--report',first.report,'--scene',config.scene,'--output',exportDir]);
const reportPath=path.join(exportDir,'export-report.json'),report=await read(reportPath),packed=path.join(exportDir,'exterior-home.glb'),decoded=path.join(exportDir,'decoded-geometry.json'),measurePath=path.join(evidence,'measurements.json');
run(process.execPath,['tools/pack-house.mjs',report.raw_glb,reportPath,packed]);run(process.execPath,['tools/inspect-export-geometry.mjs',packed,decoded]);
blender('measure_exterior.py',['--source',first.source,'--baseline',config.baseline,'--house',config.house,'--browser',decoded,'--output',measurePath]);
const measure=await read(measurePath);if(measure.critical_defects.length||measure.invalid_meshes.length||measure.missing_dependencies.length)throw Error('Measurement/dependency gate failed');
const stage=path.join(out,'runtime');
for(const file of runtimeAssets){await fs.mkdir(path.dirname(path.join(stage,file)),{recursive:true});await fs.copyFile('public/browser-demo/'+file,path.join(stage,file));}
await fs.copyFile(packed,path.join(stage,'models/exterior-home.glb'));
run(process.execPath,['tools/bake-occlusion.mjs',config.blender,stage,'--home-only']);
blender('finalize_viewer.py',['--source',first.source,'--viewer',report.viewer,'--ao',path.join(stage,'lighting/home-ao.webp'),'--output',exportDir]);
const verification=await read(path.join(exportDir,'verification.json'));
const current={source:first.source,viewer:verification.final_viewer,report:first.report,evidence,stage,measurePath,regenerationPath,visual_review_required:true};
await fs.writeFile(path.join(out,'current.json'),JSON.stringify(current,null,2));
if(process.argv.includes('--promote')){
 run(process.execPath,['tools/promote-exterior.mjs',stage,measurePath,regenerationPath]);run(process.execPath,['tools/refresh-demo-manifest.mjs']);
}
console.log(JSON.stringify(current,null,2));
console.log('Numeric gates passed. Complete fixed-view and orbit visual review before accepting this run.');
