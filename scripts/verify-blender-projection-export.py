"""Independent receiver of the owned projector-omission fixture.
Checks real GLB/glTF light definitions/imports, source geometry and disclosure;
never claims that a projected image is rendered or baked in either format.
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

parser=argparse.ArgumentParser()
parser.add_argument('--glb',required=True)
parser.add_argument('--gltf',required=True)
parser.add_argument('--project',required=True)
parser.add_argument('--report',required=True)
args=parser.parse_args(sys.argv[sys.argv.index('--')+1:])
report_path=Path(args.report).resolve()
report_path.parent.mkdir(parents=True,exist_ok=True)
report={'passed':False,'scope':'owned synthetic fixture; actual GLB/glTF Blender imports','blenderVersion':bpy.app.version_string,'projectionAppearanceVerified':False}
def save():report_path.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
save()
p=json.loads(Path(args.project).read_text())
assert p['id']=='synthetic-projection-receiver-20261007','Owned fixture only'
counts={'projectors':sum(bool(l.get('visible') and l.get('projection')) for l in p['lights']),'areaLights':sum(bool(l.get('visible') and l['kind']=='area') for l in p['lights'])}
spots=[l for l in p['lights'] if l['visible'] and l['kind']=='spot' and not l.get('projection')]
assert len(spots)==1,'Fixture requires exactly one ordinary spot'
source=spots[0]
def basis(v):return Vector((v[0],-v[2],v[1]))
def close(a,b,label,tolerance=0.00002):
 error=max(abs(x-y) for x,y in zip(a,b))
 assert error<tolerance,f'{label}: {list(a)} != {list(b)}'
 return error

def verify(path,doc):
 assert doc['asset']['version']=='2.0'
 disclosure=doc['scenes'][doc.get('scene',0)]['extras']['gongganExport']
 assert disclosure=={'version':1,'units':'meter','omittedLights':counts},'Omission disclosure mismatch'
 definitions=doc['extensions']['KHR_lights_punctual']['lights']
 assert len(definitions)==1,'Unexpected ghost projector or Area light definition'
 assert definitions[0]['type']=='spot','Expected ordinary spot'
 close([definitions[0]['intensity']],[source['intensity']],'spot intensity')
 close([definitions[0]['spot']['outerConeAngle']],[math.radians(source['beamDeg']/2)],'spot outer cone')
 assert not doc.get('images'),'Projector-only images must not enter GLB/glTF scene'
 assert all('PRIVATE' not in str(n) for n in [doc]),'Internal Notes leaked'
 assert all(l['id'] not in json.dumps(doc) for l in p['lights'] if l.get('projection') or l['kind']=='area'),'Unsupported light identities leaked'
 bpy.ops.wm.read_factory_settings(use_empty=True)
 bpy.ops.import_scene.gltf(filepath=str(path.resolve()))
 bpy.context.view_layer.update()
 lights=[o for o in bpy.data.objects if o.type=='LIGHT']
 assert len(lights)==1 and lights[0].data.type=='SPOT','Unexpected received light'
 light=lights[0]
 expected_position=basis([source['position'][k]/1000 for k in ['x','y','z']])
 position_error=close(light.matrix_world.translation,expected_position,'received light position')
 expected_direction=basis([source['target'][k]-source['position'][k] for k in ['x','y','z']]).normalized()
 actual_direction=(light.matrix_world.to_quaternion()@Vector((0,0,-1))).normalized()
 direction_error=close(actual_direction,expected_direction,'received light direction')
 close([light.data.spot_size],[math.radians(source['beamDeg'])],'received beam angle')
 walls=[o for o in bpy.data.objects if o.type=='MESH' and o.name.startswith('wall-')]
 assert len(walls)==sum(w['visible'] for w in p['walls']),'Wall visibility mismatch'
 floors=[o for o in bpy.data.objects if o.type=='MESH' and o.name.startswith('floor-')]
 assert len(floors)==1,'Missing floor'
 floor=floors[0];floor.data.calc_loop_triangles();area=0
 for t in floor.data.loop_triangles:
  a,b,c=[floor.matrix_world@floor.data.vertices[i].co for i in t.vertices]
  if max(abs(v.z) for v in [a,b,c])<.00001:area+=(b-a).cross(c-a).length/2
 close([area],[36],'floor top area')
 vertices=[floor.matrix_world@v.co for v in floor.data.vertices]
 close([min(v.z for v in vertices),max(v.z for v in vertices)],[-.16,0],'floor thickness')
 reference=bpy.data.objects.get('reference-space')
 assert reference and len([o for o in reference.children_recursive if o.type=='MESH'])==3,'Reference GLB geometry missing'
 return {'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'omittedLights':counts,'lightDefinitions':1,'receivedLights':1,'walls':len(walls),'floorAreaM2':area,'referenceMeshes':3,'maxSpotPositionErrorM':position_error,'maxSpotDirectionError':direction_error,'projectorImageAbsent':True,'privateNotesAbsent':True}

try:
 glb=Path(args.glb);raw=glb.read_bytes()
 assert raw[:4]==b'glTF' and struct.unpack_from('<II',raw,4)==(2,len(raw))
 binary_doc=json.loads(raw[20:20+struct.unpack_from('<I',raw,12)[0]])
 gltf=Path(args.gltf);text_doc=json.loads(gltf.read_text())
 for resource in text_doc.get('buffers',[])+text_doc.get('images',[]):
  uri=resource.get('uri');assert uri and not uri.startswith(('data:','http:','https:','/')) and '..' not in Path(uri).parts,'Non-portable relative resource'
  assert (gltf.parent/uri).is_file(),'Missing relative resource'
 manifest=json.loads((gltf.parent/'export-report.json').read_text())
 assert manifest['omittedLights']==counts,'glTF report omission mismatch'
 report['glb']=verify(glb,binary_doc)
 report['gltf']=verify(gltf,text_doc)
 report['passed']=True
except Exception as error:
 report['error']=str(error);save();raise
save()
print(json.dumps(report,ensure_ascii=False,indent=2))
