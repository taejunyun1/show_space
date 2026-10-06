"""Run inside Blender to verify a Gonggan GLB against its native project JSON.

blender --background --factory-startup --python-exit-code 1 --python scripts/verify-blender-export.py -- \
  --glb exported.glb --project project.json --output-dir validation [--render]

Uses Blender's independent importer. Rendering adds a proof camera/world only;
imported geometry, images and lights remain unchanged. Does not publish assets.
Checks solid straight walls and mounted image artworks; does not validate openings,
floors, imported reference models or independent 3D artworks.
"""
import argparse
import hashlib
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
bytes_glb = Path(args.glb).read_bytes()
report_path = output / 'receiver.json'
# Replace any previous success before assertions/import/rendering can fail.
report_path.write_text(json.dumps({'passed': False, 'status': 'running',
                                  'glbSHA256': hashlib.sha256(bytes_glb).hexdigest()}, indent=2) + '\n')
assert bytes_glb[:4] == b'glTF' and struct.unpack_from('<II', bytes_glb, 4) == (2, len(bytes_glb))
chunk_size = struct.unpack_from('<I', bytes_glb, 12)[0]
document = json.loads(bytes_glb[20:20 + chunk_size])
json_text = json.dumps(document, ensure_ascii=False)
assert 'noteDetails' not in json_text, 'Private notes leaked into the exported document'
assert not project.get('openings'), 'Opening geometry is outside this verifier scope'
for buffer in document.get('buffers', []):
    assert not buffer.get('uri') or buffer['uri'].startswith('data:'), 'External buffer dependency'
for image in document.get('images', []):
    assert not image.get('uri') or image['uri'].startswith('data:'), 'External image dependency'

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(Path(args.glb).resolve()))
bpy.context.view_layer.update()

def close(actual, expected, label):
    error = max(abs(a - b) for a, b in zip(actual, expected))
    assert error < 0.00002, f'{label}: {actual} differs from {expected}'
    return error

def world_bounds(obj):
    points = [obj.matrix_world @ Vector(v) for v in obj.bound_box]
    return [[min(v[i] for v in points) for i in range(3)],
            [max(v[i] for v in points) for i in range(3)]]

def texture_nodes(obj):
    return [n for m in obj.data.materials if m and m.use_nodes for n in m.node_tree.nodes if n.type == 'TEX_IMAGE']

walls = []
for wall in project['walls']:
    obj = bpy.data.objects.get('wall-' + wall['id'])
    if not wall['visible']:
        assert obj is None
        continue
    assert obj and obj.type == 'MESH', f'Missing wall {wall["id"]}'
    dx, dz = wall['end']['x'] - wall['start']['x'], wall['end']['z'] - wall['start']['z']
    length = math.hypot(dx, dz)
    nx, nz = -dz / length * wall['thicknessMm'] / 2, dx / length * wall['thicknessMm'] / 2
    points = [(p['x'] + sign * nx, -(p['z'] + sign * nz)) for p in [wall['start'], wall['end']] for sign in [-1, 1]]
    expected = [[min(v[0] for v in points) / 1000, min(v[1] for v in points) / 1000, 0],
                [max(v[0] for v in points) / 1000, max(v[1] for v in points) / 1000, wall['heightMm'] / 1000]]
    actual = world_bounds(obj)
    errors = [close(a, e, wall['id']) for a, e in zip(actual, expected)]
    entry = {'id': wall['id'], 'lengthM': length / 1000, 'heightM': wall['heightMm'] / 1000,
             'thicknessM': wall['thicknessMm'] / 1000, 'maxWorldBoundsErrorM': max(errors)}
    texture = wall.get('material', {}).get('texture')
    if texture:
        nodes = texture_nodes(obj)
        assert nodes and all(n.image and n.image.packed_file and n.extension == 'REPEAT' for n in nodes)
        mappings = [n for m in obj.data.materials if m.use_nodes for n in m.node_tree.nodes if n.type == 'MAPPING']
        expected_scale = [1000 / texture['widthMm'], 1000 / texture['heightMm'], 1]
        assert mappings, 'No imported texture transform'
        close(list(mappings[0].inputs['Scale'].default_value), expected_scale, 'Texture repeat scale')
        uv = [v.uv for v in obj.data.uv_layers.active.data]
        uv_span = [max(v[i] for v in uv) - min(v[i] for v in uv) for i in [0, 1]]
        close(uv_span, [length / 1000, wall['heightMm'] / 1000], 'Metric wall UVs')
        entry['texture'] = {'repeatScale': expected_scale, 'uvSpanM': uv_span,
                            'imagesPacked': True, 'wrapping': 'REPEAT'}
    walls.append(entry)

artworks = []
for art in project['artworks']:
    wall = next(w for w in project['walls'] if w['id'] == art['wallId'])
    root = bpy.data.objects.get('artwork-' + art['id'])
    if not art['visible'] or not wall['visible']:
        assert root is None
        continue
    assert root, f'Missing artwork {art["id"]}'
    image = next((o for o in root.children if o.type == 'MESH' and o.name.split('.')[0] == 'image'), None)
    assert image, f'Missing artwork image {art["id"]}'
    nodes = texture_nodes(image)
    assert nodes and all(n.image and n.image.packed_file for n in nodes)
    vertices = image.data.vertices
    spans = sorted(max(v.co[i] for v in vertices) - min(v.co[i] for v in vertices) for i in range(3))
    error = close(spans, sorted([0, art['widthMm'] / 1000, art['heightMm'] / 1000]), art['id'])
    artworks.append({'id': art['id'], 'widthM': art['widthMm'] / 1000, 'heightM': art['heightMm'] / 1000,
                     'maxLocalImageErrorM': error, 'imagePacked': True})

report = {'blenderVersion': bpy.app.version_string, 'glbFile': Path(args.glb).name,
          'glbSHA256': hashlib.sha256(bytes_glb).hexdigest(), 'projectId': project['id'],
          'importedObjects': len(bpy.data.objects), 'meshObjects': sum(o.type == 'MESH' for o in bpy.data.objects),
          'images': [{'name': i.name, 'sizePx': list(i.size), 'packed': bool(i.packed_file)} for i in bpy.data.images],
          'lights': [{'name': o.name, 'type': o.data.type} for o in bpy.data.objects if o.type == 'LIGHT'],
          'walls': walls, 'artworks': artworks, 'privateNoteDetailsAbsent': True,
          'externalAssetDependencies': False, 'geometryAndTexturesPassed': True,
          'renderRequested': args.render, 'passed': False, 'status': 'running', 'renders': [],
          'scope': ['solid-straight-walls', 'mounted-image-dimensions', 'packed-images', 'wall-texture-repeat'],
          'notChecked': ['floor', 'openings', 'reference-models', 'independent-3d-artworks',
                         'artwork-placement', 'lighting-fidelity', 'SketchUp-compatibility']}
report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
print('RECEIVER_GEOMETRY_AND_TEXTURE_PASS', len(walls), len(artworks))

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
    scene.world.node_tree.nodes['Background'].inputs['Color'].default_value = (.8, .8, .8, 1)
    scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value = .6
    camera = bpy.data.objects.new('Verification camera', bpy.data.cameras.new('Verification camera'))
    scene.collection.objects.link(camera)
    scene.camera = camera
    camera.data.type = 'ORTHO'
    mesh_points = [o.matrix_world @ Vector(v) for o in bpy.data.objects if o.type == 'MESH' for v in o.bound_box]
    low = Vector([min(v[i] for v in mesh_points) for i in range(3)])
    high = Vector([max(v[i] for v in mesh_points) for i in range(3)])
    center, span = (low + high) / 2, max(high - low)
    views = [('overview', center, center + Vector((span, -span, span)), span * 1.45)]
    first = next((w for w in project['walls'] if w['visible'] and w.get('material', {}).get('texture')), None)
    if first:
        dx, dz = first['end']['x'] - first['start']['x'], first['end']['z'] - first['start']['z']
        length = math.hypot(dx, dz)
        wall_center = Vector([(first['start']['x'] + first['end']['x']) / 2000,
                              -(first['start']['z'] + first['end']['z']) / 2000, first['heightMm'] / 2000])
        views.append(('texture-wall', wall_center, wall_center + Vector((-dz / length * 8, -dx / length * 8, .4)), length / 1000 * 1.15))
    for name, target, position, scale in views:
        camera.location = position
        camera.rotation_euler = (target - position).to_track_quat('-Z', 'Y').to_euler()
        camera.data.ortho_scale = scale
        scene.render.filepath = str(output / (name + '.png'))
        bpy.ops.render.render(write_still=True)
        report['renders'].append(name + '.png')
        report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print('RECEIVER_RENDER_PASS', report['renders'])
report.update(passed=True, status='complete')
report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
