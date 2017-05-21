window.viewing_scale = 50.0;
window.nParts = 18;
var piece = window.buildPiece(nParts);
window.animate(piece, nParts);
window.scratchPad.remove();
// {strokeColor: 'black', strokeWidth: 1/viewing_scale}
view.scale(viewing_scale,new Point());
view.translate(view.getCenter());