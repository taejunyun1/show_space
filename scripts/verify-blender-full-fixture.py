"""Independent Blender receiver for receiver-fixture.test.ts's own synthetic scene.

Checks world geometry/units, courtyard floor, doorway clearance, translated source
normalization, reference placement, all-axis artwork rotation and spot direction.
Does not assert arbitrary user-model compatibility or projector/render fidelity.
"""
import argparse
import hashlib
import itertools
import json
import math
import struct
import sys
from pathlib import Path

import bpy
from mathutils import Vector

parser = argparse.ArgumentParser()
parser.add_argument('--glb', required=True)
parser.add_argument('--project', required=True)
parser.add_argument('--output-dir', required=True)
parser.add_argument('--render', action='store_true')
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
output = Path(args.output_dir).resolve()
output.mkdir(parents=True, exist_ok=True)
project = json.loads(Path(args.project).read_text())
raw = Path(args.glb).read_bytes()
report = {'passed': False, 'status': 'running', 'blenderVersion': bpy.app.version_string,
          'projectId': project['id'], 'glbSHA256': hashlib.sha256(raw).hexdigest()}
report_path = output / 'receiver.json'
def save():
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
save()
assert project['id'] == 'synthetic-receiver-20261007', 'This verifier is for the owned fixture only'
assert raw[:4] == b'glTF' and struct.unpack_from('<II', raw, 4) == (2, len(raw))
doc = json.loads(raw[20:20 + struct.unpack_from('<I', raw, 12)[0]])
assert 'PRIVATE_' not in json.dumps(doc), 'Private app notes leaked'
for asset in doc.get('images', []) + doc.get('buffers', []):
    assert not asset.get('uri') or asset['uri'].startswith('data:'), 'External dependency'
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(Path(args.glb).resolve()))
bpy.context.view_layer.update()

def mesh_children(root):
    return [o for o in [root, *root.children_recursive] if o.type == 'MESH']
def points(root):
    return [o.matrix_world @ v.co for o in mesh_children(root) for v in o.data.vertices]
def bounds(vertices):
    return [[min(v[i] for v in vertices) for i in range(3)],
            [max(v[i] for v in vertices) for i in range(3)]]
def close(actual, expected, label, tolerance=0.00002):
    error = max(abs(a - b) for a, b in zip(actual, expected))
    assert error < tolerance, f'{label}: {actual} != {expected}'
    return error
def check_bounds(root, expected, label):
    assert root, f'Missing {label}'
    actual = bounds(points(root))
    return max(close(a, e, label) for a, e in zip(actual, expected))
def basis(v):
    return Vector((v[0], -v[2], v[1]))  # glTF Y-up -> Blender Z-up
def rotate_xyz(v, degrees):
    # Three XYZ intrinsic rotation: apply Z, then Y, then X to a column vector.
    x, y, z = v
    rx, ry, rz = [math.radians(n) for n in degrees]
    x, y = x * math.cos(rz) - y * math.sin(rz), x * math.sin(rz) + y * math.cos(rz)
    x, z = x * math.cos(ry) + z * math.sin(ry), -x * math.sin(ry) + z * math.cos(ry)
    y, z = y * math.cos(rx) - z * math.sin(rx), y * math.sin(rx) + z * math.cos(rx)
    return Vector((x, y, z))
def placed_bounds(size_mm, position_mm, rotation):
    center = Vector(position_mm) / 1000
    vertices = [basis(rotate_xyz((x, y, z), rotation) + center)
                for x, y, z in itertools.product([-size_mm[0] / 2000, size_mm[0] / 2000],
                                                [0, size_mm[1] / 1000],
                                                [-size_mm[2] / 2000, size_mm[2] / 2000])]
    return bounds(vertices)

wall_errors = []
for w in project['walls']:
    dx, dz = w['end']['x'] - w['start']['x'], w['end']['z'] - w['start']['z']
    length = math.hypot(dx, dz)
    normal = (-dz / length * w['thicknessMm'] / 2, dx / length * w['thicknessMm'] / 2)
    vertices = [basis(((p['x'] + sign * normal[0]) / 1000, y,
                       (p['z'] + sign * normal[1]) / 1000))
                for p in [w['start'], w['end']] for sign in [-1, 1]
                for y in [0, w['heightMm'] / 1000]]
    wall_errors.append(check_bounds(bpy.data.objects.get('wall-' + w['id']), bounds(vertices), w['id']))
report['walls'] = {'count': len(wall_errors), 'maxWorldBoundsErrorM': max(wall_errors)}

floor = bpy.data.objects.get('floor-1')
assert floor and floor.type == 'MESH'
outer = project['importedFloor'][0]
close(bounds(points(floor))[0], [min(p['x'] for p in outer) / 1000, -max(p['z'] for p in outer) / 1000, -.16], 'floor minimum')
close(bounds(points(floor))[1], [max(p['x'] for p in outer) / 1000, -min(p['z'] for p in outer) / 1000, 0], 'floor maximum')
floor.data.calc_loop_triangles()
volume = 0
top_area = 0
for tri in floor.data.loop_triangles:
    a, b, c = [floor.matrix_world @ floor.data.vertices[i].co for i in tri.vertices]
    volume += a.dot(b.cross(c)) / 6
    if max(abs(v.z) for v in [a, b, c]) < .00001:
        top_area += (b - a).cross(c - a).length / 2
def polygon_area(loop):
    return abs(sum(a['x'] * b['z'] - b['x'] * a['z'] for a, b in zip(loop, loop[1:] + loop[:1]))) / 2e6
expected_area = polygon_area(outer) - sum(polygon_area(loop) for loop in project['importedFloor'][1:])
close([abs(volume), top_area], [expected_area * .16, expected_area], 'courtyard volume/top area')
def hit(point, direction, distance):
    depsgraph = bpy.context.evaluated_depsgraph_get()
    return bpy.context.scene.ray_cast(depsgraph, Vector(point), Vector(direction), distance=distance)[0]
assert not hit([2.5, -2.8, .5], [0, 0, -1], .8), 'Courtyard unexpectedly filled'
assert hit([1, -1, .5], [0, 0, -1], .8), 'Expected floor missing'
assert not hit([3, 1, 1], [0, -1, 0], 1.5), 'Doorway blocked by a wall'
assert hit([2, 1, 1], [0, -1, 0], 1.5), 'Doorway control wall missing'
report['floor'] = {'topAreaM2': top_area, 'volumeM3': abs(volume), 'thicknessM': .16,
                   'courtyardEmpty': True, 'doorwayClearWidthM': 1, 'controlRaysPassed': True}

ref = project['referenceModel']
reference = bpy.data.objects.get(ref['name'])
ref_size = [n * ref['scale'] for n in ref['sizeMm']]
ref_error = check_bounds(reference, placed_bounds(ref_size, ref['positionMm'], [0, ref['rotationDeg'], 0]), 'reference model')
assert len(mesh_children(reference)) == 3
report['referenceModel'] = {'meshParts': 3, 'scale': ref['scale'], 'rotationDeg': ref['rotationDeg'],
                            'maxWorldBoundsErrorM': ref_error, 'sourceOffsetNormalized': True}

models = []
for a in project['modelArtworks']:
    root = bpy.data.objects.get('model-artwork-' + a['id'])
    if not a['visible']:
        assert root is None
        continue
    size = [a['widthMm'], a['heightMm'], a['depthMm']]
    error = check_bounds(root, placed_bounds(size, [a['position'][i] for i in ['x', 'y', 'z']],
                                            [a['rotation'][i] for i in ['x', 'y', 'z']]), a['id'])
    assert len(mesh_children(root)) == 3
    metadata = root.get('gonggan')
    assert metadata and metadata['id'] == a['id'] and metadata['artist'] == a['artist']
    close([metadata['widthMm'], metadata['heightMm'], metadata['depthMm']], size, 'artwork metadata dimensions', .001)
    models.append({'id': a['id'], 'sizeMm': size, 'meshParts': 3, 'rotationXYZ': a['rotation'],
                   'maxWorldBoundsErrorM': error, 'publicMetadataPreserved': True})
report['modelArtworks'] = models

lights = [o for o in bpy.data.objects if o.type == 'LIGHT']
assert len(lights) == 1 and lights[0].data.type == 'SPOT', 'Area/projector incorrectly exported as plain spot'
l = next(v for v in project['lights'] if not v.get('projection'))
lamp = lights[0]
close(list(lamp.matrix_world.translation), basis([l['position'][i] / 1000 for i in ['x', 'y', 'z']]), 'spot position')
direction = (lamp.matrix_world.to_3x3() @ Vector((0, 0, -1))).normalized()
expected_direction = basis([l['target'][i] - l['position'][i] for i in ['x', 'y', 'z']]).normalized()
close(list(direction), list(expected_direction), 'spot direction')
close([lamp.data.spot_size], [math.radians(l['beamDeg'])], 'spot angle')
report['lights'] = {'spotDirectionAndConePassed': True, 'projectorNotMisrepresented': True,
                    'photometricEquivalenceChecked': False}
report.update(externalDependencies=False, privateAppNotesAbsent=True,
              scope=['synthetic-world-geometry', 'courtyard-floor', 'doorway-clearance', 'reference-placement',
                     'independent-model-placement', 'hidden-model-exclusion', 'public-model-metadata', 'spot-direction'],
              notChecked=['native-upload-UI', 'arbitrary-user-models', 'SketchUp-import', 'material-render-fidelity',
                          'projector-projection', 'lighting-photometric-equivalence'], renderRequested=args.render)
save()
if args.render:
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.cycles.samples = 24
    scene.cycles.use_denoising = True
    scene.render.resolution_x, scene.render.resolution_y = 1200, 900
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    scene.world = bpy.data.worlds.new('Verification background')
    scene.world.use_nodes = True
    scene.world.node_tree.nodes['Background'].inputs['Color'].default_value = (.7, .7, .7, 1)
    scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value = .8
    mesh_points = [o.matrix_world @ v.co for o in bpy.data.objects if o.type == 'MESH' for v in o.data.vertices]
    low, high = [Vector(v) for v in bounds(mesh_points)]
    center, span = (low + high) / 2, max(high - low)
    camera = bpy.data.objects.new('Verification camera', bpy.data.cameras.new('Verification camera'))
    scene.collection.objects.link(camera)
    scene.camera = camera
    camera.data.type = 'ORTHO'
    camera.data.ortho_scale = span * 1.45
    camera.location = center + Vector((span, -span, span * 1.4))
    camera.rotation_euler = (center - camera.location).to_track_quat('-Z', 'Y').to_euler()
    scene.render.filepath = str(output / 'overview.png')
    bpy.ops.render.render(write_still=True)
    report['render'] = 'overview.png'
report.update(passed=True, status='complete')
save()
print('FULL_RECEIVER_PASS', report['walls'], report['floor'], models)
