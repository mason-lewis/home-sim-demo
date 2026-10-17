"""Clip confirmed exposed coplanar faces; preserve opposing contact surfaces.

Plane tolerance: 0.01 mm, below the source drawing uncertainty (3 mm).
Overlap area threshold: 0.1 mm squared; excludes float-rounding slivers.
"""
from collections import defaultdict
import math
import bpy
from mathutils import Vector
from mathutils.geometry import barycentric_transform

def bounds(ob):
    used={i for f in ob.data.polygons for i in f.vertices}
    points=[ob.matrix_world@ob.data.vertices[i].co for i in used]
    if not points:return [[0,0,0],[0,0,0]]
    return [[min(p[i] for p in points) for i in range(3)],[max(p[i] for p in points) for i in range(3)]]

def area(poly):
    return sum(a[0]*b[1]-b[0]*a[1] for a,b in zip(poly,poly[1:]+poly[:1]))*.5

def clean(poly):
    result=[]
    for p in poly:
        if not result or sum((a-b)**2 for a,b in zip(result[-1],p))>1e-16:
            result.append(p)
    if len(result)>1 and sum((a-b)**2 for a,b in zip(result[0],result[-1]))<1e-16:
        result.pop()
    return result if len(result)>2 and abs(area(result))>1e-9 else []

def half(poly,a,b,inside):
    if not poly:return []
    out=[]
    def dist(p):return ((b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]))*(1 if inside else -1)
    for p,q in zip(poly,poly[1:]+poly[:1]):
        dp,dq=dist(p),dist(q)
        if dp>=-1e-10:out.append(p)
        if (dp>=0)!=(dq>=0):
            t=dp/(dp-dq);out.append(tuple(p[k]+(q[k]-p[k])*t for k in range(2)))
    return clean(out)

def intersection(poly,cut):
    for a,b in zip(cut,cut[1:]+cut[:1]):
        poly=half(poly,a,b,True)
        if not poly:break
    return poly

def subtract(poly,cut):
    pieces=[];remaining=poly
    for a,b in zip(cut,cut[1:]+cut[:1]):
        outside=half(remaining,a,b,False)
        if outside:pieces.append(outside)
        remaining=half(remaining,a,b,True)
        if not remaining:break
    return pieces

def priority(name,face_area):
    # Window/door geometry owns its junction; keep the actual opening intact.
    if name.startswith('roof-slope'):rank=150
    elif name.startswith(('N1_','N2_','N3_','D1_','D2_','D3_','DF')):rank=120
    elif name.startswith('AS_') or name.startswith('front-band'):rank=110
    elif any(k in name for k in ['corner','batten','casing','fascia','rake','drip']):rank=100
    elif 'continuous-ceiling' in name:rank=90
    elif 'ceiling' in name:rank=85
    elif 'lap-course' in name:rank=80
    elif name.startswith('SL'):rank=75
    elif 'floor-framing' in name:rank=20
    else:rank=50
    return (-rank,-face_area,name)

def build_face_records():
    groups=defaultdict(list)
    for ob in bpy.data.objects:
        if ob.type!='MESH':continue
        vertices=[ob.matrix_world@v.co for v in ob.data.vertices]
        for face in ob.data.polygons:
            pts=[vertices[i] for i in face.vertices]
            normal=(ob.matrix_world.to_3x3().inverted().transposed()@face.normal).normalized()
            # Generated wall finishes are axis aligned. Sloping roof contacts
            # are deliberately excluded from this wall-surface subtraction.
            for axis in range(3):
                if max(p[axis] for p in pts)-min(p[axis] for p in pts)>1e-6 or abs(normal[axis])<.99999:continue
                axes=[i for i in range(3) if i!=axis]
                poly=[(p[axes[0]],p[axes[1]]) for p in pts]
                if abs(area(poly))<1e-9:continue
                if area(poly)<0:poly.reverse()
                # No bounding-rectangle proxy: intersect the actual polygons.
                groups[(axis,round(pts[0][axis],5),1 if normal[axis]>0 else -1)].append(dict(ob=ob,face=face.index,poly=poly,axes=axes,axis=axis,plane=pts[0][axis],normal=normal,area=abs(area(poly))))
    return groups

def solid_boxes():
    grid=defaultdict(list)
    for ob in bpy.data.objects:
        if ob.type!='MESH' or len(ob.data.vertices)!=8:continue
        vs=[ob.matrix_world@v.co for v in ob.data.vertices]
        if any(len({round(p[i],5) for p in vs})!=2 for i in range(3)):continue
        lo,hi=bounds(ob)
        for x in range(math.floor(lo[0]),math.floor(hi[0])+1):
            for y in range(math.floor(lo[1]),math.floor(hi[1])+1):
                for z in range(math.floor(lo[2]),math.floor(hi[2])+1):grid[(x,y,z)].append((ob.name,lo,hi))
    return grid

def exposed(overlap,record,other,grid):
    # Preserve concealed intersections. Use several interior points so a
    # column covering one sample does not hide a visible wall conflict.
    center=[sum(p[i] for p in overlap)/len(overlap) for i in range(2)]
    samples=[center]+[[center[i]*.6+p[i]*.4 for i in range(2)] for p in overlap]
    for sample in samples:
        p=[0.,0.,0.];p[record['axis']]=record['plane']+record['normal'][record['axis']]*.0002
        for i,ax in enumerate(record['axes']):p[ax]=sample[i]
        concealed=False
        for name,lo,hi in grid.get(tuple(math.floor(v) for v in p),[]):
            if name in (record['ob'].name,other['ob'].name):continue
            if all(lo[i]+1e-6<p[i]<hi[i]-1e-6 for i in range(3)):
                concealed=True;break
        if not concealed:return True
    return False

def resolve_surfaces(apply=True,grid=None):
    groups=build_face_records();grid=solid_boxes() if grid is None else grid;patches={};edits=[];candidates=0;hidden=0
    for key,records in groups.items():
        records.sort(key=lambda r:priority(r['ob'].name,r['area']))
        owners=[]
        for record in records:
            fragments=[record['poly']]
            for owner,owner_poly in owners:
                if owner['ob']==record['ob']:continue
                # Broad phase, followed by exact convex-polygon intersection.
                if any(max(p[k] for p in record['poly'])<=min(p[k] for p in owner_poly)+1e-7 or min(p[k] for p in record['poly'])>=max(p[k] for p in owner_poly)-1e-7 for k in range(2)):continue
                next_fragments=[]
                for poly in fragments:
                    overlap=intersection(poly,owner_poly)
                    if not overlap or abs(area(overlap))<1e-7:
                        next_fragments.append(poly);continue
                    candidates+=1
                    if not exposed(overlap,record,owner,grid):
                        hidden+=1;next_fragments.append(poly);continue
                    edits.append(dict(object=record['ob'].name,face=record['face'],owner=owner['ob'].name,area_m2=abs(area(overlap)),plane=list(key)))
                    next_fragments.extend(subtract(poly,owner_poly))
                fragments=next_fragments
                if not fragments:break
            if sum(abs(area(p)) for p in fragments)<record['area']-1e-8:
                patches[(record['ob'].name,record['face'])]=(record,fragments)
            owners.extend((record,p) for p in fragments)
    if apply:
        by_object=defaultdict(dict)
        for (name,face),data in patches.items():by_object[name][face]=data
        for name,changes in by_object.items():
            ob=bpy.data.objects[name];old=ob.data;inverse=ob.matrix_world.inverted()
            coords=[v.co.copy() for v in old.vertices];lookup={tuple(round(c,7) for c in v):i for i,v in enumerate(coords)}
            faces=[];attrs=[]
            for face in old.polygons:
                if face.area<1e-10:continue
                originals=[old.vertices[i].co.copy() for i in face.vertices]
                original_uvs={uv.name:[Vector((uv.data[li].uv.x,uv.data[li].uv.y,0)) for li in face.loop_indices] for uv in old.uv_layers}
                polygons=[originals]
                if face.index in changes:
                    record,pieces=changes[face.index];polygons=[]
                    for piece in pieces:
                        points=[]
                        for q in piece:
                            world=[0.,0.,0.];world[record['axis']]=record['plane']
                            for i,axis in enumerate(record['axes']):world[axis]=q[i]
                            points.append(inverse@Vector(world))
                        if (points[1]-points[0]).cross(points[2]-points[0]).dot(face.normal)<0:points.reverse()
                        polygons.append(points)
                for points in polygons:
                    idx=[];distinct_points=[]
                    for p in points:
                        key=tuple(round(c,7) for c in p)
                        if key not in lookup:lookup[key]=len(coords);coords.append(p)
                        index=lookup[key]
                        # Clipping at an existing edge can round two adjacent
                        # points onto one vertex. Do not create repeated loops:
                        # they can make Blender's edit-mode normal walk hang.
                        if index in idx:continue
                        idx.append(index);distinct_points.append(coords[index])
                    if len(set(idx))<3:continue
                    faces.append(idx);uvvalues={}
                    for uvname,values in original_uvs.items():
                        uvvalues[uvname]=[barycentric_transform(p,*originals[:3],*values[:3])[:2] for p in distinct_points]
                    attrs.append((face.material_index,face.use_smooth,uvvalues))
            mesh=bpy.data.meshes.new(old.name+' repaired');mesh.from_pydata(coords,[],faces)
            for material in old.materials:mesh.materials.append(material)
            mesh.update()
            assert all(len(set(p.vertices))==len(p.vertices) for p in mesh.polygons),name
            for uv in old.uv_layers:mesh.uv_layers.new(name=uv.name)
            for face,(mat,smooth,uvs) in zip(mesh.polygons,attrs):
                face.material_index=mat;face.use_smooth=smooth
                for uvname,values in uvs.items():
                    for li,value in zip(face.loop_indices,values):mesh.uv_layers[uvname].data[li].uv=value
            ob.data=mesh
    return {'conflicts':len(edits),'hidden_contacts_preserved':hidden,'objects_edited':len({e['object'] for e in edits}),'edits':edits}
