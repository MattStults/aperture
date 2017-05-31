import bpy;
from math import pi
from numpy import array, cos, deg2rad, linalg, linspace, matrix, sin
from xml.dom import minidom

def isclose(a, b, rel_tol=1e-09, abs_tol=0.0):
    return abs(a-b) <= max(rel_tol * max(abs(a), abs(b)), abs_tol)

def polarCoordinates(rho, phi):
    x = rho * cos(phi)
    y = rho * sin(phi)
    return(x, y)

#https://blender.stackexchange.com/questions/1412/efficient-way-to-get-selected-vertices-via-python-without-iterating-over-the-en
def getSelectedVerts():
	mode = bpy.context.active_object.mode
	# we need to switch from Edit mode to Object mode so the selection gets updated
	bpy.ops.object.mode_set(mode='OBJECT')
	selectedVerts = [v for v in bpy.context.active_object.data.vertices if v.select]
	# back to whatever mode we were in
	bpy.ops.object.mode_set(mode=mode)
	return selectedVerts

def bool_operation(left, right, op='UNION', delete=True):
	bpy.context.scene.objects.active = left
	diff = left.modifiers.new(\
		type="BOOLEAN",\
		name="op")
	diff.object = right
	diff.operation = op
	bpy.ops.object.modifier_apply(apply_as='DATA', modifier="op")
	if delete:
		left.select = False
		right.select = True
		bpy.ops.object.delete()

def scaleAllCurves(dimensions, totalRotation):
	scene = bpy.context.scene
	pieces = {}
	for ob in scene.objects:
		if ob.type == 'CURVE':
			ob.select = True
			name_parts = ob.name.split("-")
			pieceIdx = name_parts[1]
			partIdx = name_parts[5]
			pieceType = name_parts[3]
			if pieceIdx not in pieces:
				pieces[pieceIdx] = {}
			pieces[pieceIdx][pieceType] = buildPiece(ob, int(pieceIdx), pieceType, int(partIdx), 0.005)
		else: 
			ob.select = False
	bpy.ops.transform.resize(value=(1/dimensions[0], 1/dimensions[1], 1))
	for pieceIdx, layers in pieces.items():
		categories = set([layer.split('.')[0] for layer in layers])
		for category in categories:
			bpy.ops.object.select_all(action='DESELECT')
			bpy.context.scene.objects.active = None
			for layer in [layer for layer in layers if layer.startswith(category + '.')]:
				bpy.context.scene.objects.active = layers[layer]
				layers[layer].select = True
				bpy.context.scene.cursor_location = polarCoordinates(0.5, (2 * pi * float(pieceIdx)) / len(pieces)) + (layers[layer].location.z,)
				bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
			bpy.ops.object.join()
			connectVertexGroupsEdgeLoops([group for group in bpy.context.scene.objects.active.vertex_groups if group.name.startswith(category + '.')])
			bpy.context.scene.objects.active.name = category
		rootObject = None
		for category in categories:
			if rootObject == None:
				rootObject = bpy.context.scene.objects[category]
			else:
				bool_operation(rootObject, bpy.context.scene.objects[category])
		animate_part(bpy.context.scene.objects.active, (0,0), totalRotation)
	bpy.ops.object.editmode_toggle()
	bpy.ops.mesh.select_all(action='DESELECT')
	bpy.ops.mesh.select_all(action='TOGGLE')
	bpy.ops.mesh.remove_doubles()
	bpy.ops.mesh.dissolve_limited(angle_limit=0.0)
	bpy.ops.mesh.select_all(action='DESELECT')
	bpy.ops.mesh.select_interior_faces()
	bpy.ops.mesh.delete(type='ONLY_FACE')
	bpy.ops.object.editmode_toggle()

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
	bpy.context.object.data.dimensions = '3D'
	bpy.ops.object.convert(target='MESH')
	bpy.ops.object.editmode_toggle()
	#bpy.context.object.data.extrude = pieceDepth * 0.5
	bpy.ops.mesh.select_all(action='TOGGLE')
	#bpy.ops.mesh.extrude_region_move(TRANSFORM_OT_translate={"value":(0, 0, -pieceDepth),})
	curve.vertex_groups.new(name=pieceType)
	curve.name = pieceType;
	bpy.ops.object.vertex_group_assign(True)
	bpy.ops.object.editmode_toggle()
	return curve

def connectVertexGroupsEdgeLoops(vertexGroups):
	previousGroup = None
	sortedGroups = sorted(vertexGroups, key=lambda g: g.name)
	facesToMake = [[sortedGroups[0]], [sortedGroups[-1]]]
	bpy.ops.object.editmode_toggle()
	for group in sortedGroups:
		bpy.ops.mesh.select_all(action='DESELECT')
		bpy.context.object.vertex_groups.active_index = group.index
		bpy.ops.object.vertex_group_select()
		if previousGroup is not None:
			bpy.context.object.vertex_groups.active_index = previousGroup.index
			bpy.ops.object.vertex_group_select()
			selected_verts = getSelectedVerts()
			if all(isclose(x.co[2], selected_verts[0].co[2]) for x in selected_verts):
				facesToMake.append([previousGroup, group])
			else:
				bpy.ops.mesh.bridge_edge_loops(type='PAIRS')
		previousGroup = group
	for groups in facesToMake:
		bpy.ops.mesh.select_all(action='DESELECT')
		for group in groups:
			bpy.context.object.vertex_groups.active_index = group.index
			bpy.ops.object.vertex_group_select()
		bpy.ops.mesh.fill()
	bpy.ops.object.editmode_toggle()

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
