"""Neutral, short-range contact occlusion; no sun direction is baked in."""
import bpy, json, sys
from pathlib import Path
args=sys.argv[sys.argv.index('--')+1:]
objects=json.loads(Path(args[0]).read_text())
output=Path(args[1])
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
scene=bpy.context.scene
scene.render.engine='CYCLES'
scene.cycles.samples=32
prefs=bpy.context.preferences.addons['cycles'].preferences
try:
 prefs.compute_device_type='METAL';prefs.get_devices()
 for device in prefs.devices:device.use=device.type=='METAL'
 scene.cycles.device='GPU'
except TypeError:pass
scene.cycles.use_denoising=False
scene.render.bake.margin=4
scene.render.bake.use_clear=True
images={key:bpy.data.images.new(key+'-ao',width=size,height=size,alpha=False) for key,size in [('home',4096),('site',2048)]}
for image in images.values(): image.colorspace_settings.name='Non-Color'
for index,data in enumerate(objects):
 mesh=bpy.data.meshes.new('runtime-surface')
 mesh.from_pydata(data['positions'],[],[data['indices'][i:i+3] for i in range(0,len(data['indices']),3)])
 mesh.update()
 uv=mesh.uv_layers.new(name='Contact occlusion')
 for polygon in mesh.polygons:
  for loop in polygon.loop_indices: uv.data[loop].uv=data['uvs'][mesh.loops[loop].vertex_index]
 obj=bpy.data.objects.new(data['atlas']+'-'+str(index),mesh)
 scene.collection.objects.link(obj)
 obj['atlas']=data['atlas']
 material=bpy.data.materials.new('contact-occlusion')
 material.use_nodes=True
 nodes=material.node_tree.nodes
 nodes.clear()
 ao=nodes.new('ShaderNodeAmbientOcclusion')
 ao.inputs['Distance'].default_value=.2032
 ao.samples=32
 emission=nodes.new('ShaderNodeEmission')
 out=nodes.new('ShaderNodeOutputMaterial')
 material.node_tree.links.new(ao.outputs['Color'],emission.inputs['Color'])
 material.node_tree.links.new(emission.outputs[0],out.inputs['Surface'])
 target=nodes.new('ShaderNodeTexImage')
 target.image=images[data['atlas']]
 nodes.active=target
 mesh.materials.append(material)
for atlas,image in images.items():
 if '--home-only' in args and atlas!='home':continue
 bpy.ops.object.select_all(action='DESELECT')
 selected=[obj for obj in scene.objects if obj.get('atlas')==atlas]
 for obj in selected: obj.select_set(True)
 bpy.context.view_layer.objects.active=selected[0]
 # One selected mesh per atlas prevents a later object clearing earlier islands.
 if len(selected)>1:bpy.ops.object.join()
 print('Baking neutral '+atlas+' occlusion',flush=True)
 bpy.ops.object.bake(type='EMIT')
 image.filepath_raw=str(output/(atlas+'-ao.png'))
 image.file_format='PNG'
 image.save()
print('AO atlases ready.',flush=True)
