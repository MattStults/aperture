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
	}).reduce(function(a, b, i, arr) { return (a[1] > b[1]) ? a : b;});
	// Split the overlap.
	overlap.splitAt(overlap.getLocationOf(intersectPoint));
	overlap.removeSegments(overlap.getLocationOf(intersectPoint).index);
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

window.buildLayers = function(part, totalRotation, radianWidth) {
	return [
		part.clone().subtract(buildPieceSweep(part,-2, totalRotation, radianWidth)),
		part.clone().subtract(buildPieceSweep(part,2, totalRotation, radianWidth))
	];
}

window.buildPieceSweep = function(part, idx, totalRotation, radianWidth) {
	var localPart = part.clone();
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
	nChunks = 100;
	var sweep = null;
	for (var i = 0; i < nChunks; i++) {
		var p1 = localPart.getPointAt((localPart.length * i)/nChunks);
		var p2 = localPart.getPointAt((localPart.length * (i+1))/nChunks);
		var s1 = Path.Line(p1, p2);
		s1.parent = scratchPad;
		var s2 = pathFromPointFunction(sweepfn(p1));
		var s3 = Path.Line(sweepfn(p2)(1), sweepfn(p1)(1));
		s3.parent = scratchPad;
		var s4 = pathFromPointFunction(sweepfn(p2));
		s4.reverse();
		var chunk = s1.join(s2).join(s3).join(s4);
		chunk.closed = true;
		sweep = (!sweep) ? chunk : sweep.unite(chunk);
	}
	localPart.remove();
	sweep.closed = true;
	sweep.reduce();
	sweep.parent = scratchPad;
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
	return buildLayers(piece, totalRotation, radianWidth);
}