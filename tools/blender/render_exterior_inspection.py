"""Repeatable source views; never saves or modifies an authoring input."""
from pathlib import Path
import bpy,json,sys,argparse,math
from mathutils import Vector
parser=argparse.ArgumentParser();parser.add_argument('--source',required=True);parser.add_argument('--output',required=True);parser.add_argument('--label',default='after');parser.add_argument('--materials',action='store_true');parser.add_argument('--orbit',action='store_true');parser.add_argument('--poses-json');parser.add_argument('--retained-lighting',action='store_true')
args=parser.parse_args(sys.argv[sys.argv.index('--')+1:]);OUT=Path(args.output);OUT.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(Path(args.source).resolve()))
views={'gable':([6.62,9.6,4.5],[6.62,8.65,-2.75]),'entry':([2.6,1.55,.1],[3.27,1.15,-4.03]),'utility':([16,1.3,-10.9],[12.1,.85,-10.9]),'band':([22,5,-7],[12.1,2.95,-7]),'front':([6,6,24],[6,5,-8]),'right':([33,6,-8],[6,5,-8]),'rear':([6,6,-38],[6,5,-8]),'left':([-24,6,-8],[6,5,-8]),'roof':([19,17,-21],[6.5,8,-8])}
if args.poses_json:
    records=json.loads(Path(args.poses_json).read_text())
    views={r['key']:(r['state']['camera'],r['state']['target']) for r in records if r['mode']=='neutral'}
if args.orbit:
    views={}
    for index in range(12):
        angle=index*math.tau/12
        views[f'orbit-{index:02}']=([6+29*math.cos(angle),16,-8+29*math.sin(angle)],[6,4.8,-8])
scene=bpy.context.scene;scene.render.engine='CYCLES' if args.materials else 'BLENDER_WORKBENCH';scene.render.resolution_x=1280;scene.render.resolution_y=720;scene.render.resolution_percentage=100;scene.render.image_settings.file_format='PNG'
shade=scene.display.shading;shade.light='STUDIO';shade.color_type='SINGLE';shade.single_color=(.65,.65,.65);shade.show_shadows=True;shade.show_cavity=True;shade.cavity_type='BOTH';shade.show_object_outline=False
if args.materials:
    scene.cycles.samples=32;scene.cycles.use_denoising=True
    prefs=bpy.context.preferences.addons['cycles'].preferences;prefs.compute_device_type='METAL';prefs.get_devices()
    for device in prefs.devices:device.use=device.type=='METAL'
    scene.cycles.device='GPU'
    if not args.retained_lighting:
        world=bpy.data.worlds.new('Inspection ambient');world.use_nodes=True;world.node_tree.nodes.get('Background').inputs[0].default_value=(.65,.75,.9,1);world.node_tree.nodes.get('Background').inputs[1].default_value=.6;scene.world=world
        light=bpy.data.lights.new('Inspection sun','SUN');light.energy=3.1;light.angle=.055;sun=bpy.data.objects.new('Inspection sun',light);scene.collection.objects.link(sun);sun.rotation_euler=Vector((32,30,-48)).to_track_quat('-Z','Y').to_euler()
camera=bpy.data.objects.new('Inspection camera',bpy.data.cameras.new('Inspection camera'));scene.collection.objects.link(camera);scene.camera=camera
camera.data.shift_y=-.065  # Matches the viewer's 6.5% vertical view offset.
camera.data.sensor_fit='VERTICAL';camera.data.sensor_height=24;camera.data.lens=24/(2*math.tan(math.radians(19)))
poses=[]
for name,(eye,target) in views.items():
    # Inspection data is Y-up glTF space, converted exactly once to Blender.
    camera.location=(eye[0],-eye[2],eye[1]);focus=Vector((target[0],-target[2],target[1]));camera.rotation_euler=(focus-camera.location).to_track_quat('-Z','Y').to_euler()
    scene.render.filepath=str(OUT/f'blender-{args.label}-{"material" if args.materials else "neutral"}-{name}.png');bpy.ops.render.render(write_still=True)
    poses.append({'view':name,'eye':eye,'target':target,'vertical_fov_degrees':38,'vertical_view_offset_fraction':.065})
(OUT/f'blender-{args.label}-poses.json').write_text(json.dumps(poses,indent=2))
