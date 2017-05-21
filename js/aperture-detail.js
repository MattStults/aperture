paper.install(window);
//currently name doesn't seem to work in some browsers.
//Save SVG from paper.js as a file.
var buildForBlender = function() {
  window.scratchPad = new Group();
  var layers = window.buildAnularLayers(nParts);
  for (var i = 0; i < layers.length; i++) {
    layers[i].parent = project.activeLayer;
  }
  new Path.Circle({
      center: new Point(),
      radius: 1,
      name: 'scale_circle',
      fillColor: 'rgba(255, 255, 255, 0.001)',
      strokeColor: 'black',
      strokeWidth: (1 / window.viewing_scale),
      data: computeRotation(360.0 / nParts),
      parent: project.activeLayer
    });
  window.scratchPad.remove();
}

var buildForLaser = function() {
  window.scratchPad = new Group();
  var layers = window.buildLaserLayers(nParts);
  window.scratchPad.remove();
}

var downloadAsSVG = function (fileName) {
   if(!fileName) {
       fileName = "paperjs_example.svg"
   }

   var url = "data:image/svg+xml;utf8," + encodeURIComponent(project.exportSVG({asString:true}));

   var link = document.createElement("a");
   link.download = fileName;
   link.href = url;
   link.click();
}

t = new Tool();
//Listen for SHIFT-P to save content as SVG file.
t.onKeyUp = function(event) {
  if(event.character == "B") {
    project.activeLayer.removeChildren();
    buildForBlender();
    downloadAsSVG("aperture");
  } else if (event.character == "L") {
    project.activeLayer.removeChildren();
    buildForLaser();
    downloadAsSVG("aperture_for_laser");
  }
}


window.viewing_scale = 100.0;
buildForLaser();
view.scale(viewing_scale,new Point());