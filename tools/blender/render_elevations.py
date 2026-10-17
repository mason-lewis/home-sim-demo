"""Orthographic drawing comparisons, at the PDF's stated 1/4-in = 1-ft scale.

At 1.5 pixels per PDF point, the unresized raster has 88.582677 px/m.
No best-fit, perspective warp, or per-feature scaling is used.
"""
import bpy,sys,argparse,json
from pathlib import Path
from mathutils import Vector
parser=argparse.ArgumentParser();parser.add_argument('--source',required=True);parser.add_argument('--output',required=True)
args=parser.parse_args(sys.argv[sys.argv.index('--')+1:]);out=Path(args.output);out.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(Path(args.source).resolve()))
scene=bpy.context.scene;scene.render.engine='BLENDER_WORKBENCH';scene.render.resolution_x=1600;scene.render.resolution_y=1200;scene.render.resolution_percentage=100;scene.render.image_settings.file_format='PNG'
shade=scene.display.shading;shade.light='STUDIO';shade.color_type='SINGLE';shade.single_color=(.42,.46,.48);shade.show_shadows=False;shade.show_cavity=True;shade.cavity_type='BOTH';shade.show_object_outline=True;shade.background_type='WORLD';scene.world.color=(1,1,1)
camera=bpy.data.objects.new('Orthographic QA',bpy.data.cameras.new('Orthographic QA'));scene.collection.objects.link(camera);scene.camera=camera;camera.data.type='ORTHO'
# Blender ortho_scale is the horizontal span for this landscape image.
px_per_m=1.5*18/.3048;camera.data.ortho_scale=1600/px_per_m
views={'front':([6.05155,-40,5.25],[6.05155,8,5.25]),'right':([45,8.2296,5.25],[6,8.2296,5.25]),'rear':([6.05155,50,5.25],[6.05155,8,5.25]),'left':([-35,8.2296,5.25],[6,8.2296,5.25])}
for name,(eye,target) in views.items():
 camera.location=eye;camera.rotation_euler=(Vector(target)-camera.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=str(out/f'elevation-model-{name}.png');bpy.ops.render.render(write_still=True)
(out/'elevation-registration.json').write_text(json.dumps({'pixels_per_meter':px_per_m,'width':1600,'height':1200,'camera_ortho_scale':camera.data.ortho_scale,'views':views,'method':'Stated PDF scale, unwarped orthographic model. Separate source crop registration; unresolved drawing contradictions retained.'},indent=2))
