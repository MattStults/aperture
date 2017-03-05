var openingTime = 5;

var totalRotation;
var pieceCount;
var pieces;

window.animate = function (templatePieces, nPieces) {
	pieceCount = nPieces;
	totalRotation = window.computeRotation(360.0 / nPieces);
	pieces = templatePieces;
}

function onFrame(event) {
	var t = (event.time % openingTime) / openingTime;
	if (Math.floor(event.time / openingTime) % 2 == 1) {
		t = 1 - t;
	}
	project.activeLayer.removeChildren();
	window.annularDisplay(t, pieces, pieceCount, totalRotation);
}