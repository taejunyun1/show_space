"""Receive the actual handle-edited GLBs independently of Three/model export.

Owned three-part arch fixture; compare all part vertices, poses and spotlight
aim with saved public Scene data. This does not verify browser/GPU/SketchUp.
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
parser.add_argument('--output', required=True)
parser.add_argument('--wrong-translation-mm', type=float, default=0)
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
directory = Path(args.directory).resolve()
workflow = json.loads((directory / 'workflow.json').read_text())
public = json.loads((directory / 'public.json').read_text())
report = {'passed': False, 'blenderVersion': bpy.app.version_string, 'scenes': [],
          'wrongExpectedTranslationMm': args.wrong_translation_mm, 'gpuMeasured': False,
          'limits': ['Owned synthetic arch, actual independent CPU importer and geometry',
                     'No browser/GPU/SketchUp/operational URL acceptance']}
def save():
    Path(args.output).write_text(json.dumps(report, indent=2) + '\n')

def world_point(point, model):
    x, y, z = [point[i] * model[k] / size for i, (k, size) in enumerate(
        [('widthMm', 1200), ('heightMm', 2100), ('depthMm', 900)])]
    rx, ry, rz = [model['rotation'][k] * math.pi / 180 for k in ['x', 'y', 'z']]
    # Three XYZ intrinsic Euler: R = Rx Ry Rz, then glTF Y-up -> Blender Z-up.
    x, y = x * math.cos(rz) - y * math.sin(rz), x * math.sin(rz) + y * math.cos(rz)
    x, z = x * math.cos(ry) + z * math.sin(ry), -x * math.sin(ry) + z * math.cos(ry)
    y, z = y * math.cos(rx) - z * math.sin(rx), y * math.sin(rx) + z * math.cos(rx)
    p = model['position']
    return Vector((x + (p['x'] + args.wrong_translation_mm) / 1000,
                   -(z + p['z'] / 1000), y + p['y'] / 1000))

save()
try:
    for item in workflow['scenes']:
        path = directory / item['file']
        assert hashlib.sha256(path.read_bytes()).hexdigest() == item['sha256']
        snapshot = next(s for s in public['scenes'] if s['name'] == item['name'])['snapshot']
        bpy.ops.wm.read_factory_settings(use_empty=True)
        bpy.ops.import_scene.gltf(filepath=str(path))
        bpy.context.view_layer.update()
        meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
        assert len(meshes) == 11, len(meshes)
        model_errors, triangles = [], 0
        for model in snapshot['modelArtworks']:
            root = bpy.data.objects.get('model-artwork-' + model['id'])
            assert root, model['id']
            parts = [o for o in root.children_recursive if o.type == 'MESH']
            assert len(parts) == 3, len(parts)
            boxes = [((-.475, .925, 0), (.25, 1.85, .9)),
                     ((.475, .925, 0), (.25, 1.85, .9)),
                     ((0, 1.975, 0), (1.2, .25, .9))]
            expected = [[world_point(tuple(center[i] + sign[i] * size[i] / 2 for i in range(3)), model)
                         for sign in [(x, y, z) for x in [-1, 1] for y in [-1, 1] for z in [-1, 1]]]
                        for center, size in boxes]
            matched, errors = set(), []
            for part in parts:
                actual = [part.matrix_world @ v.co for v in part.data.vertices]
                candidates = [max(min((p - q).length for q in box) for p in actual) for box in expected]
                best = min(range(3), key=lambda i: candidates[i])
                error_mm = candidates[best] * 1000
                assert error_mm < .01, f'{model["id"]}: part vertices differ by {error_mm} mm'
                assert best not in matched
                matched.add(best)
                errors.append(error_mm)
                part.data.calc_loop_triangles()
                triangles += len(part.data.loop_triangles)
            model_errors.append(max(errors))
        assert triangles == 72, triangles
        light = snapshot['lights'][0]
        lamps = [o for o in bpy.context.scene.objects if o.type == 'LIGHT' and o.data.type == 'SPOT']
        assert len(lamps) == 1
        p, t = light['position'], light['target']
        expected_position = Vector((p['x'] / 1000, -p['z'] / 1000, p['y'] / 1000))
        expected_target = Vector((t['x'] / 1000, -t['z'] / 1000, t['y'] / 1000))
        light_error = (lamps[0].matrix_world.translation - expected_position).length * 1000
        aim_error = ((lamps[0].matrix_world.to_3x3() @ Vector((0, 0, -1))).normalized()
                     - (expected_target - expected_position).normalized()).length
        assert light_error < .01 and aim_error < .00001, (light_error, aim_error)
        report['scenes'].append({'name': item['name'], 'meshObjects': len(meshes),
                                 'modelParts': 6, 'modelTriangles': triangles,
                                 'modelPartVertexErrorsMm': model_errors,
                                 'lightPositionErrorMm': light_error, 'lightAimVectorError': aim_error})
    report['passed'] = True
except Exception as error:
    report['error'] = str(error)
    save()
    print(json.dumps(report))
    raise SystemExit(1)
save()
print(json.dumps(report))
