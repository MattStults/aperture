var openingTime = 5;

var totalRotation;
var pieceCount;
var templatePiece;
var scratch = new Group();
window.animate = function (piece, nPieces) {
	pieceCount = nPieces;
	totalRotation = window.computeRotation(360.0 / nPieces);
	templatePiece = piece;
}

function display(t) {
	scratch.removeChildren();
	var center = new Point();
	var radianWidth = 360.0 / pieceCount;
	for (i = 0; i < pieceCount; i++) {
		var p = templatePiece.clone();
		p.parent = scratch;
		p.strokeColor = 'black';
		p.strokeWidth = 1/(viewing_scale * 2);
		p.rotate(-i * radianWidth, center);
		p.position = new Point({
			angle: -radianWidth * i,
			length: 1-t
		});
		p.rotate(-totalRotation * t);
	}
}

function onFrame(event) {
	var t = (event.time % openingTime) / openingTime;
	if (Math.floor(event.time / openingTime) % 2 == 1) {
		t = 1 - t;
	}
	display(t);
}