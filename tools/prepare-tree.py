"""Create a web derivative of Poly Haven's CC0 Jacaranda Tree glTF.
Usage: Blender --background --factory-startup --python tools/prepare-tree.py -- source.gltf output.glb
The source and intermediates stay outside the public directory.
"""
import bpy, sys
from pathlib import Path
args=sys.argv[sys.argv.index('--')+1:]
source=Path(args[0])
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(source))
for obj in list(bpy.context.scene.objects):
 if obj.type!='MESH': continue
 bpy.context.view_layer.objects.active=obj
 bpy.ops.object.select_all(action='DESELECT');obj.select_set(True)
 bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT')
 bpy.ops.mesh.separate(type='MATERIAL');bpy.ops.object.mode_set(mode='OBJECT')
for obj in list(bpy.context.scene.objects):
 if obj.type!='MESH':continue
 material=obj.data.materials[0]
 role='leaf' if 'leaves' in material.name else 'trunk' if 'trunk' in material.name else 'branch'
 obj.name='tree-'+role;material.name='tree-'+role
 target={'leaf':360000,'branch':45000,'trunk':18000}[role]
 triangles=sum(len(p.vertices)-2 for p in obj.data.polygons)
 bpy.context.view_layer.objects.active=obj
 bpy.ops.object.select_all(action='DESELECT');obj.select_set(True)
 if triangles>target:
  modifier=obj.modifiers.new('Web surface detail','DECIMATE')
  modifier.ratio=target/triangles;modifier.use_collapse_triangulate=True
  bpy.ops.object.modifier_apply(modifier=modifier.name)
 for node in material.node_tree.nodes:
  if node.type!='TEX_IMAGE' or node.image is None:continue
  if role=='leaf' and 'leaves_diff' in node.image.name:
   node.image=bpy.data.images.load(str(source.parent/'textures/leaves-rgba.png'),check_existing=True)
   bsdf=next(n for n in material.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
   material.node_tree.links.new(node.outputs['Alpha'],bsdf.inputs['Alpha'])
   bsdf.inputs['Roughness'].default_value=.8
  size=2048 if role=='trunk' else 1024
  if max(node.image.size)>size:node.image.scale(size,size)
 print(role,'triangles',sum(len(p.vertices)-2 for p in obj.data.polygons),flush=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=args[1],export_format='GLB',export_image_format='WEBP',export_image_quality=90,export_extras=False,export_cameras=False,export_lights=False,export_animations=False)
