#!/usr/bin/env python3
import importlib.util
import json
from pathlib import Path
import unittest

T=Path(__file__).with_name('joypad_pulse_campaign.py')
s=importlib.util.spec_from_file_location('campaign',T);m=importlib.util.module_from_spec(s);s.loader.exec_module(m)

class PulseCampaignTests(unittest.TestCase):
    def test_pulsed_shot_actually_releases(self):
        masks=m.build_masks({'phases':[{'frames':11,'hold':['right'],
            'pulses':[{'button':'shoot','every':5}]}]})
        self.assertEqual([i for i,mask in enumerate(masks) if mask & 0x4000],[0,5,10])
        self.assertEqual(masks[1],0x100)
    def test_left_overrides_right(self):
        masks=m.build_masks({'phases':[{'frames':8,'hold':['right'],
            'pulses':[{'button':'left','every':5,'width':2}]}]})
        self.assertEqual(masks,[0x200,0x200,0x100,0x100,0x100,0x200,0x200,0x100])
    def test_delayed_shoot(self):
        masks=m.build_masks({'phases':[{'frames':20,'hold':['right'],
            'pulses':[{'button':'shoot','start':8,'every':6}]}]})
        self.assertEqual([i for i,mask in enumerate(masks) if mask & 0x4000],[8,14])
    def test_reject_invalid_pulse(self):
        for pulse in ({'button':'shoot','every':0},{'button':'shoot','every':5,'width':6},
                      {'button':'purple','every':5}):
            with self.assertRaises(ValueError):m.build_masks({'phases':[{'frames':5,'pulses':[pulse]}]})
    def test_trace_frames_and_rom(self):
        plan={'start_frame':2972,'rom_fingerprint':'a738cdf85a0c3821',
              'phases':[{'frames':2,'hold':['right']}]} 
        txt=m.trace(plan,m.build_masks(plan))
        self.assertIn('frame=2972 joy1=0100',txt)
        self.assertIn('frame=2973 joy1=0100',txt)
        self.assertEqual(len(txt.strip().splitlines()),3)
    def test_compiled_route_covers_obstacle_and_wall(self):
        plan=json.loads(Path(__file__).with_name('rev175-megamanx2-intro-plan.json').read_text())
        masks=m.build_masks(plan)
        self.assertEqual(len(masks),1880)
        self.assertEqual(masks[0],0x4100)
        self.assertEqual(masks[1],0x0100)
        self.assertEqual(masks[260],0x8180)
        self.assertEqual(masks[1080],0x8180)
        self.assertEqual(masks[1280],0x8200)
        self.assertEqual(masks[1520],0x8200)

if __name__=='__main__':unittest.main()
