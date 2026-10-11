"""Independent receiver for the pinned CC0 BoomBox's two exported Scene poses.

Checks Blender world geometry and imported PBR links, then optionally renders on
CPU. This is neither a browser/GPU test nor arbitrary venue/SketchUp acceptance.
"""
import argparse
import hashlib
import json
import sys
from pathlib import Path

import bpy
from mathutils import Vector

parser = argparse.ArgumentParser()
parser.add_argument('--directory', required=True)
parser.add_argument('--workflow')
parser.add_argument('--output-dir', required=True)
parser.add_argument('--render', action='store_true')
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
directory = Path(args.directory).resolve()
output = Path(args.output_dir).resolve()
output.mkdir(parents=True, exist_ok=True)
workflow = json.loads(Path(args.workflow or directory / 'workflow.json').read_text())
report = {'passed': False, 'blenderVersion': bpy.app.version_string, 'gpuMeasured': False,
          'renderRequested': args.render, 'scenes': [],
          'limitations': ['CPU importer/render; not browser, GPU, arbitrary venue or SketchUp',
                          'PBR node wiring/packed images checked; no photometric equivalence']}
def save():
    (output / 'receiver.json').write_text(json.dumps(report, indent=2) + '\n')
save()
assert workflow['sourceHash'] == 'f8b918445ebdd006768232205a62f5182d2208ca57f84c6ccc084943c0bc8f15'
for item in workflow['scenes']:
    name = item['name'].replace(' ', '-')
    path = directory / (name + '.glb')
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    assert digest == item['glbSHA256'], 'Output file differs from integration proof'
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(path))
    bpy.context.view_layer.update()
    root = bpy.data.objects.get('model-artwork-' + item['artwork']['id'])
    assert root, 'Missing artwork root'
    meshes = [o for o in [root, *root.children_recursive] if o.type == 'MESH']
    assert len(meshes) == 1
    mesh = meshes[0]
    assert len(mesh.data.vertices) == workflow['sourceVertices']
    mesh.data.calc_loop_triangles()
    assert len(mesh.data.loop_triangles) == workflow['sourceTriangles']
    assert len(mesh.data.uv_layers) == 1
    vertices = [mesh.matrix_world @ v.co for v in mesh.data.vertices]
    actual = [[min(v[i] for v in vertices) for i in range(3)],
              [max(v[i] for v in vertices) for i in range(3)]]
    lo, hi = item['bounds']['min'], item['bounds']['max']
    expected = [[lo[0], -hi[2], lo[1]], [hi[0], -lo[2], hi[1]]]
    error = max(abs(a - e) for av, ev in zip(actual, expected) for a, e in zip(av, ev))
    assert error < .00002, f'{name} world bounds mismatch: {actual} != {expected}'
    material = mesh.data.materials[0]
    textures = [n for n in material.node_tree.nodes if n.type == 'TEX_IMAGE']
    images = {n.image.name: n.image for n in textures if n.image}
    assert len(images) == 4
    assert all(tuple(image.size) == (1024, 1024) and image.packed_file for image in images.values())
    principled = next(n for n in material.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    links = {key: principled.inputs[key].is_linked for key in
             ['Base Color', 'Metallic', 'Roughness', 'Normal', 'Emission Color']}
    assert all(links.values()), f'Missing PBR links: {links}'
    ao = [n for n in material.node_tree.nodes if n.type == 'GROUP' and 'Occlusion' in n.inputs]
    assert any(n.inputs['Occlusion'].is_linked for n in ao), 'Missing occlusion texture'
    entry = {'name': name, 'glbSHA256': digest, 'meshes': 1, 'vertices': len(mesh.data.vertices),
             'triangles': len(mesh.data.loop_triangles), 'maxWorldBoundsErrorM': error,
             'packedImages': len(images), 'imageSize': 1024, 'principledTextureLinks': links,
             'occlusionLinked': True}
    if args.render:
        scene = bpy.context.scene
        scene.render.engine = 'CYCLES'
        scene.cycles.device = 'CPU'
        scene.cycles.samples = 16
        scene.cycles.use_denoising = True
        scene.render.resolution_x, scene.render.resolution_y = 768, 512
        scene.render.resolution_percentage = 100
        scene.render.image_settings.file_format = 'PNG'
        scene.world = bpy.data.worlds.new('External model verification')
        scene.world.use_nodes = True
        scene.world.node_tree.nodes['Background'].inputs['Color'].default_value = (.25, .3, .4, 1)
        scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value = .6
        low, high = [Vector(v) for v in actual]
        center, span = (low + high) / 2, max(high - low)
        camera = bpy.data.objects.new('Verification camera', bpy.data.cameras.new('Verification camera'))
        scene.collection.objects.link(camera)
        scene.camera = camera
        camera.data.type = 'ORTHO'
        camera.data.ortho_scale = span * 1.6
        camera.location = center + Vector((span, -span * 2, span))
        camera.rotation_euler = (center - camera.location).to_track_quat('-Z', 'Y').to_euler()
        light = bpy.data.objects.new('Verification area', bpy.data.lights.new('Verification area', 'AREA'))
        scene.collection.objects.link(light)
        light.data.energy, light.data.size = 100, span * 3
        light.location = center + Vector((-span, -span, span * 2))
        light.rotation_euler = (center - light.location).to_track_quat('-Z', 'Y').to_euler()
        scene.render.filepath = str(output / (name + '.png'))
        bpy.ops.render.render(write_still=True)
        entry['cpuRender'] = name + '.png'
    report['scenes'].append(entry)
    save()
report['passed'] = True
save()
print('EXTERNAL_MODEL_RECEIVER_PASS', report['scenes'])
