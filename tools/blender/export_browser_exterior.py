"""Stage a checked local browser scene and GLB. Does not publish assets."""
from pathlib import Path
from datetime import datetime
from zoneinfo import ZoneInfo
import bpy,bmesh,argparse,json,sys,re,hashlib
from mathutils import Matrix

parser=argparse.ArgumentParser();parser.add_argument('--source',required=True);parser.add_argument('--report',required=True);parser.add_argument('--scene',required=True);parser.add_argument('--output',required=True)
args=parser.parse_args(sys.argv[sys.argv.index('--')+1:]);OUT=Path(args.output).resolve();OUT.mkdir(parents=True,exist_ok=True)
report=json.loads(Path(args.report).read_text());assert not report['critical_defects']
sha=lambda p:hashlib.sha256(Path(p).read_bytes()).hexdigest()
assert report['source_file_sha256']==sha(args.source),'Source does not match checked generation'
bpy.ops.wm.open_mainfile(filepath=str(Path(args.source).resolve()))
names=[];matrices={}
for ob in bpy.context.scene.objects:
    if ob.type!='MESH' or not ob.data.polygons:continue
    collections={c.name for c in ob.users_collection}
    structural_fixture=bool(re.search(r'-rod-\d+$',ob.name) or ob.name=='ST_spiral-center-column')
    if ob.get('collisionProxy') or collections&{'Interior lighting','Navigation markers','Collision proxies'} or ('Fixtures' in collections and not structural_fixture):continue
    names.append(ob.name);matrices[ob.name]=[list(r) for r in ob.matrix_world]
bpy.ops.wm.open_mainfile(filepath=str(Path(args.scene).resolve()))
scene=bpy.context.scene
canonical={m.name:m for m in bpy.data.materials}
for ob in list(scene.objects):
    if ob.name.startswith('home-'):bpy.data.objects.remove(ob,do_unlink=True)
with bpy.data.libraries.load(str(Path(args.source).resolve()),link=False) as (_,data):data.objects=list(names)
opaque=[];glazing=[]
role_materials={}
for original,ob in zip(names,data.objects):
    scene.collection.objects.link(ob);ob.parent=None;ob.matrix_world=Matrix(matrices[original]);ob.data=ob.data.copy()
    is_door=original.startswith(('D1_','D2_','D3_','DF1_','DF2_','DF3_'))
    for slot in ob.material_slots:
        source=slot.material;name=re.sub(r'\.\d{3}$','',source.name)
        role={'garage-window':'glass','garage-frame':'black','garage-panel':'black'}.get(name,name)
        if is_door and role in ['joinery','black']:role='door-paint' if role=='joinery' else 'door-frame'
        if role in ['siding','siding-wide','siding-board']:
            # Use the regenerated smooth FC material, not the older lap maps.
            if role not in role_materials:role_materials[role]=source
            slot.material=role_materials[role]
        elif role in ['door-paint','door-frame']:
            if role not in role_materials:role_materials[role]=canonical['joinery' if role=='door-paint' else 'black'].copy()
            slot.material=role_materials[role]
        else:
            assert role in canonical,('Unknown role',role,original)
            slot.material=canonical[role]
    (glazing if all(re.sub(r'\.\d{3}$','',m.name)=='glass' for m in ob.data.materials) else opaque).append(ob)
for role,material in role_materials.items():
    # The old, unused same-name material must not force a suffix into GLB roles.
    previous=bpy.data.materials.get(role)
    if previous and previous!=material:previous.name='superseded-'+role
    material.name=role
bpy.context.view_layer.update()

def join(objects,name):
    bpy.ops.object.select_all(action='DESELECT')
    for ob in objects:ob.select_set(True)
    bpy.context.view_layer.objects.active=objects[0]
    if len(objects)>1:bpy.ops.object.join()
    ob=bpy.context.object;ob.name=name
    bm=bmesh.new();bm.from_mesh(ob.data);bad=[f for f in bm.faces if f.calc_area()<1e-10]
    if bad:bmesh.ops.delete(bm,geom=bad,context='FACES_ONLY')
    bm.to_mesh(ob.data);bm.free();ob.data.update()
    assert all(p.area>=1e-10 and len(set(p.vertices))==len(p.vertices) for p in ob.data.polygons),name
    return ob

home=join(opaque,'home-opaque');glass=join(glazing,'home-glass')
bpy.ops.object.select_all(action='DESELECT');home.select_set(True);bpy.context.view_layer.objects.active=home
while len(home.data.uv_layers)>1:home.data.uv_layers.remove(home.data.uv_layers[-1])
uv=home.data.uv_layers.new(name='Lightmap');home.data.uv_layers.active=uv
bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.uv.smart_project(angle_limit=1.15,island_margin=.002,margin_method='FRACTION',area_weight=0,correct_aspect=True,scale_to_bounds=True)
bpy.ops.object.mode_set(mode='OBJECT');home.data.uv_layers.active_index=0
print('HOME_UV_COMPLETE',flush=True)
# Every PBR image stays bound to UV0 when AO is generated from UV1.
for material in set(home.data.materials):
    if not material.use_nodes:continue
    nodes=material.node_tree.nodes;links=material.node_tree.links
    uvnode=nodes.get('VIEWER_PBR_UV0') or nodes.new('ShaderNodeUVMap');uvnode.name='VIEWER_PBR_UV0';uvnode.uv_map=home.data.uv_layers[0].name
    for node in list(nodes):
        if node.type=='TEX_IMAGE' and not node.inputs['Vector'].is_linked:links.new(uvnode.outputs['UV'],node.inputs['Vector'])
        if node.type=='NORMAL_MAP':node.uv_map=home.data.uv_layers[0].name
for image in bpy.data.images:
    if image.source=='FILE' and not image.packed_file:image.pack()
bpy.data.orphans_purge(do_local_ids=True,do_linked_ids=True,do_recursive=True)
assert not [item for item in bpy.data.user_map() if item.library]
for library in list(bpy.data.libraries):bpy.data.libraries.remove(library)
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type=='VIEW_3D':area.spaces.active.clip_start=.05;area.spaces.active.clip_end=250
stamp=datetime.now(ZoneInfo('America/New_York')).strftime('%Y-%m-%d_%H-%M-%S_%Z')
blend=OUT/f'home-viewer_repaired_{stamp}.blend';bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(blend),compress=True)
bpy.ops.object.select_all(action='DESELECT');home.select_set(True);glass.select_set(True);bpy.context.view_layer.objects.active=home
glb=OUT/'exterior-home.raw.glb'
bpy.ops.export_scene.gltf(filepath=str(glb),export_format='GLB',use_selection=True,export_yup=True,export_apply=True,export_extras=False,export_cameras=False,export_lights=False,export_animations=False,export_materials='EXPORT')
result={'source_sha256':sha(args.source),'viewer':str(blend),'viewer_sha256':sha(blend),'raw_glb':str(glb),'raw_glb_sha256':sha(glb),'authoring_source':str(Path(args.source).resolve()),'source_geometry_sha256':report['canonical_geometry_sha256'],'critical_defects':[],'uv_island_margin':.002,'ao_bake_margin_pixels':4,'ao_resolution':4096,'retained':'Site, trees, sun, environment, interior shell. Furniture and source references excluded.'}
(OUT/'export-report.json').write_text(json.dumps(result,indent=2))
print('BROWSER_EXPORT_STAGED',glb,flush=True)
