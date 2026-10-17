"""Regenerate exterior assemblies from a pinned shell and reviewed house JSON.

Blender --background --factory-startup --disable-autoexec --python THIS --
  --source SOURCE.blend --house HOUSE.json --output PRIVATE_DIRECTORY

The rejected exterior rendering is never an input. Private baseline assets and
the native project's immutable compiler remain untouched. This is the local
browser branch's authoritative, repeatable exterior generator.
"""
from pathlib import Path
from datetime import datetime
from zoneinfo import ZoneInfo
import bpy,bmesh,json,math,sys,argparse,hashlib
from mathutils import Vector
sys.path.insert(0,str(Path(__file__).resolve().parent))
import facade_rules as R
import surface_cleanup

parser=argparse.ArgumentParser();parser.add_argument('--source',required=True);parser.add_argument('--house',required=True);parser.add_argument('--output',required=True)
args=parser.parse_args(sys.argv[sys.argv.index('--')+1:])
OUT=Path(args.output).resolve();OUT.mkdir(parents=True,exist_ok=True)
H=json.loads(Path(args.house).read_text());LEVELS={f['id']:f for f in H['floors']}
REPORT={'inputs':{'blend_sha256':hashlib.sha256(Path(args.source).read_bytes()).hexdigest(),'house_sha256':hashlib.sha256(Path(args.house).read_bytes()).hexdigest()},'authority':'Architectural drawings A2.0-A2.3 and A3.0; reviewed wall/opening JSON. Rejected rendering excluded.','provisional':['Paint colors are existing interactive proposals; no source-approved paint schedule.','Batten projection retained at 16 mm; drawings specify width and pitch but no thickness.','Commercial sash profiles and frame-member sizes retained from baseline; no manufacturer schedule.','Window nominal dimensions are not independently verified rough-opening sizes.'],'generated':[],'removed':[],'critical_defects':[]}
bpy.ops.wm.open_mainfile(filepath=str(Path(args.source).resolve()))

def inside(point,poly):
    x,y=point;hit=False
    for (a,b),(c,d) in zip(poly,poly[1:]+poly[:1]):
        if (b>y)!=(d>y) and x<(c-a)*(y-b)/(d-b)+a:hit=not hit
    return hit

def frame(w):
    a=Vector(w['a']);direction=(Vector(w['b'])-a).normalized();normal=Vector((-direction.y,direction.x))
    envelopes=[s['polygon'] for s in H['slabs'] if s['floor']==w['floor'] and ('house' in s['id'] or 'garage' in s['id'])]
    scores={side:sum(inside(a+(Vector(w['b'])-a)*t+normal*.3*side,p) for t in [.25,.5,.75] for p in envelopes) for side in [-1,1]}
    return a,direction,normal*(-max(scores,key=scores.get)),(Vector(w['b'])-a).length

def roof_height(point):
    values=[]
    for roof in H['roofs'][1:]:
        x0,y0,x1,y1=roof['bounds'];x,y=point
        if x0-R.SOURCE_TOLERANCE<=x<=x1+R.SOURCE_TOLERANCE and y0-R.SOURCE_TOLERANCE<=y<=y1+R.SOURCE_TOLERANCE:
            value=x if roof['axis']=='y' else y;lo,hi=(x0,x1) if roof['axis']=='y' else (y0,y1)
            values.append(roof['eaveZ']+roof['slope']*min(value-lo,hi-value)-.1)
    return max(values) if values else None

def remove(ob):
    REPORT['removed'].append(ob.name);bpy.data.objects.remove(ob,do_unlink=True)

def make_mesh(name,verts,faces,material,wall=None,kind=None,record=True):
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.materials.append(bpy.data.materials[material]);mesh.update()
    bm=bmesh.new();bm.from_mesh(mesh);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(mesh);bm.free()
    uv=mesh.uv_layers.new(name='RealWorldMeters')
    for face in mesh.polygons:
        axes=sorted(range(3),key=lambda i:abs(face.normal[i]))[:2]
        if 2 in axes:axes=[i for i in axes if i!=2]+[2]
        for li in face.loop_indices:
            p=mesh.vertices[mesh.loops[li].vertex_index].co;uv.data[li].uv=(p[axes[0]],p[axes[1]])
    ob=bpy.data.objects.new(name,mesh);bpy.data.collections['Exterior assemblies'].objects.link(ob)
    if wall:ob['host_wall']=wall['id']
    ob['assembly_kind']=kind or 'finish';ob['source_authority']='A2 elevations / A3.0 details; retained reviewed wall and opening coordinates'
    if record:REPORT['generated'].append({'object':name,'wall':wall['id'] if wall else None,'kind':kind,'vertices':len(verts)})
    return ob

def extrusion(name,poly,a,d,n,back,front,material,w=None,kind=None):
    if len(poly)<3:return
    verts=[]
    for depth in [back,front]:
        for u,z in poly:
            value=depth(u,z) if callable(depth) else depth
            p=a+d*u+n*value;verts.append((p.x,p.y,z))
    count=len(poly);faces=[list(range(count-1,-1,-1)),list(range(count,2*count))]+[[i,(i+1)%count,(i+1)%count+count,i+count] for i in range(count)]
    return make_mesh(name,verts,faces,material,w,kind)

def clip_profile(poly,w,clearance=0):
    """Subdivide at actual roof ridges, then fit wall tops to shared planes."""
    if w['floor']!='F3' or w['id'].startswith(('W3_core','W3_west')):return [poly]
    a,d,n,L=frame(w);breaks=[min(p[0] for p in poly),max(p[0] for p in poly)]
    # Roof height is piecewise linear. Include all roof crease/end crossings.
    for roof in H['roofs'][1:]:
        x0,y0,x1,y1=roof['bounds']
        for axis,values in [(0,[x0,(x0+x1)/2,x1]),(1,[y0,(y0+y1)/2,y1])]:
            if abs(d[axis])>1e-6:
                breaks.extend((v-a[axis])/d[axis] for v in values if breaks[0]<(v-a[axis])/d[axis]<breaks[1])
    breaks=sorted(set(breaks));pieces=[]
    for lo,hi in zip(breaks,breaks[1:]):
        p=surface_cleanup.half(poly,(lo,0),(lo,-1),True)
        p=surface_cleanup.half(p,(hi,0),(hi,1),True)
        if not p:continue
        z0=roof_height(a+d*lo);z1=roof_height(a+d*hi)
        if z0 is not None and z1 is not None:
            # Keep below the sloped top, using polygon winding for the cut.
            p=surface_cleanup.half(p,(lo,z0-clearance),(hi,z1-clearance),False)
        if p:pieces.append(p)
    return pieces

def solid_rect(name,rect,w,back,front,material,kind,profile=False):
    x0,z0,x1,z1=rect
    if x1-x0<1e-5 or z1-z0<1e-5:return []
    poly=[(x0,z0),(x1,z0),(x1,z1),(x0,z1)]
    polygons=clip_profile(poly,w,R.CASING_WIDTH if kind in ['batten','corner'] else 0) if profile else [poly]
    a,d,n,_=frame(w)
    objects=[extrusion(name+f'-{i}',p,a,d,n,back,front,material,w,kind) for i,p in enumerate(polygons)]
    if profile:
        clearance=R.CASING_WIDTH if kind in ['batten','corner'] else 0
        for ob in objects:
            for vertex in ob.data.vertices:
                u=(Vector(vertex.co[:2])-a).dot(d);center=roof_height(a+d*u)
                if center is not None and abs(vertex.co.z-center+clearance)<1e-4:
                    actual=roof_height(vertex.co[:2])
                    if actual is not None:vertex.co.z=actual-clearance
            ob.data.update()
    return objects

def is_batten(w):
    return w['id'].startswith('W3_bath_bay') or w['id'] in ['W1_east','W1_north','W1_west_rear','W1_core_rear_left']

def contiguous(w,end,all_walls):
    a,d,n,L=frame(w);point=a+d*(L if end else 0)
    for other in all_walls:
        if other is w or other['floor']!=w['floor']:continue
        b,e,m,M=frame(other)
        if d.dot(e)<.999 or n.dot(m)<.999 or abs((b-a).dot(n))>R.SOURCE_TOLERANCE:continue
        u=(point-b).dot(e)
        if R.SOURCE_TOLERANCE<u<M-R.SOURCE_TOLERANCE:return True
    return False

def window_trim(w,bank,face_depth):
    z=w.get('z',LEVELS[w['floor']]['z']);o=bank[0];last=bank[-1]
    is_window=o['type']=='window';edge=R.FRAME_HALF_WIDTH if is_window else 0
    left=o['offset']-edge;right=last['offset']+last['width']+edge
    bottom=z+o.get('sill',0)-edge;top=z+o.get('sill',0)+o.get('height',2.032)+edge
    items=[('left',(left-R.CASING_WIDTH,bottom,left,top)),('right',(right,bottom,right+R.CASING_WIDTH,top)),('head',(left-R.CASING_WIDTH,top,right+R.CASING_WIDTH,top+R.CASING_WIDTH))]
    if is_window:items.append(('sill',(left-R.CASING_WIDTH,bottom-R.CASING_WIDTH,right+R.CASING_WIDTH,bottom)))
    for first,second in zip(bank,bank[1:]):
        lo=first['offset']+first['width']+edge;hi=second['offset']-edge
        if hi>lo:items.append(('mullion-'+first['id'],(lo,bottom,hi,top)))
    for label,rect in items:solid_rect('FX_casing_'+o['id']+'-'+label,rect,w,face_depth,face_depth+R.TRIM_DEPTH,'ivory','casing')

def mitered_band(name,rect,w,all_walls,kind):
    """Intersect adjacent finish planes; never stop both boards at a centerline."""
    a,d,n,L=frame(w);back=w['thickness']/2+R.PANEL_DEPTH;front=back+R.TRIM_DEPTH
    x0,z0,x1,z1=rect
    def end_u(u,depth):
        end=0 if abs(u)<1e-6 else 1 if abs(u-L)<1e-6 else None
        if end is None:return u
        neighbors=[]
        for other in all_walls:
            if other is w or other['floor']!=w['floor']:continue
            b,e,m,M=frame(other)
            denominator=d.dot(m)
            if abs(denominator)<.999:continue
            crossing=(b-a).dot(m)/denominator;point=a+d*crossing;v=(point-b).dot(e)
            tolerance=max(w['thickness'],other['thickness'])+R.SOURCE_TOLERANCE
            if abs(crossing-u)>tolerance or min(abs(v),abs(v-M))>tolerance:continue
            other_depth=other['thickness']/2+R.PANEL_DEPTH+(R.TRIM_DEPTH if depth==front else 0)
            intersection=((b-a).dot(m)+other_depth-depth*n.dot(m))/denominator
            neighbors.append((abs(crossing-u)+min(abs(v),abs(v-M)),other['id'],intersection))
        return min(neighbors)[2] if neighbors else u
    plan=[a+d*end_u(x0,back)+n*back,a+d*end_u(x1,back)+n*back,a+d*end_u(x1,front)+n*front,a+d*end_u(x0,front)+n*front]
    verts=[(p.x,p.y,z) for z in [z0,z1] for p in plan]
    return make_mesh(name,verts,[[3,2,1,0],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]],'ivory',w,kind)

def generate_wall(w,all_walls):
    a,d,n,length=frame(w);z=w.get('z',LEVELS[w['floor']]['z']);height=w.get('height',LEVELS[w['floor']]['ceiling']);t=w['thickness'];openings=w.get('openings',[])
    upper={'F1':'F2','F2':'F3'}.get(w['floor']);band_height=.2032 if w['floor']=='F1' else .1524
    top=z+height
    if upper:
        slab=next(s for s in H['slabs'] if s['floor']==upper and 'house' in s['id']);top=slab['z']-slab.get('thickness',.10668)
    fitted=w['floor']=='F3' and not w['id'].startswith(('W3_core','W3_west'))
    if fitted:top=max(top,max(roof_height(a+d*u) or top for u in [0,length/2,length]))
    skin_top=LEVELS[upper]['z']-band_height if upper else top
    material='siding-board' if is_batten(w) else 'siding-wide' if w['floor']=='F2' or w['id']=='W1_west_core' else 'siding'
    # Both the backing and every finish use exactly the same aperture cells.
    relative=[{**o,'sill':z+o.get('sill',0)} for o in openings]
    for i,cell in enumerate(R.wall_cells(length,top-z,openings)):
        rect=(cell[0],cell[1]+z,cell[2],cell[3]+z)
        solids=solid_rect(f'FX_wall_{w["id"]}-{i}',rect,w,-t/2,t/2,material,'wall',fitted)
        for ob in solids:
            if not ob:continue
            ob.data.materials.append(bpy.data.materials['ivory'])
            for p in ob.data.polygons:
                if p.normal.dot(Vector((n.x,n.y,0)))<.5:p.material_index=1
    skin_start=.2032 if w['floor']=='F1' else z
    skin_cells=[(0,skin_start,length,skin_top)]
    for opening in relative:
        cut=R.casing_rect(opening) if opening['type']!='opening' else (opening['offset'],opening['sill'],opening['offset']+opening['width'],opening['sill']+opening.get('height',2.032))
        skin_cells=[p for r in skin_cells for p in R.subtract_rect(r,cut)]
    if is_batten(w):
        for i,rect in enumerate(skin_cells):solid_rect(f'FX_panel_{w["id"]}-{i}',rect,w,t/2,t/2+R.PANEL_DEPTH,material,'panel',fitted)
        # Anchor to a facade world datum rather than changing spacing to fit.
        phase=(-a.dot(d))%R.BATTEN_PITCH
        for i,rect in R.batten_layout(length,skin_top-z,openings,phase=phase,edge=R.CASING_WIDTH):
            actual=(rect[0],max(skin_start,rect[1]+z),rect[2],rect[3]+z)
            solid_rect(f'FX_batten_{w["id"]}-{i}-{round(rect[1]*1000)}',actual,w,t/2+R.PANEL_DEPTH,t/2+R.PANEL_DEPTH+R.BATTEN_DEPTH,'ivory','batten',fitted)
    else:
        exposure=.1524 if material=='siding-wide' else .1016
        for i in range(math.ceil((skin_top-z)/exposure)):
            lo=max(skin_start,z+i*exposure);hi=min(skin_top,z+(i+1)*exposure)
            if hi<=lo:continue
            pieces=[(0,lo,length,hi)]
            for opening in relative:
                cut=R.casing_rect(opening) if opening['type']!='opening' else (opening['offset'],opening['sill'],opening['offset']+opening['width'],opening['sill']+opening.get('height',2.032))
                pieces=[p for r in pieces for p in R.subtract_rect(r,cut)]
            for j,(x0,z0,x1,z1) in enumerate(pieces):
                if x1-x0<.01 or z1-z0<1e-5:continue
                # Clip the actual polygon, including triangular course ends.
                poly=[(x0,z0),(x1,z0),(x1,z1),(x0,z1)]
                polygons=clip_profile(poly,w,R.CASING_WIDTH) if fitted else [poly]
                for k,p in enumerate(polygons):
                    extrusion(f'FX_lap_{w["id"]}-{i}-{j}-{k}',p,a,d,n,t/2,lambda u,h:t/2+R.LAP_LOWER_DEPTH-(h-lo)/exposure*(R.LAP_LOWER_DEPTH-R.LAP_UPPER_DEPTH),material,w,'lap')
    for end in [False,True]:
        if contiguous(w,end,all_walls):continue
        left=length-R.CASING_WIDTH if end else 0
        rects=[(left,skin_start,left+R.CASING_WIDTH,skin_top)]
        for opening in relative:rects=[p for r in rects for p in R.subtract_rect(r,R.casing_rect(opening))]
        for i,r in enumerate(rects):
            if r[2]-r[0]>=R.CASING_WIDTH/2 and r[3]-r[1]>=R.CASING_WIDTH:solid_rect(f'FX_corner_{w["id"]}-{end}-{i}',r,w,t/2+R.PANEL_DEPTH,t/2+R.PANEL_DEPTH+R.TRIM_DEPTH,'ivory','corner',fitted)
    for bank in R.opening_banks(openings):window_trim(w,bank,t/2+R.PANEL_DEPTH)
    if upper:mitered_band(f'FX_band_{w["id"]}',(0,LEVELS[upper]['z']-band_height,length,LEVELS[upper]['z']),w,all_walls,'band')
    if w['floor']=='F2':
        # The slab follows the upper footprint, including bay/fireplace returns.
        # A perimeter apron finishes its exposed edge at the 5/4 x 8 datum.
        mitered_band(f'FX_apron_{w["id"]}',(0,z-.2032,length,z),w,all_walls,'floor-apron')
    if w['floor']=='F1':
        rects=[(0,0,length,.2032)]
        for opening in relative:rects=[p for r in rects for p in R.subtract_rect(r,R.casing_rect(opening))]
        for i,r in enumerate(rects):mitered_band(f'FX_baseband_{w["id"]}-{i}',r,w,all_walls,'baseband')
    if fitted:
        samples=[0,length/2,length]
        for i,(lo,hi) in enumerate(zip(samples,samples[1:])):
            z0=roof_height(a+d*lo);z1=roof_height(a+d*hi)
            if z0 and z1:extrusion(f'FX_frieze_{w["id"]}-{i}',[(lo,z0-R.CASING_WIDTH),(hi,z1-R.CASING_WIDTH),(hi,z1),(lo,z0)],a,d,n,t/2+R.PANEL_DEPTH,t/2+R.PANEL_DEPTH+R.TRIM_DEPTH,'ivory',w,'frieze')

def regenerate_gables_and_fascia():
    # Replace the old triangles, whose side slopes differed from the roof.
    for ob in list(bpy.data.objects):
        if ob.type=='MESH' and ob.name.startswith(('gable-','roof-slope-')) and (ob.name.startswith('gable-') or any(s in ob.name for s in ['fascia','rake','drip'])):remove(ob)
    main,cross=H['roofs'][1:]
    base=LEVELS['F3']['z']+LEVELS['F3']['ceiling']
    mx0,my0,mx1,my1=main['bounds'];cx0,cy0,cx1,cy1=cross['bounds'];mh=main['overhang'];ch=cross['overhang']
    # Each fitted exterior wall now provides its own gable backing. A second
    # triangle would cross the bay setback and compete with that wall finish.
    # Nominal 5/4 x 8 boards meet at the shared roof ridge with vertical miters.
    for roof in H['roofs'][1:]:
        x0,y0,x1,y1=roof['bounds'];axis=roof['axis'];lo,hi=(x0,x1) if axis=='y' else (y0,y1);middle=(lo+hi)/2;peak=roof['eaveZ']+roof['slope']*(hi-lo)/2
        ends=[('front',y0,Vector((0,-1))),('rear',y1,Vector((0,1)))] if axis=='y' else [('east',x1,Vector((1,0)))]
        for label,fixed,n in ends:
            a=Vector((lo,fixed)) if axis=='y' else Vector((fixed,lo));d=Vector((1,0)) if axis=='y' else Vector((0,1))
            for i,(u,v,z0,z1) in enumerate([(0,middle-lo,roof['eaveZ'],peak),(middle-lo,hi-lo,peak,roof['eaveZ'])]):
                extrusion(f'FX_rake_{roof["id"]}-{label}-{i}',[(u,z0-.2032),(v,z1-.2032),(v,z1),(u,z0)],a,d,n,0,R.TRIM_DEPTH,'ivory',None,'rake')
    for label,x,segments,n in [('west',mx0,[(my0,my1)],Vector((-1,0))),('east',mx1,[(my0,cy0),(cy1,my1)],Vector((1,0)))]:
        for i,(lo,hi) in enumerate(segments):
            a=Vector((x,lo));d=Vector((0,1));L=hi-lo;z=main['eaveZ']
            extrusion(f'FX_fascia_upper-{label}-{i}',[(0,z-.2032),(L,z-.2032),(L,z),(0,z)],a,d,n,0,R.TRIM_DEPTH,'ivory',None,'fascia')
    # Eave outline is the retained roof outline, including its rear-west inset.
    lower=H['roofs'][0];outline=lower.get('outline') or [[lower['bounds'][0],lower['bounds'][1]],[lower['bounds'][2],lower['bounds'][1]],[lower['bounds'][2],lower['bounds'][3]],[lower['bounds'][0],lower['bounds'][3]]]
    for i,(start,end) in enumerate(zip(outline,outline[1:]+outline[:1])):
        a=Vector(start);d=(Vector(end)-a).normalized();n=Vector((d.y,-d.x));L=(Vector(end)-a).length;z=lower['eaveZ']
        extrusion(f'FX_fascia_lower-{i}',[(0,z-.2032),(L,z-.2032),(L,z),(0,z)],a,d,n,0,R.TRIM_DEPTH,'ivory',None,'fascia')

def micro_fiber_materials():
    # Smooth FC: geometric laps supply course relief. Do not duplicate the
    # lap pattern in albedo and strong normal maps (a visible aliasing source).
    import numpy as np
    rng=np.random.default_rng(39);noise=rng.uniform(-.004,.004,(128,128))
    image=bpy.data.images.new('smooth-painted-fiber-cement',128,128,alpha=False)
    pixels=np.ones((128,128,4),dtype=np.float32);pixels[:,:,:3]=(.96+noise[:,:,None]);image.pixels.foreach_set(pixels.ravel());image.pack()
    for name in ['siding','siding-wide','siding-board']:
        material=bpy.data.materials[name];material.use_nodes=True;nodes=material.node_tree.nodes;links=material.node_tree.links
        nodes.clear();out=nodes.new('ShaderNodeOutputMaterial');bs=nodes.new('ShaderNodeBsdfPrincipled');bs.inputs['Base Color'].default_value=(.8,.8,.8,1);bs.inputs['Roughness'].default_value=.8;tex=nodes.new('ShaderNodeTexImage');tex.image=image
        links.new(tex.outputs['Color'],bs.inputs['Base Color']);links.new(bs.outputs[0],out.inputs[0])

collection=bpy.data.collections.get('Exterior assemblies') or bpy.data.collections.new('Exterior assemblies')
if collection.name not in bpy.context.scene.collection.children:bpy.context.scene.collection.children.link(collection)
walls=[w for w in H['walls'] if w.get('exterior')]
for ob in list(bpy.data.objects):
    if ob.name.startswith(('FX_','REPAIR_')):remove(ob);continue
    if ob.type!='MESH':continue
    if any(ob.name.startswith(w['id']+'-') for w in walls) and not ob.name.endswith('lower-slab-infill'):remove(ob);continue
    for w in walls:
        if any(ob.name.startswith(o['id']+'-') and any(s in ob.name for s in ['outer-casing','outer-head','drip-cap','-sill','-casing-']) for o in w.get('openings',[])):
            remove(ob);break
micro_fiber_materials()
for w in walls:generate_wall(w,walls)
regenerate_gables_and_fascia()
print('EXTERIOR_ASSEMBLIES_GENERATED',len(REPORT['generated']),flush=True)
# Bake evaluated bevels before clipping; the saved source retains separate parts.
bpy.ops.object.select_all(action='DESELECT')
meshes=[o for o in bpy.context.scene.objects if o.type=='MESH' and o.data.polygons]
for ob in meshes:ob.select_set(True)
bpy.context.view_layer.objects.active=meshes[0];bpy.ops.object.convert(target='MESH')
occupancy=surface_cleanup.solid_boxes()
REPORT['cleanup']=surface_cleanup.resolve_surfaces(grid=occupancy)
REPORT['remaining_coplanar_conflicts']=surface_cleanup.resolve_surfaces(apply=False,grid=occupancy)['conflicts']
if REPORT['remaining_coplanar_conflicts']:REPORT['critical_defects'].append('Exposed coplanar surfaces remain')
invalid=[]
for ob in bpy.context.scene.objects:
    if ob.type!='MESH':continue
    if any(len(set(p.vertices))!=len(p.vertices) or p.area<1e-10 for p in ob.data.polygons):invalid.append(ob.name)
if invalid:REPORT['critical_defects'].append({'invalid_meshes':invalid})
REPORT['generated_object_count']=len([o for o in bpy.data.objects if o.name.startswith('FX_')])
REPORT['canonical_geometry_sha256']=hashlib.sha256(repr(sorted((o.name,tuple(tuple(round(c,6) for c in o.matrix_world@v.co) for v in o.data.vertices),tuple(tuple(f.vertices) for f in o.data.polygons)) for o in bpy.context.scene.objects if o.type=='MESH')).encode()).hexdigest()
(OUT/'generation-report.json').write_text(json.dumps(REPORT,indent=2))
assert not REPORT['critical_defects'],REPORT['critical_defects']
stamp=datetime.now(ZoneInfo('America/New_York')).strftime('%Y-%m-%d_%H-%M-%S_%Z')
path=OUT/f'home-source_repaired_{stamp}.blend';bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(path),compress=True)
REPORT['source_file_sha256']=hashlib.sha256(path.read_bytes()).hexdigest()
(OUT/'generation-report.json').write_text(json.dumps(REPORT,indent=2))
(OUT/'current.json').write_text(json.dumps({'source':str(path),'report':str(OUT/'generation-report.json')},indent=2))
print('EXTERIOR_SOURCE_SAVED',path,flush=True)
