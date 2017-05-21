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

function pathFromPointFunction(fn, granularity) {
	if (!granularity) {
		granularity = 10;
	}
	var segments = [];
	for (i = 0; i < (granularity + 1); i++) {
		segments.push(fn(i/10.0))
	}
	var path = new Path({ segments: segments });
	path.parent = scratchPad;
	path.smooth();
	return path;
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
				sweepfn(localPart.getPointAt(0)))));
	for (var i = 0; i < locations.length; i++) {
		var chunk = buildTranslationBox(localPart, locations[i], locations[(i+2)%locations.length], sweepfn);
		sweep = (!sweep) ? chunk : sweep.unite(chunk);
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
	return buildLayers(piece, totalRotation, radianWidth);
}

window.buildAnularLayers = function(nPieces) {
	var radianWidth = 360.0 / nPieces;
	var totalRotation = computeRotation(radianWidth);
	var piece = buildPieceShape(nPieces, radianWidth, totalRotation);
	piece.parent = scratchPad;
	var templatePieces = buildLayers(piece, totalRotation, radianWidth);
	return annularDisplay(0, templatePieces, nPieces, totalRotation);
}

window.buildLaserLayers = function(nPieces) {
	var radianWidth = 360.0 / nPieces;
	var totalRotation = computeRotation(radianWidth);
	var piece = buildPieceShape(nPieces, radianWidth, totalRotation);
	piece.parent = scratchPad;
	var templatePieces = buildLayers(piece, totalRotation, radianWidth);
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

window.buildLayers = function(part, totalRotation, radianWidth, pivotRadius, capRadius, minWidth, minClearance) {
	if(!pivotRadius) {
		pivotRadius = 0.04;
	}
	if(!capRadius) {
		capRadius = 0.06;
	}
	if(!minWidth) {
		minWidth = 0.02;
	}
	if(!minClearance) {
		minClearance = 0.01;
	}
	var leftLocation = getExtremes(part)
		.reduce(function(a, b, i, arr) {
			return (a.point.x < b.point.x) ? a : b;
		});
	var pivotPoint = leftLocation.point + leftLocation.normal * (capRadius + minWidth + minClearance);
	var pivot = new Path.Circle({
		center: pivotPoint,
		radius: pivotRadius,
		parent: scratchPad,
		pivot: part.pivot,
		name: 'pivot'
	});
	var pivotCap = new Path.Circle({
		center: pivotPoint,
		radius: capRadius,
		parent: scratchPad,
		pivot: part.pivot,
		name: 'pivot_cap'
	});
	var l1Arm = sweptCircleFromPointFunction(function(t) {
		return leftLocation.point + (pivotPoint - leftLocation.point) * t;
	}, pivotRadius);
	part = part.clone()
		.unite(l1Arm)
		.unite(buildPieceCircleSweep(capRadius+minClearance+minWidth, pivotPoint, -1, totalRotation, radianWidth));
	var l4 = part.subtract(buildPieceSweep(part,2, totalRotation, radianWidth));
	var l3 = part.clone().subtract(buildPieceSweep(part,-2, totalRotation, radianWidth));
	var pivotGroove = buildPieceCircleSweep(pivotRadius+minClearance, pivotPoint, -1, totalRotation, radianWidth);
	l1 = l3.subtract(pivotGroove);
	l1.name = 'bottom_pivot_groove';
	var l2 = l1.subtract(buildPieceCircleSweep(capRadius+minClearance, pivotPoint, -1, totalRotation, radianWidth));
	l2.name = 'bottom_cap_groove';
	l3.name = 'bottom_cover'
	l4.name = 'top';
	return [[-2, pivotCap], [-1, pivot], [0, l1], [1, l2],[2, l3], [3, l4]];
}

window.annularDisplay = function(t, templatePieces, pieceCount, totalRotation) {
	var displayGroups = [];
	for (var i = 0; i < 2*(templatePieces.length); i++) {
		displayGroups[i] = new Group();
		displayGroups[i].name = 'depth_layer_' + i;
	}
	var center = new Point();
	var radianWidth = 360.0 / pieceCount;
	for (var i = 0; i < pieceCount; i++) {
		for (var j = 0; j < templatePieces.length; j++) {
			var groupId = templatePieces[j][0];
			var layerId = templatePieces.length + ((i%2) ? groupId + 1: -groupId);
			var p = templatePieces[j][1].clone();
			p.name = 'piece-' + i + '-part-' + templatePieces[j][1].name + '-layer-' + layerId;
			p.parent = displayGroups[layerId];
			if (i%2 == 0) {
				p.fillColor = j%2 == 0 ? 'rgba(255, 200, 200, 0.5)' : 'rgba(255, 236, 214, 0.5)';
				p.strokeColor = 'rgba(0, 0, 0, 0.5)';
			} else {
				p.fillColor = j%2 == 0 ? 'rgba(200, 200, 255, 0.5)' : 'rgba(214, 236, 255, 0.5)';
				p.strokeColor = 'rgba(0, 0, 0, 0.75)';
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