"""Receive this repository's own 30-room fixture, not arbitrary user venues.

Checks two actual delivery files, world units/bounds, complete meshes and 30
courtyards versus 30 solid floor probes. Optional images use Cycles CPU only.
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
assert workflow['sourceHash'] == '1280dbd22b847a5e089a74d6f9830d6f62ca653b5d955018e824fde137960efe'
report = {'passed': False, 'blenderVersion': bpy.app.version_string, 'scenes': [],
          'gpuMeasured': False, 'renderRequested': args.render,
          'limitations': ['Owned synthetic 30-room venue, not representative user acceptance',
                          'CPU importer/ray/render, not browser/GPU/SketchUp or photometry']}
def save():
    (output / 'receiver.json').write_text(json.dumps(report, indent=2) + '\n')
save()
for item in workflow['scenes']:
    name = item['name'].replace(' ', '-')
    path = directory / (name + '.glb')
    assert hashlib.sha256(path.read_bytes()).hexdigest() == item['sha256']
    model = next(s for s in public['scenes'] if s['name'] == item['name'])['snapshot']['referenceModel']
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(path))
    bpy.context.view_layer.update()
    root = bpy.data.objects.get('WholeVenue')
    assert root
    meshes = [o for o in [root, *root.children_recursive] if o.type == 'MESH']
    assert len(meshes) == 450
    triangles = 0
    for mesh in meshes:
        mesh.data.calc_loop_triangles()
        triangles += len(mesh.data.loop_triangles)
    assert triangles == 5400
    points = [o.matrix_world @ v.co for o in meshes for v in o.data.vertices]
    actual = [[min(v[i] for v in points) for i in range(3)],
              [max(v[i] for v in points) for i in range(3)]]
    lo, hi = item['bounds']['min'], item['bounds']['max']
    expected = [[lo[0], -hi[2], lo[1]], [hi[0], -lo[2], hi[1]]]
    error = max(abs(a - e) for av, ev in zip(actual, expected) for a, e in zip(av, ev))
    assert error < .00002, f'{name}: world bounds mismatch'
    depsgraph = bpy.context.evaluated_depsgraph_get()
    yaw = math.radians(model['rotationDeg'])
    c, s = math.cos(yaw), math.sin(yaw)
    holes, solids = 0, 0
    for row in range(5):
        for col in range(6):
            for solid in [False, True]:
                x = (10 + col * 12 + (-3.5 if solid else 0) + model['sourceOffsetM'][0]) * model['scale']
                z = (5 + row * 8 + model['sourceOffsetM'][2]) * model['scale']
                pos = model['positionMm']
                origin = Vector((c * x + s * z + pos[0] / 1000,
                                 -(-s * x + c * z + pos[2] / 1000),
                                 pos[1] / 1000 + model['sizeMm'][1] * model['scale'] / 1000 + 10))
                hit = bpy.context.scene.ray_cast(depsgraph, origin, Vector((0, 0, -1)))[0]
                assert hit == solid, f'{name} room {row}/{col}, solid={solid}: {hit}'
                if solid:
                    solids += 1
                else:
                    holes += 1
    entry = {'name': name, 'sha256': item['sha256'], 'meshes': len(meshes),
             'triangles': triangles, 'maxWorldBoundsErrorM': error,
             'emptyCourtyards': holes, 'solidFloorHits': solids}
    if args.render:
        scene = bpy.context.scene
        scene.render.engine, scene.cycles.device = 'CYCLES', 'CPU'
        scene.cycles.samples = 16
        scene.cycles.use_denoising = True
        scene.render.resolution_x, scene.render.resolution_y = 1000, 700
        scene.render.resolution_percentage = 100
        scene.render.image_settings.file_format = 'PNG'
        scene.world = bpy.data.worlds.new('Whole venue verification')
        scene.world.use_nodes = True
        scene.world.node_tree.nodes['Background'].inputs['Color'].default_value = (.7, .7, .7, 1)
        scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value = .8
        low, high = [Vector(v) for v in actual]
        center, span = (low + high) / 2, max(high - low)
        camera = bpy.data.objects.new('Verification camera', bpy.data.cameras.new('Verification camera'))
        scene.collection.objects.link(camera)
        scene.camera = camera
        camera.data.type, camera.data.ortho_scale = 'ORTHO', span * 1.6
        camera.location = center + Vector((span * .8, -span, span * 1.3))
        camera.rotation_euler = (center - camera.location).to_track_quat('-Z', 'Y').to_euler()
        scene.render.filepath = str(output / (name + '.png'))
        bpy.ops.render.render(write_still=True)
        entry['cpuRender'] = name + '.png'
    report['scenes'].append(entry)
    save()
report['passed'] = True
save()
print('WHOLE_VENUE_RECEIVER_PASS', report['scenes'])
