"""Shared wall/opening rules, in meters. No Blender dependency.

FC callouts: A2.0-A2.3 and detail 4/A3.0. Nominal callout dimensions
are retained explicitly; exact commercial profiles are not specified.
"""
from math import ceil, floor

BATTEN_WIDTH = 2.5 * .0254
BATTEN_PITCH = 16 * .0254
CASING_WIDTH = 4 * .0254
TRIM_DEPTH = 1.25 * .0254
PANEL_DEPTH = .0095  # retained accepted wall-build-up, not a new stud offset
BATTEN_DEPTH = .016  # retained visualization profile; thickness not dimensioned
LAP_LOWER_DEPTH = .010
LAP_UPPER_DEPTH = .002
FRAME_HALF_WIDTH = .024  # retained 48 mm authored frame member
GEOMETRY_EPS = 1e-6  # 0.001 mm arithmetic tolerance, not a design clearance
SOURCE_TOLERANCE = .003  # uncertainty in the reviewed vector wall bindings

def subtract_interval(intervals, cut):
    result=[]
    for lo,hi in intervals:
        if hi<=cut[0] or lo>=cut[1]:result.append((lo,hi));continue
        if lo<cut[0]:result.append((lo,cut[0]))
        if hi>cut[1]:result.append((cut[1],hi))
    return result

def subtract_rect(rect, cut):
    x0,z0,x1,z1=rect;a,b,c,d=cut
    lo,hi=max(x0,a),min(x1,c);bottom,top=max(z0,b),min(z1,d)
    if hi<=lo+GEOMETRY_EPS or top<=bottom+GEOMETRY_EPS:return [rect]
    return [r for r in [(x0,z0,lo,z1),(hi,z0,x1,z1),(lo,z0,hi,bottom),(lo,top,hi,z1)] if r[2]-r[0]>GEOMETRY_EPS and r[3]-r[1]>GEOMETRY_EPS]

def casing_rect(opening):
    # Match window_trim: only window sash projects half a frame member beyond
    # the nominal aperture. Door casing starts at the door opening boundary.
    side=(FRAME_HALF_WIDTH if opening.get('type')=='window' else 0)+CASING_WIDTH
    return (opening['offset']-side,opening.get('sill',0)-side,
        opening['offset']+opening['width']+side,
        opening.get('sill',0)+opening.get('height',2.032)+side)

def batten_layout(length,height,openings,phase=0,edge=CASING_WIDTH/2):
    """Fixed 16-in grid, clipped by full casing rectangles, not center tests.

    Phase is derived from the facade's world datum. No rescaling of pitch.
    Minimum fragment width/length is one half/one nominal batten width.
    """
    result=[]
    for i in range(ceil((edge-phase)/BATTEN_PITCH),floor((length-edge-phase)/BATTEN_PITCH)+1):
        center=phase+i*BATTEN_PITCH
        rect=(center-BATTEN_WIDTH/2,0,center+BATTEN_WIDTH/2,height)
        if rect[0]<edge-GEOMETRY_EPS or rect[2]>length-edge+GEOMETRY_EPS:continue
        fragments=[rect]
        for opening in openings:fragments=[p for f in fragments for p in subtract_rect(f,casing_rect(opening))]
        result.extend((i,r) for r in fragments if r[2]-r[0]>=BATTEN_WIDTH/2-GEOMETRY_EPS and r[3]-r[1]>=BATTEN_WIDTH-GEOMETRY_EPS)
    return result

def wall_cells(length,height,openings):
    """Solid wall cells share exactly the opening definitions used by trim."""
    cells=[(0,0,length,height)]
    for opening in openings:
        cut=(opening['offset'],opening.get('sill',0),opening['offset']+opening['width'],opening.get('sill',0)+opening.get('height',2.032))
        cells=[p for cell in cells for p in subtract_rect(cell,cut)]
    return cells

def opening_banks(openings):
    banks=[]
    for opening in sorted(openings,key=lambda o:o['offset']):
        if opening.get('type')=='opening':continue
        if banks:
            previous=banks[-1][-1]
            gap=opening['offset']-previous['offset']-previous['width']
            same_heights=abs(opening.get('sill',0)-previous.get('sill',0))<GEOMETRY_EPS and abs(opening.get('height',0)-previous.get('height',0))<GEOMETRY_EPS
            if previous.get('type')==opening.get('type')=='window' and same_heights and gap<2*(FRAME_HALF_WIDTH+CASING_WIDTH):
                banks[-1].append(opening);continue
        banks.append([opening])
    return banks
