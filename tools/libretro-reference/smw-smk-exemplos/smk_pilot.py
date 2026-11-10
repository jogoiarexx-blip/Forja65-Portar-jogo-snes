"""SMK race bot: purely WRAM-observed steering, no progress or lap rewriting.

Coordinates and heading are sourced from the running game; success is reported
only after an observed lap counter reaches the race's completion threshold.
"""
from __future__ import annotations
from collections import deque
from dataclasses import dataclass
import math

B, LEFT, RIGHT = 0x8000, 0x0200, 0x0100
BASE = 0x1000
STRIDE = 0x100


def u16(data: bytes, offset: int) -> int:
    return data[offset] | data[offset + 1] << 8


def wrap_diff(a: int, b: int) -> int:
    return ((a - b + 32768) & 0xffff) - 32768


def steering(x: int, y: int, heading: int, dest_x: int, dest_y: int,
             threshold: float = 6.0) -> int:
    dx, dy = wrap_diff(dest_x, x), wrap_diff(dest_y, y)
    if dx == 0 and dy == 0:
        return B
    target = math.degrees(math.atan2(dy, dx))
    current = -90 + heading * 360.0 / 65536
    delta = (target - current + 180) % 360 - 180
    return B | (RIGHT if delta > threshold else LEFT if delta < -threshold else 0)


@dataclass(frozen=True)
class Racer:
    x: int
    y: int
    heading: int
    checkpoints: int
    lap: int  # game uses 0x80-based lap counter

    @classmethod
    def parse(cls, buf: bytes, i: int = 0) -> 'Racer':
        p = i * STRIDE
        if len(buf) < p + 0xc2:
            raise ValueError('kart WRAM snapshot truncated')
        return cls(u16(buf, p + 0x18), u16(buf, p + 0x1c),
                   u16(buf, p + 0x2a), buf[p + 0xc0], buf[p + 0xc1] - 128)


class PurePursuit:
    """Follow CPU reference *one complete lap*, with a bounded moving index.

    The original verified Mario Circuit 1 pilot only searches from -5 to +40
    samples around its previous route index. Global nearest-neighbor tracking
    on multi-lap history can jump to a different nearby piece of road and stall.
    """
    def __init__(self, kart: int = 4, lookahead: int = 20, deadzone: float = 6,
                 max_points: int = 2000, racing_line=None):
        if not 1 <= kart <= 7:
            raise ValueError('reference kart must be 1..7')
        self.kart, self.lookahead, self.deadzone = kart, lookahead, deadzone
        self.route: list[tuple[int,int]] = ([tuple(int(v) for v in p[:2]) for p in racing_line]
                                         if racing_line is not None else [])
        self.route_ready = racing_line is not None
        self.index: int | None = None
        self.samples = 0
        self.last_lap = -1
        self.max_points = max_points

    def drive(self, memory: bytes) -> tuple[int, Racer]:
        me = Racer.parse(memory)
        rival = Racer.parse(memory, self.kart)
        self.samples += 1
        p = (rival.x,rival.y)
        # In SMK the CPU kart lap bytes encode lap+128. The second circuit's
        # first complete lap is the 0x81 interval; recording exactly one lap
        # avoids ambiguous duplicate points near the start/finish line.
        if rival.lap == 1 and not self.route_ready:
            if (not self.route or p!=self.route[-1]) and len(self.route)<self.max_points:
                self.route.append(p)
        elif rival.lap >= 2 and self.route:
            self.route_ready = True
        if len(self.route)>=max(15,self.lookahead+2):
            pts=self.route
            n=len(pts)
            if self.index is None:
                candidates=range(n)
            else:
                candidates=((self.index+k)%n for k in range(-5,40))
            def distance(i):
                x,y=pts[i]
                return wrap_diff(x,me.x)**2+wrap_diff(y,me.y)**2
            self.index=min(candidates,key=distance)
            dest=pts[(self.index+self.lookahead)%n] if self.route_ready else pts[min(self.index+self.lookahead,n-1)]
        else:
            dest=p
        # Grid pole position: CPU kart is initially behind. Hold the
        # accelerator instead of steering 180° into the starting wall.
        if not self.route_ready and len(self.route) < self.lookahead + 2 and self.samples < 140:
            dx,dy=wrap_diff(dest[0],me.x),wrap_diff(dest[1],me.y)
            theta=math.radians(-90+me.heading*360.0/65536)
            if dx*math.cos(theta)+dy*math.sin(theta)<-10:
                return B,me
        return steering(me.x,me.y,me.heading,*dest,self.deadzone),me
