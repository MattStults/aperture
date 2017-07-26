var openingTime = 5;

var totalRotation;
var pieceCount;
var pieces;
var frame;

window.animate = function (templatePieces, annularFrame, nPieces, rotation) {
	frame = annularFrame;
	pieceCount = nPieces;
	totalRotation = rotation;
	pieces = templatePieces;
}

function onFrame(event) {
	var t = (event.time % openingTime) / openingTime;
	if (Math.floor(event.time / openingTime) % 2 == 1) {
		t = 1 - t;
	}
	project.activeLayer.removeChildren();
	frame.clone();
	frame.parent = project.activeLayer;
	window.annularDisplay(t, pieces, pieceCount, totalRotation);
}