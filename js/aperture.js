window.viewing_scale = 50.0;
window.nParts = 16;
window.totalRotation = window.computeRotation(360.0 / nParts);
var piece = window.buildPiece(nParts);
window.frameGroup = window.buildAnnularFrame(piece, nParts, totalRotation);
window.animate(piece, frameGroup, nParts, totalRotation);
window.scratchPad.remove();
// {strokeColor: 'black', strokeWidth: 1/viewing_scale}
view.scale(viewing_scale,new Point());
view.translate(view.getCenter());