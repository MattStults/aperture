var openingTime = 5;

var totalRotation;
var pieceCount;
var templatePieces;
var displayGroups = [];
window.animate = function (pieces, nPieces) {
	pieceCount = nPieces;
	totalRotation = window.computeRotation(360.0 / nPieces);
	templatePieces = pieces;
	console.log(pieces[0][1]);
	for (var i = 0; i < 2*(pieces.length); i++) {
		displayGroups[i - pieces.length] = new Group();
	}
}

function display(t) {
	for (var i = 0; i < 2*displayGroups.length; i++) {
		displayGroups[i-displayGroups.length].removeChildren();
	}
	var center = new Point();
	var radianWidth = 360.0 / pieceCount;
	for (var i = 0; i < pieceCount; i++) {
		for (var j = 0; j < templatePieces.length; j++) {
			var p = templatePieces[j][1].clone();
			var groupId = templatePieces[j][0];
			p.parent = displayGroups[(i%2) ? groupId : -groupId-1];
			if (i%2 == 0) {
				p.fillColor = j%2 == 0 ? 'rgba(255, 200, 200, 0.75)' : 'rgba(255, 236, 214, 0.75)';
				p.strokeColor = j%2 == 0 ? 'black' : 'gray';
			} else {
				p.fillColor = j%2 == 0 ? 'rgba(200, 200, 255, 0.75)' : 'rgba(214, 236, 255, 0.75)';
				p.strokeColor = j%2 == 0 ? 'black' : 'gray';
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
}

function onFrame(event) {
	var t = (event.time % openingTime) / openingTime;
	if (Math.floor(event.time / openingTime) % 2 == 1) {
		t = 1 - t;
	}
	display(t);
}