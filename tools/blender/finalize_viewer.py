"""Pack the regenerated AO reference into a new dated demo authoring file."""
import bpy,json,sys,argparse,hashlib,math
from pathlib import Path
from datetime import datetime
from zoneinfo import ZoneInfo
parser=argparse.ArgumentParser()
for name in ['source','viewer','ao','output']:parser.add_argument('--'+name,required=True)
args=parser.parse_args(sys.argv[sys.argv.index('--')+1:]);out=Path(args.output);out.mkdir(parents=True,exist_ok=True)
checks=[]
for role,path in [('source',args.source),('viewer',args.viewer)]:
 bpy.ops.wm.open_mainfile(filepath=str(Path(path).resolve()))
 missing=[im.name for im in bpy.data.images if im.source=='FILE' and not im.packed_file]
 invalid=[o.name for o in bpy.context.scene.objects if o.type=='MESH' and any(p.area<1e-10 or len(set(p.vertices))!=len(p.vertices) for p in o.data.polygons)]
 finite=all(math.isfinite(c) for o in bpy.context.scene.objects if o.type=='MESH' for v in o.data.vertices for c in v.co)
 assert not missing and not invalid and finite and not bpy.data.libraries,(role,missing,invalid)
 checks.append({'role':role,'file':str(Path(path).resolve()),'unpacked_images':missing,'invalid_meshes':invalid,'finite':finite,'linked_libraries':len(bpy.data.libraries)})
# Old unconnected bake-reference nodes do not shade the model, but must not
# suggest that their UVs still correspond to the replaced house.
for material in bpy.data.materials:
 if material.use_nodes:
  for node in list(material.node_tree.nodes):
   if node.type=='TEX_IMAGE' and node.image and node.image.name.startswith('home-irradiance'):material.node_tree.nodes.remove(node)
for image in list(bpy.data.images):
 if image.name.startswith('home-irradiance'):image.use_fake_user=False
image=bpy.data.images.load(str(Path(args.ao).resolve()),check_existing=False);image.name='Repaired home contact occlusion - UV1';image.colorspace_settings.name='Non-Color';image.pack();image.use_fake_user=True
home=bpy.data.objects['home-opaque']
for material in set(home.data.materials):
 if not material.use_nodes:continue
 tree=material.node_tree;uv=tree.nodes.new('ShaderNodeUVMap');uv.uv_map='Lightmap';uv.label='AO UV1'
 node=tree.nodes.new('ShaderNodeTexImage');node.name='REPAIRED_CONTACT_AO_REFERENCE';node.label='Packed browser AO; live Cycles lighting remains physical';node.image=image;tree.links.new(uv.outputs[0],node.inputs['Vector'])
bpy.data.orphans_purge(do_local_ids=True,do_linked_ids=True,do_recursive=True)
stamp=datetime.now(ZoneInfo('America/New_York')).strftime('%Y-%m-%d_%H-%M-%S_%Z');path=out/f'home-viewer_repaired_{stamp}.blend';bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(path),compress=True)
image_name=image.name
bpy.ops.wm.open_mainfile(filepath=str(path))
assert bpy.data.images.get(image_name).packed_file
record={'files':checks,'final_viewer':str(path.resolve()),'ao_packed':True,'ao_sha256':hashlib.sha256(Path(args.ao).read_bytes()).hexdigest(),'landscape_sun_environment':'Retained from demo; house AO regenerated independently. Site AO unchanged.'}
(out/'verification.json').write_text(json.dumps(record,indent=2));print('FINAL_VIEWER',path,flush=True)
