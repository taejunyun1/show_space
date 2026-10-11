"""Independently receive actual GLBs after React pointer edits of the owned fixture.

Check rolled image corners, installation, side-specific extents and floor;
optional Cycles images use CPU, not the app's browser/GPU capture.
"""
import argparse
import hashlib
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector

parser = argparse.ArgumentParser()
parser.add_argument('--directory', required=True)
parser.add_argument('--output-dir', required=True)
parser.add_argument('--render', action='store_true')
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
directory, output = Path(args.directory).resolve(), Path(args.output_dir).resolve()
output.mkdir(parents=True, exist_ok=True)
workflow = json.loads((directory / 'workflow.json').read_text())
public = json.loads((directory / 'public.json').read_text())
assert hashlib.sha256((directory / 'input.glb').read_bytes()).hexdigest() == workflow['sourceHash']
report = {'passed': False, 'blenderVersion': bpy.app.version_string, 'scenes': [],
          'gpuMeasured': False, 'limitations': ['Owned convertible model only',
          'CPU importer/geometry/images/render, not browser/GPU/SketchUp acceptance']}
def save():
    (output / 'receiver.json').write_text(json.dumps(report, indent=2) + '\n')
save()
for item in workflow['scenes']:
    path = directory / item['file']
    assert hashlib.sha256(path.read_bytes()).hexdigest() == item['sha256']
    snapshot = next(s for s in public['scenes'] if s['name'] == item['name'])['snapshot']
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(path))
    bpy.context.view_layer.update()
    meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    assert len(meshes) == 15, len(meshes)
    assert not bpy.data.objects.get('EditableVenue.glb')
    intervals, expected_intervals, images, max_error, max_corner_error = [], [], set(), 0, 0
    for art in snapshot['artworks']:
        root = bpy.data.objects.get('artwork-' + art['id'])
        assert root, art['id']
        wall = next(w for w in snapshot['walls'] if w['id'] == art['wallId'])
        length = math.hypot(wall['end']['x'] - wall['start']['x'], wall['end']['z'] - wall['start']['z'])
        dx, dz = [(wall['end'][k] - wall['start'][k]) / length for k in ['x', 'z']]
        side = -1 if art.get('wallSide') == 'back' else 1
        offset = (wall['thicknessMm'] + art['depthMm']) / 2 + 5
        expected = Vector(((wall['start']['x'] + dx * art['alongMm'] - dz * side * offset) / 1000,
                           -(wall['start']['z'] + dz * art['alongMm'] + dx * side * offset) / 1000,
                           art['centerHeightMm'] / 1000))
        error = (root.matrix_world.translation - expected).length
        assert error < .00002, f'{art["id"]}: physical installation mismatch'
        max_error = max(max_error, error)
        image_mesh = next(o for o in root.children_recursive if o.type == 'MESH' and o.name.startswith('image'))
        points = [image_mesh.matrix_world @ v.co for v in image_mesh.data.vertices]
        tangent = Vector((dx, -dz, 0))
        axis = [p.dot(tangent) for p in points]
        lo, hi = min(axis), max(axis)
        angle = math.radians(art.get('rotationDeg', 0))
        corners = []
        for u in [-art['widthMm'] / 2000, art['widthMm'] / 2000]:
            for v in [-art['heightMm'] / 2000, art['heightMm'] / 2000]:
                x, y, z = u * math.cos(angle) - v * math.sin(angle), u * math.sin(angle) + v * math.cos(angle), (art['depthMm'] / 2 + .01) / 1000
                corners.append(expected + Vector((dx * side * x - dz * side * z,
                                                  -(dz * side * x + dx * side * z), y)))
        corner_error = max(min((p - c).length for c in corners) for p in points)
        assert corner_error < .00002, f'{art["id"]}: image corner mismatch'
        max_corner_error = max(max_corner_error, corner_error)
        outer_width = (abs(art['widthMm'] * math.cos(angle)) + abs(art['heightMm'] * math.sin(angle))) / 1000
        outer_height = (abs(art['widthMm'] * math.sin(angle)) + abs(art['heightMm'] * math.cos(angle))) / 1000
        assert abs(hi - lo - outer_width) < .00002
        assert abs(max(p.z for p in points) - min(p.z for p in points) - outer_height) < .00002
        expected_intervals.append((expected.dot(tangent) - outer_width / 2, expected.dot(tangent) + outer_width / 2))
        intervals.append((lo, hi))
        material = image_mesh.active_material
        image = next(n.image for n in material.node_tree.nodes if n.type == 'TEX_IMAGE')
        assert list(image.size) == [32, 48] and image.packed_file
        images.add(image.name)
    assert len(intervals) == len(images) == 5
    intervals.sort()
    gaps = [(intervals[i + 1][0] - intervals[i][1]) * 1000 for i in range(4)]
    expected_intervals.sort()
    expected_gaps = [(expected_intervals[i + 1][0] - expected_intervals[i][1]) * 1000 for i in range(4)]
    assert all(abs(a - b) < .02 for a, b in zip(gaps, expected_gaps)), gaps
    floor = bpy.data.objects.get('floor-1')
    assert floor and len([o for o in meshes if o.name.startswith('wall-')]) == 4
    floor.data.calc_loop_triangles()
    floor_area = 0
    for tri in floor.data.loop_triangles:
        a, b, c = [floor.matrix_world @ floor.data.vertices[v].co for v in tri.vertices]
        if max(abs(v.z) for v in [a, b, c]) < .00002:
            floor_area += (b - a).cross(c - a).length / 2
    assert abs(floor_area - workflow['floorAreaMm2'] / 1e6) < .0001, floor_area
    entry = {'file': item['file'], 'sha256': item['sha256'], 'meshes': len(meshes),
             'installedArtworks': 5, 'packedImages': 5, 'imagePixels': [32, 48],
             'physicalPositionMaxErrorM': max_error, 'imageCornerMaxErrorM': max_corner_error, 'gapsMm': gaps, 'floorAreaM2': floor_area}
    if args.render:
        scene = bpy.context.scene
        scene.render.engine, scene.cycles.device = 'CYCLES', 'CPU'
        scene.cycles.samples, scene.cycles.use_denoising = 16, True
        scene.render.resolution_x, scene.render.resolution_y = 1000, 700
        scene.render.resolution_percentage = 100
        scene.render.image_settings.file_format = 'PNG'
        scene.world = bpy.data.worlds.new('Converted venue verification')
        scene.world.use_nodes = True
        scene.world.node_tree.nodes['Background'].inputs['Color'].default_value = (.7, .7, .7, 1)
        scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value = .8
        center = Vector(((wall['start']['x'] + wall['end']['x']) / 2000,
                         -(wall['start']['z'] + wall['end']['z']) / 2000, 1.7))
        camera = bpy.data.objects.new('Verification camera', bpy.data.cameras.new('Verification camera'))
        scene.collection.objects.link(camera)
        scene.camera = camera
        camera.data.type, camera.data.ortho_scale = 'ORTHO', 6
        camera.location = center + Vector((-dz * side * 1.5, -dx * side * 1.5, .25))
        camera.rotation_euler = (center - camera.location).to_track_quat('-Z', 'Y').to_euler()
        scene.render.filepath = str(output / (path.stem + '.png'))
        bpy.ops.render.render(write_still=True)
        entry['cpuRender'] = path.stem + '.png'
    report['scenes'].append(entry)
    save()
report['passed'] = True
save()
print('POINTER_DELIVERY_RECEIVER_PASS', report['scenes'])
