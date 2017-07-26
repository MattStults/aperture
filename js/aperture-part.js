window.scratchPad = new Group();

function unitRing(radianWidth, idx, dilation, scratchGroup) {
	if (!scratchGroup) {
		scratchGroup = scratchPad;
	}
	if (!dilation) {
		dilation = 0;
	}
	return new Path.Circle({
		center: new Point({
			angle: radianWidth * idx,
			length: (1-dilation)
		}),
		radius: 1,
		parent: scratchGroup
	});
}

window.computeRotation = function (radianWidth) {
	// Relies on the fact that rotation is constant.
	// However, this is not meaningful to compute at 0 or 1,
	// so we need to compute anywhere else and then scale
	// to the whole period.
	ringA = unitRing(radianWidth, 0, 0.5);
	ringB = unitRing(radianWidth, -1, 0.5);
	intersections = ringA.getCrossings(ringB).filter(
		function(i) { return i.point.length <= 1;});
	if (intersections.length != 1) {
		throw 'unexpected intersections';
	}
	offset = -(intersections[0].point - ringA.position);
	return offset.angle * 2;
}

function parthFromPointFunctionGranularityList(list) {
	var segments = [];
	var listLength = list.length;
	for (var i = 0; i < listLength; i++) {
		var partial = list[i];
		var fn, granularity;
		if (!'fn' in partial) {
			throw {
				message: 'partial missing function',
				index: i,
				partialList: list
			};
		}
		fn = partial.fn;
		if ('granularity' in partial) {
			granularity = partial.granularity;
		} else {
			granularity = 10.0;
		}
		for (var j = 0; j < (granularity + 1); j++) {
			segments.push(fn(j/granularity))
		}
	}
	var path = new Path({ segments: segments });
	path.parent = scratchPad;
	path.smooth();
	return path;
}

function pathFromPointFunction(pointFunction, granularity) {
	var partial = {
		fn: pointFunction
	};
	if (granularity) {
		partial.granularity = granularity;
	}
	return parthFromPointFunctionGranularityList([partial]);
}

function sweptCircleFromPath(path, radius, scratchGroup) {
	if (!scratchGroup) {
		scratchGroup = scratchPad;
	}
	var result = null;
	for (var i = 0; i < path.curves.length; i++) {
		var curve = path.curves[i];
		function curveFunction(t) {
			return curve.getLocationAtTime(t);
		}
		var part = sweptCircleFromPointFunction(curveFunction, radius, scratchGroup);
		result = (result == null) ? part : result.unite(part);
	}
	return result;
}

function sweptCircleFromPointFunction(fn, radius, scratchGroup) {
	if (!radius) {
		radius = 1;
	}
	if (!scratchGroup) {
		scratchGroup = scratchPad;
	}
	var center = pathFromPointFunction(fn);
	var activeRadius = radius;
	function edgeAtDilation(dilation) {
		var offset = dilation * center.length;
		return center.getPointAt(offset) + center.getNormalAt(offset) * activeRadius;
	}
	var edge1 = pathFromPointFunction(edgeAtDilation);
	activeRadius = -radius;
	var edge2 = pathFromPointFunction(edgeAtDilation);
	edge2.reverse();
	// Build the caps
	var cap12 = Path.Arc({
		from: edge1.getPointAt(edge1.length),
		through: center.getPointAt(center.length) + center.getTangentAt(center.length) * radius,
		to: edge2.getPointAt(0),
		parent: scratchGroup
	});
	var cap21 = Path.Arc({
		from: edge2.getPointAt(edge2.length),
		through: center.getPointAt(0) - center.getTangentAt(0) * radius,
		to: edge1.getPointAt(0),
		parent: scratchGroup
	});
	var sweptCircle = edge1.join(cap12).join(edge2).join(cap21);
	sweptCircle.closed = true;
	return sweptCircle;
}

function offsetPointAroundIdx0(point, totalRotation, dilation) {
	return (point + new Point(dilation, 0))
			.rotate(totalRotation * dilation, new Point({angle: 0, length: 1}));
}

function offsetPartPointAroundIdx0(point, totalRotation, radianWidth, dilation, idx) {
	var innerEdgeStart = new Point({
		angle: radianWidth * idx,
		length: 1
	});
	var worldPoint = (point + (innerEdgeStart * -dilation))
		.rotate(-totalRotation * dilation, innerEdgeStart * (1-dilation));
	return offsetPointAroundIdx0(worldPoint, totalRotation, dilation);
}

function openingCenterMovementFunction(totalRotation) {
	origin = new Point();
	return function centerAtDilation(dilation) {
		return offsetPointAroundIdx0(origin, totalRotation, dilation);
	};
}

function partOuterEdgeMovementFunction(totalRotation, radianWidth, idx) {
	return function coveringCenterAtDilation(dilation) {
		var outerEdgeStart = new Point({
			angle: radianWidth * (idx + 1),
			length: 1
		});
		return offsetPartPointAroundIdx0(
			outerEdgeStart,
			totalRotation,
			radianWidth,
			dilation,
			idx);
	};
}

function partOuterEdgeOverlapFunction(totalRotation, radianWidth, idx, scratchGroup) {
	if (!scratchGroup) {
		scratchGroup = scratchPad;
	}
	var openingCenterMovement = openingCenterMovementFunction(totalRotation);
	var partOuterEdgeMovement =
		partOuterEdgeMovementFunction(totalRotation, radianWidth, idx);
	return function (dilation) {
		var centerCircle = new Path.Circle({
			center: openingCenterMovement(dilation),
			radius: 1,
			parent: scratchGroup
		});
		var coveringCircle = new Path.Circle({
			center: partOuterEdgeMovement(dilation),
			radius: 1,
			parent: scratchGroup
		});
		return centerCircle.getCrossings(coveringCircle)[1].point;
	}
}

function getExtremes(path) {
	var bounds = new Path.Rectangle(path.bounds);
	bounds.scale(0.99);
	bounds.parent = scratchPad;
	return bounds.getIntersections(path);
}

function partOuterEdgeOverlap(part, totalRotation, radianWidth, idx, scratchGroup) {
	if (!scratchGroup) {
		scratchGroup = scratchPad;
	}
	var overlap = pathFromPointFunction(partOuterEdgeOverlapFunction(totalRotation, radianWidth, idx -1));
	// We want the earliest intersection with the piece.
	var intersectPoint = getExtremes(overlap).map(function(i) {
		return i.point;
	}).reduce(function(a, b, i, arr) { return (a.y > b.y) ? a : b;});
	// Split the overlap.
	overlap.splitAt(overlap.getLocationOf(intersectPoint));
	// Extend it.
	overlap = overlap.join(new Path([
		intersectPoint,
		new Point(0,1) + intersectPoint,
		new Point(-1,-2) + overlap.getPointAt(0),
		overlap.getPointAt(0)
	]));
	overlap.parent = scratchGroup;
	overlap.closed = true;
	return sweptCircleFromPointFunction(partOuterEdgeMovementFunction(totalRotation, radianWidth, idx -1))
		.subtract(overlap);
}

function translatePath(path, movementFnFn, scratchGroup) {
	if (!scratchGroup) {
		scratchGroup = scratchPad;
	}
	var retPath = new Path(path.segments.map(function(seg) {
		return new Segment(movementFnFn(seg.point)(1), path.handleIn, path.handleOut);
	}));
	retPath.closed = path.closed;
	retPath.parent = scratchGroup;
	return retPath;
}

function buildTranslationBox(path, start, stop, movementFnFn, scratchGroup) {
	if (!scratchGroup) {
		scratchGroup = scratchPad;
	}
	path = path.clone();
	path.splitAt(stop.offset);
	path.parent = scratchGroup;
	boxTop = path.splitAt(start.offset);
	boxBot = translatePath(boxTop, movementFnFn);
	boxBot.reverse();
	boxTtoB = pathFromPointFunction(movementFnFn(boxTop.getPointAt(boxTop.length)));
	boxBtoT = pathFromPointFunction(movementFnFn(boxTop.getPointAt(0)));
	boxBtoT.reverse();
	
	boxTop.join(boxTtoB).join(boxBot).join(boxBtoT);
	boxTop.closed = true;
	boxTop.parent = scratchGroup;

	return boxTop;
}

function getTangents(path, granularity) {
	if (!granularity) {
		granularity = 101;
	}
	return Array.apply(null, Array(granularity))
		.map(function (_, i) {return path.getTangentAt(i * path.length / (granularity-1));});
}

function getNormalsPerpendicularToTangentSpread(path, tangents, epsilon, granularity) {
	if (!epsilon) {
		epsilon = 0.01;
	}
	if (!granularity) {
		granularity = 200;
	}
	return Array.apply(null, Array(granularity))
		.map(function (_, i) {
			return path.getLocationAt(Math.min(path.length, i * path.length / (granularity-1)));
		})
		.filter(function (location) {
			for (var i = 0; i < tangents.length; i++) {
				if (Math.abs(location.normal.dot(tangents[i])) < epsilon) {
					return true;
				}
			}
			return false;
		});
}

function buildPieceCircleSweep(radius, startPoint, idx, totalRotation, radianWidth) {
	function movefn(dilation) {
		return offsetPartPointAroundIdx0(
			startPoint.rotate(radianWidth * idx, new Point()),
			totalRotation,
			radianWidth,
			dilation,
			idx);
	};
	return sweptCircleFromPointFunction(movefn, radius);
}

window.buildPieceSweep = function(part, idx, totalRotation, radianWidth) {
	var localPart = part.clone();
	localPart.parent = scratchPad;
	localPart.rotate(radianWidth * idx, new Point());
	var sweepfn = function (point) {
		return function (dilation) {
			return offsetPartPointAroundIdx0(
				point,
				totalRotation,
				radianWidth,
				dilation,
				idx);
		};
	};
	var sweep = null;
	var locations = getNormalsPerpendicularToTangentSpread(
		localPart,
		getTangents(
			pathFromPointFunction(
				sweepfn(localPart.getPointAt(0)))),
		0,
		100);
	for (var i = 0; i < locations.length; i++) {
		var chunk = buildTranslationBox(localPart, locations[i], locations[(i+2)%locations.length], sweepfn);
		sweep = (!sweep) ? chunk : chunk.unite(sweep);
		if (sweep == null) {
			throw "Bad chunk united to null: " + chunk;
		}
	}
	sweep = sweep.unite(translatePath(localPart, sweepfn)).unite(localPart);
	localPart.remove();
	sweep.closed = true;
	sweep.reduce();
	return sweep;
}

window.buildPieceShape = function (nPieces, radianWidth, totalRotation) {
	var crescent = unitRing(radianWidth, 1).subtract(unitRing(radianWidth, 0));
	var extendedPart = crescent.intersect(
		sweptCircleFromPointFunction(
			openingCenterMovementFunction(totalRotation)));
	var part = extendedPart.subtract(partOuterEdgeOverlap(extendedPart, totalRotation, radianWidth, 0));
	part.pivot = new Point({
		angle: 0,
		length: 1
	});
	part.parent = scratchPad.parent;
	return part;
}

window.buildPiece = function (nPieces) {
	var radianWidth = 360.0 / nPieces;
	var totalRotation = computeRotation(radianWidth);
	var piece = buildPieceShape(nPieces, radianWidth, totalRotation);
	piece.parent = scratchPad;
	return buildBlenderPieceLayers(piece, totalRotation, radianWidth);
}

window.buildBlenderLayers = function(nPieces) {
	var radianWidth = 360.0 / nPieces;
	var totalRotation = computeRotation(radianWidth);
	var piece = buildPieceShape(nPieces, radianWidth, totalRotation);
	piece.parent = scratchPad;
	var templatePieces = buildBlenderPieceLayers(piece, totalRotation, radianWidth);
	return annularDisplay(0, templatePieces, 1, totalRotation);
}

window.buildLaserLayers = function(nPieces) {
	var radianWidth = 360.0 / nPieces;
	var totalRotation = computeRotation(radianWidth);
	var piece = buildPieceShape(nPieces, radianWidth, totalRotation);
	piece.parent = scratchPad;
	var templatePieces = buildBlenderPieceLayers(piece, totalRotation, radianWidth);
	var layers = annularDisplay(0, templatePieces, nPieces, totalRotation);
	return layers;
}

function getPiecePartDepths(minWidth, minClearance) {
	return {
		pivot_cap: minWidth, // Taper to pivot.
		pivot: minWidth + Math.max(minClearance, distanceToCap), // straight to pivot_groove
		bottom_pivot_groove: minWidth, // Taper to cap_groove
		bottom_cap_groove: minWidth + minClearance + Math.max([minClearance, distanceToGroove, distanceToCap]),
		bottom_cover: minWidth,
		top: minWidth
	};
}

// The pivot points needs to be far enough from the center that the entire enclosure can fit on one piece.
// If it's not big enough we run into an impossible overlap situation.  In order to do this, we create an
// nGon with side width = the total diameter we need.  Then we get the radius of the circle that encloses
// that nGon.
function buildInternalArmLocations(part, pivotArmLength, radianWidth) {
	var nGonRadius = pivotArmLength / Math.sin(Math.PI * radianWidth / 360.0);
	var pivotArmCircle = new Path.Circle({
		center: new Point(),
		radius: nGonRadius,
		parent: scratchPad
	});

	var leftLocation = pivotArmCircle.getCrossings(part)
		.reduce(function(a, b, i, arr) {
			return (a.point.x < b.point.x) ? a : b;
		}).point;
	var farLeftLocation = leftLocation.clone();
	farLeftLocation.angle += radianWidth;
	var armDirection = (farLeftLocation - leftLocation).normalize();
	var pivotPoint = leftLocation + armDirection * pivotArmLength;
	return {
		leftLocation: leftLocation,
		pivotPoint: pivotPoint
	};
}

// Provides a shape representing all possible points that the external
// pivot arm can by located on and still connect to an external point
// r distance from the center.
function buildExternalPivotArmPossibleLocationsShape(radius, totalRotation) {
	var scale = (radius - 1) / radius;
	var startingTheta = 0;
	var endingTheta = Math.PI / 2.0;
	var part1 = function(t) {
		var theta = (endingTheta - startingTheta) * t + startingTheta;
		return new Point(
			Math.sin(theta) - Math.cos(theta) + scale,
			Math.cos(theta));
	};
	var part3 = function(t) {
		var theta = endingTheta - (endingTheta - startingTheta) * t;
		return new Point(
			-radius,
			part1(1-t).y);
	};
	var part2 = function(t) {
		return (part3(0) - part1(1)) * t + part1(1);
	};
	var part4 = function(t) {
		return (part1(0) - part3(1)) * t + part3(1);
	};
	var halfA = parthFromPointFunctionGranularityList([
		  {fn: part1, granularity: 30},
		  {fn: part2, granularity: 100},
		  {fn: part3, granularity: 30},
		  {fn: part4, granularity: 10},
		]);
	halfA.closed = true;
	var sweepFunction = buildPiece0GlideFunction(new Point(), totalRotation);
	var shape = halfA.intersect(halfA.clone().scale(-1,1));
	var glidePath = pathFromPointFunction(sweepFunction);
	var glidePathNormal = glidePath.getNormalAt(glidePath.length / 2.0);
	shape.rotate(glidePathNormal.angle + new Point(0,-1).angle, new Point());
	shape.simplify(0.001);
	return {
		shape: shape,
		glidePath: glidePath
	};
};

function computeExternalArmPivotPoint(pivotRadius, attachmentSurface, externalRadius, totalRotation) {
	var computedPossibilities =
	    buildExternalPivotArmPossibleLocationsShape(externalRadius, totalRotation);
	var possiblePivotsShape = computedPossibilities.shape;
	var selectableSurface = attachmentSurface.subtract(sweptCircleFromPath(attachmentSurface, pivotRadius));
	var selectableCenters = possiblePivotsShape.intersect(selectableSurface);
	var extremes = getExtremes(selectableCenters);
	return extremes
		.reduce(function(a, b, i, arr) {
			return (a.point.y > b.point.y) ? a : b;
		}).point;
};

window.buildBlenderPieceLayers = function(part, totalRotation, radianWidth, shrinkage, pivotRadius, capRadius, minFlatWidth, minVerticalWidth, minClearance) {
	if(!pivotRadius) {
		pivotRadius = 0.04;
	}
	if(!capRadius) {
		capRadius = 0.06;
	}
	if(!minFlatWidth) {
		minFlatWidth = 0.02;
	}
	if(!minVerticalWidth) {
		minVerticalWidth = 0.02;
	}
	if(!minClearance) {
		minClearance = 0.02;
	}
	if(!shrinkage) {
		shrinkage = 0.04
	}
	var pivotArmLength = capRadius + minFlatWidth + 2 * minClearance;
	var armLocations = buildInternalArmLocations(part, pivotArmLength, radianWidth);

	var leftLocation = armLocations.leftLocation;
	var pivotPoint = armLocations.pivotPoint;

	var pivotFloor = new Path.Circle({
		center: pivotPoint,
		radius: pivotRadius * (1.0 - shrinkage),
		parent: scratchPad,
		pivot: part.pivot,
		name: 'pivot.00'
	});
	var pivotCeil = pivotFloor.clone();
	pivotCeil.bame = 'pivot.01';
	var pivotCapFloor = new Path.Circle({
		center: pivotPoint,
		radius: capRadius * (1.0 - shrinkage),
		parent: scratchPad,
		pivot: part.pivot,
		name: 'pivot.02'
	});
	var pivotCapCeil = pivotCapFloor.clone();
	pivotCapCeil.name = 'pivot.03';
	var l1Arm = sweptCircleFromPointFunction(function(t) {
		return leftLocation + (pivotPoint - leftLocation) * t;
	}, pivotRadius);
	var partWithArm = part.clone()
		.unite(l1Arm)
		.unite(buildPieceCircleSweep(capRadius+minClearance+minFlatWidth, pivotPoint, -1, totalRotation, radianWidth));
	var innerSweep = buildPieceSweep(partWithArm,2, totalRotation, radianWidth);
	var topFloor = part.subtract(innerSweep);
	topFloor.name = 'bottom.00';
	var topCeil = topFloor.clone();
	topCeil.name = 'bottom.01';
	var outerSweep = buildPieceSweep(partWithArm,-2, totalRotation, radianWidth);
	var bottom = partWithArm.clone().subtract(outerSweep);
	var topBottomJoinerFloor = topFloor.clone().intersect(bottom);
	topBottomJoinerFloor.name = 'bottom.02';
	var topBottomJoinerCeil = topBottomJoinerFloor.clone();
	topBottomJoinerCeil.name = 'bottom.03';
	var bottomFloor = bottom.clone();
	bottomFloor.name = 'bottom.04';
	var bottomCeil = bottomFloor.clone();
	bottomCeil.name = 'bottom.05';
	var pivotGrooveCeil = buildPieceCircleSweep((pivotRadius+minClearance) * (1.0 + shrinkage), pivotPoint, -1, totalRotation, radianWidth);
	pivotGrooveCeil.center = pivotPoint;
	pivotGrooveCeil.pivot = part.pivot;
	pivotGrooveCeil.name = 'bottom.06';
	var pivotGrooveFloor = pivotGrooveCeil.clone();
	pivotGrooveFloor.name = 'bottom.07';
	var capGrooveCeil = buildPieceCircleSweep((capRadius+minClearance)  * (1.0 + shrinkage), pivotPoint, -1, totalRotation, radianWidth);
	capGrooveCeil.center = pivotPoint;
	capGrooveCeil.pivot = part.pivot;
	capGrooveCeil.name = 'bottom.08';
	var capGrooveFloor =capGrooveCeil.clone();
	capGrooveFloor.name = 'bottom.09';

	var outerSize = 1.1;
	var externalArmPivotPoint =
	    computeExternalArmPivotPoint(capRadius, topFloor, outerSize, totalRotation);
	var externalCapCeil = new Path.Circle({
		center: externalArmPivotPoint,
		radius: capRadius * (1.0 - shrinkage),
		parent: scratchPad,
		pivot: part.pivot,
		name: 'external.00'
	});
	var externalCapFloor = externalCapCeil.clone();
	externalCapFloor.name = 'external.01';
	externalCapFloor.position = externalArmPivotPoint;
	var externalPivotCeil = new Path.Circle({
		center: externalArmPivotPoint,
		radius: pivotRadius * (1.0 - shrinkage),
		parent: scratchPad,
		pivot: part.pivot,
		name: 'external.02'
	});
	var externalPivotFloor = externalPivotCeil.clone();
	externalPivotFloor.name = 'external.03';

	return [
	    [-(3 + 3 * minClearance) * minVerticalWidth, topFloor],
	    [-(2 + 3 * minClearance) * minVerticalWidth, topCeil],
	    [-(2 + 3 * minClearance) * minVerticalWidth, topBottomJoinerFloor],
	    [-(2 + 2 * minClearance) * minVerticalWidth, topBottomJoinerCeil],
		[-(2 + 2 * minClearance) * minVerticalWidth, bottomFloor],
		[0 * minVerticalWidth, bottomCeil],
		[0 * minVerticalWidth, pivotGrooveCeil],
		[-1 * minVerticalWidth, pivotGrooveFloor],
		[-1 * minVerticalWidth, capGrooveCeil],
		[-(2 + 2 * minClearance) * minVerticalWidth, capGrooveFloor],
		[(-2 * minClearance) * minVerticalWidth, pivotFloor],
		[(1 + 1 * minClearance) * minVerticalWidth, pivotCeil],
		[(1 + 1 * minClearance) * minVerticalWidth, pivotCapFloor],
		[(2 + 1 * minClearance) * minVerticalWidth, pivotCapCeil],
		[-(6 + 3 * minClearance) * minVerticalWidth, externalCapCeil],
	    [-(5 + 3 * minClearance) * minVerticalWidth, externalCapFloor],
	    [-(4 + 3 * minClearance) * minVerticalWidth, externalPivotCeil],
	    [-(3 + 2 * minClearance) * minVerticalWidth, externalPivotFloor]];
}

function getFrameAttachmentPoint(radianWidth, pivotArmLength, acceptablePivotArmOverlap) {
	var backupRoom = /*(1 - 2 * pivotArmLength) * Math.tan(Math.PI * radianWidth / 360.0)*/ + 3 * (pivotArmLength - acceptablePivotArmOverlap);
	return new Point(backupRoom, 1 + pivotArmLength);
}

function buildPiece0GlideFunction(offsetPoint, totalRotation) {
	return function pieceGlideFunction(t) {
		return offsetPoint.rotate(
			-totalRotation * t,
			new Point(1, 0)) - new Point(t, 0);
	};
}

function getExternalPivotFromTemplate(templatePieces) {
	for (var i = 0; i < templatePieces.length; i++) {
		if (templatePieces[i][1].name === "external.00") {
			return templatePieces[i][1];
		}
	}
	throw 'no external pieces found';
}

window.buildAnnularFrame = function(templatePieces, pieceCount, totalRotation) {
	var frameGroup = new Group();
	var edge = new Path.Circle({
		center: new Point(),
		radius: 1.4,
		fillColor: 'rgba(0, 255, 0, 0.1)',
		strokeColor: 'black',
		strokeWidth: 1/(viewing_scale * 2),
	}).subtract(new Path.Circle({
		center: new Point(),
		radius: 1
	}));
	edge = edge.unite(getExternalPivotFromTemplate(templatePieces));
	var center = new Point();
	var radianWidth = 360.0 / pieceCount;
	var attachPointTemplate = getFrameAttachmentPoint(radianWidth, 0.1, 0.01);
	var sweepFunction = buildPiece0GlideFunction(attachPointTemplate, totalRotation);
	var sweep = sweptCircleFromPointFunction(sweepFunction, 0.03);
	for (var i = 0; i < pieceCount; i++) {
		var sweepInstance = sweep.rotate(-i * radianWidth, center);
		edge = edge.subtract(sweepInstance);
	}
	edge.parent = frameGroup;
	return frameGroup;
}

window.annularDisplay = function(t, templatePieces, pieceCount, totalRotation) {
	var displayGroups = [];
	for (var i = 0; i < 2*(templatePieces.length); i++) {
		var idx = (2*(templatePieces.length) - i - 1);
		displayGroups[idx] = new Group();
		displayGroups[idx].name = 'depth_layer_' + idx;
	}
	var center = new Point();
	var radianWidth = 360.0 / pieceCount;
	for (var i = 0; i < pieceCount; i++) {
		for (var j = 0; j < templatePieces.length; j++) {
			var groupId = templatePieces[j][0];
			var zPosition = ((i%2) ? groupId + 1: -groupId);
			var layerId = templatePieces.length + zPosition;
			var p = templatePieces[j][1].clone();
			p.name = 'piece;' + i + ';part;' + templatePieces[j][1].name + ';layer;' + zPosition;
			p.parent = displayGroups[layerId.toFixed(0)];
			if (i%2 == 0) {
				p.fillColor = j%2 == 0 ? 'rgba(255, 200, 200, 0.25)' : 'rgba(255, 236, 214, 0.25)';
				p.strokeColor = 'rgba(0, 0, 0, 0.2)';
			} else {
				p.fillColor = j%2 == 0 ? 'rgba(200, 200, 255, 0.25)' : 'rgba(214, 236, 255, 0.25)';
				p.strokeColor = 'rgba(0, 0, 0, 0.25)';
			}
			p.strokeWidth = 1/(viewing_scale * 2);
			p.rotate(-i * radianWidth, center);
			p.position = new Point({
				angle: -radianWidth * i,
				length: 1-t
			});
			p.rotate(-totalRotation * t);
		}
	}
	return displayGroups;
}