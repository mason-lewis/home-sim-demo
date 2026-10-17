/** Promote only the checked house and its AO; preserve every other runtime asset. */
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
const [stage,measurePath,regenerationPath]=process.argv.slice(2);
if(!regenerationPath)throw Error('Pass staged runtime directory, measurements.json, regeneration.json');
const measure=JSON.parse(await fs.readFile(measurePath,'utf8')),regen=JSON.parse(await fs.readFile(regenerationPath,'utf8'));
if(measure.critical_defects.length||measure.missing_dependencies.length||measure.invalid_meshes.length||!measure.rows.length||measure.rows.some(r=>r.status!=='PASS'))throw Error('Dimensional or dependency gate failed');
if(!regen.same_geometry||!regen.same_generated_count||regen.critical_defects.length)throw Error('Regeneration gate failed');
const asset=await fs.readFile(stage+'/models/exterior-home.glb');
if(createHash('sha256').update(asset).digest('hex')!==measure.browser_sha256)throw Error('The measured export does not match the staged asset');
for(const file of ['models/exterior-home.glb','lighting/home-ao.webp'])await fs.copyFile(stage+'/'+file,'public/browser-demo/'+file);
console.log('Promoted the measured house and its regenerated contact occlusion.');
