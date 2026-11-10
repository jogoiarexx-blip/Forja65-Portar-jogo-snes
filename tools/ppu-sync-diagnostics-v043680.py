#!/usr/bin/env python3
"""Non-corrective, sampled PPU capture synchronization diagnostics.

A candidate spatial/temporal offset is a *hint*, not proof of bad sync. It
never affects the full-resolution comparison, exit code, or capture hashes.
Sampling is bounded to keep optional diagnostics affordable for large frames.
"""
from math import ceil

MAX_SAMPLES = 4096


def sample_points(width, height, roi=None, margin=0):
    x0, y0, rw, rh = roi if roi is not None else (0, 0, width, height)
    xmin, ymin = x0 + margin, y0 + margin
    xmax, ymax = x0 + rw - margin, y0 + rh - margin
    if xmax <= xmin or ymax <= ymin:
        return []
    # Bounding grid, deterministic and at most 64x64 samples.
    xstep = max(1, ceil((xmax - xmin) / 64))
    ystep = max(1, ceil((ymax - ymin) / 64))
    return [(x, y) for y in range(ymin, ymax, ystep)
            for x in range(xmin, xmax, xstep)]


def sampled_mismatches(reference, actual, points, threshold=0, dx=0, dy=0):
    w, h = reference['width'], reference['height']
    if (w, h) != (actual['width'], actual['height']):
        return None
    a, b = reference['rgb'], actual['rgb']
    errors = 0
    for x, y in points:
        nx, ny = x + dx, y + dy
        if not (0 <= nx < w and 0 <= ny < h):
            raise ValueError('diagnostic sample outside capture')
        i, j = (y*w+x)*3, (ny*w+nx)*3
        if (abs(a[i]-b[j]) > threshold or abs(a[i+1]-b[j+1]) > threshold
                or abs(a[i+2]-b[j+2]) > threshold):
            errors += 1
    return errors


def suggest(baseline, candidates, total):
    """Require enough contrast and a *unique* winner to avoid flat-scene guesses."""
    if total < 64 or baseline < 16 or not candidates:
        return None
    ordered = sorted(candidates, key=lambda c: c['different_samples'])
    best = ordered[0]
    if (best['different_samples'] > baseline * 0.60 or
        baseline - best['different_samples'] < 12):
        return None
    if len(ordered) > 1 and ordered[1]['different_samples'] == best['different_samples']:
        return None
    return best


def spatial(reference, actual, roi=None, threshold=0, radius=2):
    points = sample_points(reference['width'], reference['height'], roi, margin=radius)
    base = sampled_mismatches(reference, actual, points, threshold)
    result = {'evaluated': len(points), 'radius_pixels': radius,
              'baseline_different_samples': base,
              'candidate': None, 'classification': 'no_confident_spatial_offset'}
    if len(points) < 64 or not base:
        return result
    candidates = []
    for dy in range(-radius, radius + 1):
        for dx in range(-radius, radius + 1):
            if not dx and not dy:
                continue
            count = sampled_mismatches(reference, actual, points, threshold, dx, dy)
            candidates.append({'dx': dx, 'dy': dy, 'different_samples': count})
    best = suggest(base, candidates, len(points))
    if best:
        result.update(candidate=best, classification='possible_spatial_offset')
    return result


def temporal(index, loaded, threshold=0):
    """Look for a ±1 capture frame in the same declared replay/checkpoint.

    Compare with *other* reference images. Candidate matches don't change the
    failing original pairing. Each compared image is already hash-validated.
    """
    case = loaded[index]
    name, ref, actual, sync, _, _, roi, *_ = case
    points = sample_points(ref['width'], ref['height'], roi, margin=0)
    base = sampled_mismatches(ref, actual, points, threshold)
    output = {'evaluated': len(points), 'baseline_different_samples': base,
              'candidate': None, 'classification': 'no_confident_frame_offset'}
    if len(points) < 64 or not base:
        return output
    shared_fields = ('rom_sha256', 'input_replay_sha256', 'checkpoint_id',
                     'bg_mode', 'setini_2133', 'video_standard', 'viewport',
                     'width', 'height')
    candidates = []
    for n, other in enumerate(loaded):
        if n == index:
            continue
        other_name, other_ref, _, other_sync, *_ = other
        if any(sync[k] != other_sync[k] for k in shared_fields):
            continue
        offset = other_sync['frame_number'] - sync['frame_number']
        if abs(offset) > 1:
            continue
        # A distinct field from the same nominal frame can also be compared.
        if offset == 0 and other_sync['field'] == sync['field']:
            continue
        differences = sampled_mismatches(other_ref, actual, points, threshold)
        candidates.append({'reference_case_id': other_name,
                           'frame_delta': offset, 'reference_field': other_sync['field'],
                           'different_samples': differences})
    best = suggest(base, candidates, len(points))
    if best:
        output.update(candidate=best, classification='possible_temporal_offset')
    return output
