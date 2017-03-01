window.viewing_scale = 50.0;
var nParts = 16;
var pieces = window.buildPiece(nParts);
for (var i = 0; i < pieces.length; i++) {
  pieces[i].parent = project.activeLayer;
  pieces[i].strokeColor = 'black';
  pieces[i].strokeWidth = 1/(viewing_scale * 2);
}
window.scratchPad.remove();
// {strokeColor: 'black', strokeWidth: 1/viewing_scale}
view.scale(viewing_scale,new Point());
view.translate(view.getCenter());





// Setup download
paper.install(window);
//currently name doesn't seem to work in some browsers.
//Save SVG from paper.js as a file.
var downloadAsSVG = function (fileName) {
   if(!fileName) {
       fileName = "paperjs_example.svg"
   }

   var url = "data:image/svg+xml;utf8," + encodeURIComponent(paper.project.exportSVG({asString:true}));

   var link = document.createElement("a");
   link.download = fileName;
   link.href = url;
   link.click();
}

t = new Tool();
//Listen for SHIFT-P to save content as SVG file.
t.onKeyUp = function(event) {
   if(event.character == "P") {
       downloadAsSVG("aperture");
   }
}