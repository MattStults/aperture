import bpy;

def scaleAllCurves(dimensions):
	scene = bpy.context.scene
	for ob in scene.objects:
		if ob.type == 'CURVE':
			ob.select = True
			name_parts = ob.name.split("-")
			buildPiece(ob, int(name_parts[1]), name_parts[3], int(name_parts[5]), 0.025)
		else: 
			ob.select = False
	bpy.ops.transform.resize(\
		value=(1/dimensions[0], 1/dimensions[1], 1),\
		constraint_axis=(False, False, False),\
		constraint_orientation='GLOBAL',\
		mirror=False,\
		proportional='DISABLED',\
		proportional_edit_falloff='SMOOTH',\
		proportional_size=1)

def buildPiece(curve, pieceIdx, pieceType, layerIdx, pieceDepth):
	curve.location.z = layerIdx * pieceDepth
	bpy.context.scene.objects.active = curve
	#bpy.context.object.data.extrude = pieceDepth * 0.5


bpy.ops.import_curve.svg (filepath="/Users/mattstults/Downloads/aperture.svg");
circle = bpy.data.objects['scale_circle']
circle.select = True
circle_dimensions = circle.dimensions.copy()
bpy.ops.object.delete()
scaleAllCurves(circle_dimensions)
