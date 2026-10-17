import importlib.util
from pathlib import Path
import unittest

spec=importlib.util.spec_from_file_location('facade_rules',Path(__file__).resolve().parents[1]/'tools/blender/facade_rules.py')
rules=importlib.util.module_from_spec(spec);spec.loader.exec_module(rules)

class FacadeRules(unittest.TestCase):
    def test_battens_keep_documented_pitch(self):
        bars=rules.batten_layout(5,3,[],phase=.13)
        centers=sorted({(r[0]+r[2])/2 for _,r in bars})
        for a,b in zip(centers,centers[1:]):self.assertAlmostEqual(b-a,.4064)

    def test_entire_batten_footprint_avoids_casing(self):
        opening={'offset':.8,'width':1.2,'sill':.7,'height':1.5,'type':'window'}
        cut=rules.casing_rect(opening)
        for _,r in rules.batten_layout(4,3,[opening]):
            self.assertTrue(r[2]<=cut[0]+1e-6 or r[0]>=cut[2]-1e-6 or r[3]<=cut[1]+1e-6 or r[1]>=cut[3]-1e-6)
            self.assertGreaterEqual(r[3]-r[1],rules.BATTEN_WIDTH-1e-6)

    def test_door_aperture_remains_empty_through_floor_zone(self):
        opening={'offset':1,'width':1,'height':2.1,'type':'door'}
        cells=rules.wall_cells(3,2.9,[opening])
        for x,z in [(1.01,.01),(1.5,1),(1.99,2.09)]:self.assertFalse(any(a<x<c and b<z<d for a,b,c,d in cells))
        self.assertTrue(any(a<1.5<c and b<2.5<d for a,b,c,d in cells))

    def test_banked_windows_have_one_assembly(self):
        windows=[dict(id=str(i),offset=i*.99,width=.9144,sill=.6,height=1.8,type='window') for i in range(4)]
        self.assertEqual([len(bank) for bank in rules.opening_banks(windows)],[4])

    def test_door_siding_cut_meets_its_actual_casing(self):
        door=dict(offset=1,width=.9144,height=2.032,type='door')
        left,bottom,right,top=rules.casing_rect(door)
        self.assertAlmostEqual(left,1-rules.CASING_WIDTH)
        self.assertAlmostEqual(right,1+.9144+rules.CASING_WIDTH)
        self.assertAlmostEqual(top,2.032+rules.CASING_WIDTH)

    def test_replay_is_deterministic(self):
        self.assertEqual(rules.batten_layout(6,3,[]),rules.batten_layout(6,3,[]))

if __name__=='__main__':unittest.main()
