"""Blender regression fixture: exposed duplicates fail; hidden joints survive."""
from pathlib import Path
import bpy,sys,json
sys.path.insert(0,str(Path(__file__).resolve().parent))
import surface_cleanup
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
for name in ['test-wall-original','test-wall-duplicate']:
 bpy.ops.mesh.primitive_cube_add();bpy.context.object.name=name
bpy.context.view_layer.update()
scan=surface_cleanup.resolve_surfaces(apply=False)
assert scan['conflicts']==6,scan
cleanup=surface_cleanup.resolve_surfaces()
assert surface_cleanup.resolve_surfaces(apply=False)['conflicts']==0
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
for location in [(0,0,0),(2,0,0)]:bpy.ops.mesh.primitive_cube_add(location=location)
bpy.context.view_layer.update()
assert surface_cleanup.resolve_surfaces(apply=False)['conflicts']==0,'Opposing construction contact must survive'
print('SURFACE_GATE_PASS: six exposed duplicate faces caught; cleanup idempotent; opposing contact preserved',flush=True)
