var openingTime = 5;

var totalRotation;
var pieceCount;
var templatePiece;
var displayGroups = [new Group(), new Group()];
window.animate = function (piece, nPieces) {
	pieceCount = nPieces;
	totalRotation = window.computeRotation(360.0 / nPieces);
	templatePiece = piece;
}

function display(t) {
	for (i = 0; i < displayGroups.length; i++) {
		displayGroups[i].removeChildren();
	}
	var center = new Point();
	var radianWidth = 360.0 / pieceCount;
	for (i = 0; i < pieceCount; i++) {
		var p = templatePiece.clone();
		p.parent = displayGroups[i%2];
		p.fillColor = i%2 == 0 ? 'red' : 'pink';
		p.strokeColor = i%2 == 0 ? 'black' : 'gray';
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