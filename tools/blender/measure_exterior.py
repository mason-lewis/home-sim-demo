"""Measure SAVED geometry and the decoded GLB, not the generator's inputs.

Nominal drawing schedule is compared to actual aperture-edge intersections.
Hidden commercial frame/rough opening certification is deliberately excluded.
"""
import bpy,json,argparse,sys,math,hashlib,re
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
parser=argparse.ArgumentParser()
for name in ['source','baseline','house','browser','output']:parser.add_argument('--'+name,required=True)
args=parser.parse_args(sys.argv[sys.argv.index('--')+1:]);H=json.loads(Path(args.house).read_text());levels={f['id']:f for f in H['floors']}
browser=json.loads(Path(args.browser).read_text());rows=[];critical=[]
def geometry_digest(objects):
 return hashlib.sha256(repr(sorted((o.name,tuple(tuple(round(c,6) for c in o.matrix_world@v.co) for v in o.data.vertices)) for o in objects)).encode()).hexdigest()
bpy.ops.wm.open_mainfile(filepath=str(Path(args.baseline).resolve()))
bpy.ops.object.select_all(action='DESELECT')
meshes=[o for o in bpy.context.scene.objects if o.type=='MESH' and o.data.polygons]
for ob in meshes:ob.select_set(True)
bpy.context.view_layer.objects.active=meshes[0];bpy.ops.object.convert(target='MESH')
def bbox(ob):
 used={i for p in ob.data.polygons for i in p.vertices}
 points=[ob.matrix_world@ob.data.vertices[i].co for i in used]
 return [min(p[i] for p in points) for i in range(3)]+[max(p[i] for p in points) for i in range(3)] if points else None
baseline_bounds={o.name:bbox(o) for o in meshes}
original_roof=geometry_digest([o for o in bpy.context.scene.objects if o.type=='MESH' and o.name.startswith('roof-slope-') and not any(s in o.name for s in ['fascia','rake','drip'])])
original_structural=geometry_digest([o for o in bpy.context.scene.objects if o.type=='MESH' and o.name.startswith(('SL','C','W')) and not any(o.name.startswith(w['id']+'-') for w in H['walls'] if w.get('exterior'))])
bpy.ops.wm.open_mainfile(filepath=str(Path(args.source).resolve()))
source_roof=geometry_digest([o for o in bpy.context.scene.objects if o.type=='MESH' and o.name.startswith('roof-slope-') and not any(s in o.name for s in ['fascia','rake','drip'])])
source_structural=geometry_digest([o for o in bpy.context.scene.objects if o.type=='MESH' and o.name.startswith(('SL','C','W')) and not any(o.name.startswith(w['id']+'-') for w in H['walls'] if w.get('exterior'))])
# Cleanup can split overlapping roof/structural faces; world vertex sets and bounds
# are audited below, while exact preservation is reported separately.
def inside(point,poly):
 x,y=point;hit=False
 for (a,b),(c,d) in zip(poly,poly[1:]+poly[:1]):
  if (b>y)!=(d>y) and x<(c-a)*(y-b)/(d-b)+a:hit=not hit
 return hit
def frame(w):
 a=Vector(w['a']);d=(Vector(w['b'])-a).normalized();n=Vector((-d.y,d.x));env=[s['polygon'] for s in H['slabs'] if s['floor']==w['floor'] and ('house' in s['id'] or 'garage' in s['id'])]
 score={side:sum(inside(a+(Vector(w['b'])-a)*t+n*.3*side,p) for t in [.25,.5,.75] for p in env) for side in [-1,1]}
 return a,d,n*(-max(score,key=score.get))
def projected(polygons,a,d,n,depth):
 result=[]
 for points in polygons:
  if all(abs((Vector(p[:2])-a).dot(n)-depth)<2e-5 for p in points):
   poly=[((Vector(p[:2])-a).dot(d),p[2]) for p in points]
   if max(p[0] for p in poly)-min(p[0] for p in poly)>1e-6 and max(p[1] for p in poly)-min(p[1] for p in poly)>1e-6:result.append(poly)
 return result
def intervals(polys,axis,value):
 ranges=[]
 for poly in polys:
  points=[]
  for p,q in zip(poly,poly[1:]+poly[:1]):
   if abs(p[axis]-value)<1e-7:points.append(p[1-axis])
   if (p[axis]<value<q[axis]) or(q[axis]<value<p[axis]):points.append(p[1-axis]+(value-p[axis])/(q[axis]-p[axis])*(q[1-axis]-p[1-axis]))
  if len(points)>1:ranges.append((min(points),max(points)))
 return ranges
def gap(ranges,at):
 if any(lo+1e-5<at<hi-1e-5 for lo,hi in ranges):return None
 left=[hi for lo,hi in ranges if hi<=at+1e-5];right=[lo for lo,hi in ranges if lo>=at-1e-5]
 return(max(left) if left else None,min(right) if right else None)
def add(feature,target,source,export,authority='Reviewed source vector/schedule',tol=.003,unit='m'):
 deltas=[abs(v-target) for v in [source,export] if v is not None]
 status='PASS' if len(deltas)==2 and max(deltas)<=tol else 'FAIL'
 row={'feature':feature,'reference_m':target,'blender_m':source,'browser_m':export,'max_delta_mm':max(deltas)*1000 if deltas else None,'tolerance_mm':tol*1000,'unit':unit,'status':status,'authority':authority};
 if unit=='ratio':row.update(max_delta_ratio=max(deltas) if deltas else None,tolerance_ratio=tol,max_delta_mm=None,tolerance_mm=None)
 rows.append(row)
 if status=='FAIL':critical.append(feature)
all_browser=[[[float(c) for c in surface['points'][i]] for i in surface['indices'][offset:offset+3]] for surface in browser['surfaces'] if surface['material'] in ['siding','siding-board','siding-wide'] for offset in range(0,len(surface['indices']),3)]
apertures=[]
for w in [w for w in H['walls'] if w.get('exterior')]:
 a,d,n=frame(w);z=w.get('z',levels[w['floor']]['z']);objs=[o for o in bpy.context.scene.objects if o.get('host_wall')==w['id'] and o.get('assembly_kind')=='wall']
 polygons=[[tuple(o.matrix_world@o.data.vertices[i].co) for i in p.vertices] for o in objs for p in o.data.polygons]
 datasets=[projected(polygons,a,d,n,w['thickness']/2),projected(all_browser,a,d,n,w['thickness']/2)]
 for opening in w.get('openings',[]):
  lo=opening['offset'];hi=lo+opening['width'];bottom=z+opening.get('sill',0);top=bottom+opening.get('height',2.032);measure=[]
  for polys in datasets:
   horizontal=gap(intervals(polys,1,(bottom+top)/2),(lo+hi)/2);vertical=gap(intervals(polys,0,(lo+hi)/2),(bottom+top)/2)
   # Doors open to the unchanged slab datum: there is no wall face below them.
   if vertical and opening.get('sill',0)==0 and (vertical[0] is None or vertical[0]<z):
    # Lower-floor faces can share this infinite plane. The physical sill is
    # bounded by the measured current-floor slab, not the previous wall band.
    floor_objects=[ob for ob in bpy.context.scene.objects if ob.type=='MESH' and re.fullmatch('SL'+w['floor'][1]+'_(house|garage)-[0-9]+',ob.name) and abs(max((ob.matrix_world@v.co).z for v in ob.data.vertices)-z)<.01]
    floor_top=max((ob.matrix_world@v.co).z for ob in floor_objects for v in ob.data.vertices)
    floor_points=[float(p[2]) for surface in browser['surfaces'] for p in surface['points'] if abs(p[2]-floor_top)<2e-5]
    vertical=(floor_top if polys is datasets[0] else min(floor_points,key=lambda v:abs(v-floor_top)),vertical[1])
   measure.append([None,None,None,None] if not horizontal or not vertical else [horizontal[0],horizontal[1],vertical[0],vertical[1]])
  for j,(label,target) in enumerate([('left offset',lo),('right offset',hi),('bottom datum',bottom),('head datum',top)]):add(opening['id']+' '+label,target,measure[0][j],measure[1][j])
  widths=[m[1]-m[0] if m[0] is not None and m[1] is not None else None for m in measure];heights=[m[3]-m[2] if m[2] is not None and m[3] is not None else None for m in measure]
  add(opening['id']+' aperture width',opening['width'],*widths);add(opening['id']+' aperture height',top-bottom,*heights)
  apertures.append({'id':opening['id'],'wall':w['id'],'type':opening['type'],'source_binding':opening.get('sourceBinding'),'actual_bounds':measure})
all_points=[Vector(p) for surface in browser['surfaces'] for p in surface['points']]
ivory_points=[Vector(p) for surface in browser['surfaces'] if surface['material']=='ivory' for p in surface['points']]
def member_measure(ob,axis):
 points=[ob.matrix_world@v.co for v in ob.data.vertices]
 lo=[min(p[i] for p in points) for i in range(3)];hi=[max(p[i] for p in points) for i in range(3)]
 matched=[p for p in ivory_points if all(lo[i]-2e-5<=p[i]<=hi[i]+2e-5 for i in range(3))]
 return hi[axis]-lo[axis],max(p[axis] for p in matched)-min(p[axis] for p in matched) if matched else None
for w in [w for w in H['walls'] if w.get('exterior')]:
 a,d,n=frame(w);axis=0 if abs(d.x)>.5 else 1
 battens=[o for o in bpy.context.scene.objects if o.get('host_wall')==w['id'] and o.get('assembly_kind')=='batten']
 widths=[];centers=[];export_centers=[]
 for ob in battens:
  points=[ob.matrix_world@v.co for v in ob.data.vertices];us=[(Vector(v[:2])-a).dot(d) for v in points];width=max(us)-min(us)
  if abs(width-.0635)<1e-5:
   widths.append(member_measure(ob,axis));centers.append((min(us)+max(us))/2)
   zlo,zhi=min(p.z for p in points),max(p.z for p in points)
   depth=w['thickness']/2+.0095+.016
   matches=[(Vector(p[:2])-a).dot(d) for p in ivory_points if abs((Vector(p[:2])-a).dot(n)-depth)<2e-5 and min(us)-2e-5<=(Vector(p[:2])-a).dot(d)<=max(us)+2e-5 and zlo-2e-5<=p.z<=zhi+2e-5]
   if matches:export_centers.append((min(matches)+max(matches))/2)
 centers=sorted(set(round(v,6) for v in centers));export_centers=sorted(set(round(v,6) for v in export_centers))
 pitches=[b-a for a,b in zip(centers,centers[1:]) if abs(b-a-.4064)<.001];ep=[b-a for a,b in zip(export_centers,export_centers[1:]) if abs(b-a-.4064)<.001]
 if pitches:add(w['id']+' batten pitch',.4064,min(pitches),min(ep) if ep else None,'A2: 16 in on center; actual member centers',1e-5)
 if widths:add(w['id']+' full batten width',.0635,max(v[0] for v in widths),max(v[1] for v in widths if v[1] is not None) if any(v[1] is not None for v in widths) else None,'A2: 2.5 in; actual member bounds',1e-5)
 casings=[o for o in bpy.context.scene.objects if o.get('host_wall')==w['id'] and o.get('assembly_kind')=='casing' and '-left-' in o.name]
 if casings:
  casing=casings[0];width=member_measure(casing,axis);depth=member_measure(casing,1-axis)
  add(w['id']+' casing jamb width',.1016,*width,'A3.0: 5/4 x 4 head / jamb / apron',1e-5)
  add(w['id']+' casing projection',.03175,*depth,'A3.0: nominal 5/4 FC trim',1e-5)
 for kind,expected in [('band',.2032 if w['floor']=='F1' else .1524),('baseband',.2032),('floor-apron',.2032)]:
  members=[o for o in bpy.context.scene.objects if o.get('host_wall')==w['id'] and o.get('assembly_kind')==kind]
  if members:
   measured=[member_measure(o,2) for o in members];add(w['id']+' '+kind+' height',expected,max(v[0] for v in measured),max(v[1] for v in measured if v[1] is not None) if any(v[1] is not None for v in measured) else None,'A2: 5/4 x 8 or 5/4 x 6 FC band',1e-5)
for slab in [s for s in H['slabs'] if s['id'] in ['SL1_house','SL1_garage','SL2_house','SL3_house']]:
 objects=[o for o in bpy.context.scene.objects if o.type=='MESH' and re.fullmatch(re.escape(slab['id'])+'-[0-9]+',o.name)]
 points=[o.matrix_world@v.co for o in objects for v in o.data.vertices]
 lo=[min(p[i] for p in points) for i in range(3)];hi=[max(p[i] for p in points) for i in range(3)]
 exported=[p for p in all_points if all(lo[i]-2e-5<=p[i]<=hi[i]+2e-5 for i in range(3))]
 for axis,label in [(0,'plan width'),(1,'plan depth')]:
  target=max(p[axis] for p in slab['polygon'])-min(p[axis] for p in slab['polygon'])
  add(slab['id']+' '+label,target,hi[axis]-lo[axis],max(p[axis] for p in exported)-min(p[axis] for p in exported),'Reviewed floor-plan slab polygon; saved and decoded extents')
 add(slab['id']+' floor datum',slab['z'],hi[2],max(p.z for p in exported),'A2 floor elevation / reviewed slab datum')
ground=[s for s in H['slabs'] if s['floor']=='F1']
slab_ids=[s['id'] for s in ground]
ground_objects=[o for o in bpy.context.scene.objects if o.type=='MESH' and any(re.fullmatch(re.escape(id)+'-[0-9]+',o.name) for id in slab_ids)]
ground_points=[o.matrix_world@v.co for o in ground_objects for v in o.data.vertices]
lo=[min(p[i] for p in ground_points) for i in range(3)];hi=[max(p[i] for p in ground_points) for i in range(3)]
exported=[p for p in all_points if all(lo[i]-2e-5<=p[i]<=hi[i]+2e-5 for i in range(3))]
for axis,label in [(0,'width'),(1,'depth')]:
 target=max(p[axis] for slab in ground for p in slab['polygon'])-min(p[axis] for slab in ground for p in slab['polygon'])
 add('F1 overall slab footprint '+label,target,hi[axis]-lo[axis],max(p[axis] for p in exported)-min(p[axis] for p in exported),'A1.0 reviewed house / garage / porch slab polygon union')
roof_objects=[o for o in bpy.context.scene.objects if o.type=='MESH' and o.name.startswith('roof-slope-') and not any(s in o.name for s in ['fascia','rake','drip'])]
roof_points=[o.matrix_world@v.co for o in roof_objects for v in o.data.vertices]
roof_export=[Vector(p) for surface in browser['surfaces'] if surface['material']=='roof' for p in surface['points']]
expected_ridge=max(r['eaveZ']+r['slope']*((r['bounds'][2]-r['bounds'][0]) if r.get('axis')=='y' else (r['bounds'][3]-r['bounds'][1]))/2 for r in H['roofs'][1:])
add('Upper roof weather ridge datum',expected_ridge,max(p.z for p in roof_points),max(p.z for p in roof_export),'A2: retained 4:12 roof / source eave datum')
for roof in H['roofs'][1:]:
 axis=0 if roof['axis']=='y' else 1;lo=roof['bounds'][axis];hi=roof['bounds'][axis+2];mid=(lo+hi)/2
 # Read the top vertex at the low eave and ridge from each saved geometry.
 def pitch(points):
  e=[p.z for p in points if abs(p[axis]-lo)<2e-5 and abs(p.z-roof['eaveZ'])<1e-5]
  r=[p.z for p in points if abs(p[axis]-mid)<2e-5 and abs(p.z-expected_ridge)<1e-5]
  return(max(r)-max(e))/(mid-lo) if e and r else None
 add(roof['id']+' pitch rise/run',1/3,pitch(roof_points),pitch(roof_export),'A2: 4 in rise / 12 in run',1e-5,'ratio')
preserved_bounds=[]
for ob in bpy.context.scene.objects:
 if ob.type!='MESH' or ob.name not in baseline_bounds or ob.name.startswith('FX_'):continue
 before=baseline_bounds[ob.name];after=bbox(ob)
 if before and after:preserved_bounds.append({'object':ob.name,'max_delta_m':max(abs(a-b) for a,b in zip(before,after))})
changed_bounds=[r for r in preserved_bounds if r['max_delta_m']>.003]
missing=[im.filepath for im in bpy.data.images if im.source=='FILE' and not im.packed_file and not Path(bpy.path.abspath(im.filepath)).exists()]
join_checks=[]
export_trees=[(surface['material'],BVHTree.FromPolygons(surface['points'],[surface['indices'][i:i+3] for i in range(0,len(surface['indices']),3)],all_triangles=True)) for surface in browser['surfaces']]
outer=next(w for w in H['walls'] if w['id']=='W2_fireplace_outer')
for return_id,end in [('W2_fireplace_south','a'),('W2_fireplace_north','b')]:
 other=next(w for w in H['walls'] if w['id']==return_id);a,d,n=frame(outer);b,e,m=frame(other)
 corner=Vector(outer[end]);probe=corner+n*(outer['thickness']/4)+m*(other['thickness']/4)
 slab=next(s for s in H['slabs'] if s['id']=='SL2_house');height=slab['z']-slab.get('thickness',.10668)/2
 origin=Vector((probe.x+n.x,probe.y+n.y,height));direction=Vector((-n.x,-n.y,0))
 hit,point,normal,index,obj,_=bpy.context.scene.ray_cast(bpy.context.evaluated_depsgraph_get(),origin,direction)
 material=obj.data.materials[obj.data.polygons[index].material_index].name if hit else None
 exported=[]
 for role,tree in export_trees:
  p,norm,face,distance=tree.ray_cast(origin,direction)
  if p is not None:exported.append((distance,role))
 browser_material=min(exported)[1] if exported else None
 passed=material==browser_material=='ivory'
 join_checks.append({'feature':return_id+' exterior apron miter','method':'First visible surface at the actual slab edge, below the floor, must be FC trim in source and decoded export.','origin':list(origin),'direction':list(direction),'source_material':material,'browser_material':browser_material,'status':'PASS' if passed else 'FAIL'})
 if not passed:critical.append(return_id+' exposed slab edge at apron corner')
invalid=[o.name for o in bpy.context.scene.objects if o.type=='MESH' and any(p.area<1e-10 or len(set(p.vertices))!=len(p.vertices) for p in o.data.polygons)]
result={'source':str(Path(args.source).resolve()),'browser_sha256':browser['sha256'],'measurement_method':'Intersections with saved/exact decoded exterior structural planes; aperture boundaries at midheight and midwidth. No generator inputs used as measured geometry.','surface_join_checks':join_checks,'retained_object_bounds':preserved_bounds,'changed_retained_bounds':changed_bounds,'rows':rows,'apertures':apertures,'critical_defects':critical,'missing_dependencies':missing,'invalid_meshes':invalid,'roof_exact_vertex_digest_unchanged':original_roof==source_roof,'other_structure_exact_vertex_digest_unchanged':original_structural==source_structural,'limitations':['Nominal opening labels are not certified manufacturer rough openings.','35 ft max-height label conflicts with the plotted guard datum by 355.6 mm; unresolved source conflict.','Colors and unspecified frame/batten thickness remain proposed.']}
Path(args.output).write_text(json.dumps(result,indent=2));print('MEASUREMENT_RESULTS',len(rows),'rows,',len(critical),'failures,',len(missing),'missing dependencies',flush=True)
if critical:print('MEASUREMENT_FAILURES',critical,flush=True)
