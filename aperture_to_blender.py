import bpy;
from math import pi
from numpy import array, cos, deg2rad, linalg, linspace, matrix, sin
from xml.dom import minidom

def polarCoordinates(rho, phi):
    x = rho * cos(phi)
    y = rho * sin(phi)
    return(x, y)

def scaleAllCurves(dimensions, totalRotation):
	scene = bpy.context.scene
	pieces = {}
	for ob in scene.objects:
		if ob.type == 'CURVE':
			ob.select = True
			name_parts = ob.name.split("-")
			pieceIdx = name_parts[1]
			partIdx = name_parts[5]
			if pieceIdx not in pieces:
				pieces[pieceIdx] = {}
			pieces[pieceIdx][partIdx] = buildPiece(ob, int(pieceIdx), name_parts[3], int(partIdx), 0.01)
		else: 
			ob.select = False
	bpy.ops.transform.resize(value=(1/dimensions[0], 1/dimensions[1], 1))
	for pieceIdx, layers in pieces.items():
		bpy.ops.object.select_all(action='DESELECT')
		bpy.context.scene.objects.active = None
		for layerIdx in sorted(layers.keys()):
			bpy.context.scene.objects.active = layers[layerIdx]
			layers[layerIdx].select = True
			bpy.context.scene.cursor_location = polarCoordinates(0.5, (2 * pi * float(pieceIdx)) / len(pieces)) + (layers[layerIdx].location.z,)
			bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
		bpy.ops.object.join()
		animate_part(bpy.context.scene.objects.active, (0,0), totalRotation)

def animate_part(part, center, total_rotation):
	part.keyframe_insert(data_path='rotation_euler', frame=1)
	part.keyframe_insert(data_path='location', frame=1)
	part.rotation_euler = (0, 0, total_rotation)
	part.location = center + (part.location.z,)
	part.keyframe_insert(data_path='rotation_euler', frame=120)
	part.keyframe_insert(data_path='location', frame=120)
	for fcurve in part.animation_data.action.fcurves:
		for kf in fcurve.keyframe_points:
			kf.interpolation = 'LINEAR'
	return part


def buildPiece(curve, pieceIdx, pieceType, layerIdx, pieceDepth):
	curve.location.z = layerIdx * pieceDepth
	bpy.context.scene.objects.active = curve
	bpy.context.object.data.dimensions = '2D'
	bpy.ops.object.convert(target='MESH')
	bpy.ops.object.editmode_toggle()
	#bpy.context.object.data.extrude = pieceDepth * 0.5
	bpy.ops.mesh.select_all(action='TOGGLE')
	bpy.ops.mesh.extrude_region_move(TRANSFORM_OT_translate={"value":(0, 0, -pieceDepth),})
	bpy.ops.object.editmode_toggle()
	return curve

"""
High level idea of how to join parts.
  (0) iterate over each part in order from outer-most piece to pivot cap.
  (1) move current part to sum of all previous offsets.
  (2) Compare current part to previous part:
  	{current - previous}: make 45 degree ramp from previous to current.
  	{current = previous}: vertical line.
  	{previous - current}: break previous face at current edge and go vertical.
"""


bpy.ops.import_curve.svg (filepath="/Users/mattstults/Downloads/aperture.svg");
doc = minidom.parse("/Users/mattstults/Downloads/aperture.svg")  # parseString also exists
total_rotation_degrees = float([element.getAttribute('data-paper-data') for element in doc.getElementsByTagName('path') if element.getAttribute('id') == 'scale_circle'][0])
doc.unlink()
circle = bpy.data.objects['scale_circle']
circle.select = True
circle_dimensions = circle.dimensions.copy()
bpy.ops.object.delete()
scaleAllCurves(circle_dimensions, deg2rad(total_rotation_degrees))
