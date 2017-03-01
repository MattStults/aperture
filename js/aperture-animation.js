var openingTime = 5;

var totalRotation;
var pieceCount;
var templatePieces;
var displayGroups = [[], []];
window.animate = function (pieces, nPieces) {
	pieceCount = nPieces;
	totalRotation = window.computeRotation(360.0 / nPieces);
	templatePieces = pieces;
	for (var i = 0; i < displayGroups.length; i++) {
		for (var j = 0; j < pieces.length; j++) {
			displayGroups[i].push(new Group());
		}
	}
	displayGroups[0].reverse();
}

function display(t) {
	for (var i = 0; i < displayGroups.length; i++) {
		for (var j = 0; j < displayGroups[i].length; j++) {
			displayGroups[i][j].removeChildren();
		}
	}
	var center = new Point();
	var radianWidth = 360.0 / pieceCount;
	for (var i = 0; i < pieceCount; i++) {
		for (var j = 0; j < templatePieces.length; j++) {
			var p = templatePieces[j].clone();
			p.parent = displayGroups[i%2][j];
			if (i%2 == 0) {
				p.fillColor = j%2 == 0 ? 'red' : 'pink';
				p.strokeColor = j%2 == 0 ? 'black' : 'gray';
			} else {
				p.fillColor = j%2 == 0 ? 'blue' : 'lightblue';
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