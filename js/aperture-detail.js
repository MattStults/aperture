window.viewing_scale = 100.0;
var nParts = 16;
var layers = window.buildAnularLayers(nParts);
window.scratchPad.remove();
new Path.Circle({
    center: new Point(),
    radius: 1,
    name: 'scale_circle',
    fillColor: 'rgba(255, 255, 255, 0.001)',
    strokeColor: 'black',
    strokeWidth: (1 / window.viewing_scale)
  });
view.scale(viewing_scale,new Point());
// Create a circle that will allow us to scale this correctly when it gets into blender.


// Setup download
paper.install(window);
//currently name doesn't seem to work in some browsers.
//Save SVG from paper.js as a file.
var buildGroupForBlender = function() {
  window.scratchPad = new Group();
  var group = new Group();
  var nParts = 16;
  var layers = window.buildAnularLayers(nParts);
  for (var i = 0; i < layers.length; i++) {
    layers[i].parent = group;
  }
  window.scratchPad.remove();
  new Path.Circle({
      center: new Point(),
      radius: 1,
      name: 'scale_circle',
      fillColor: 'rgba(255, 255, 255, 0.001)',
      strokeColor: 'black',
      strokeWidth: (1 / window.viewing_scale),
      parent: group
    });
  return group;
}

var buildGroupForLaser = function() {
  window.scratchPad = new Group();
  var group = new Group();
  var nParts = 16;
  var layers = window.buildAnularLayers(nParts);
  for (var i = 0; i < layers.length; i++) {
    layers[i].parent = group;
  }
  window.scratchPad.remove();
  return group;
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
    buildGroupForBlender();
    downloadAsSVG("aperture");
  } else if (event.character == "L") {
    project.activeLayer.removeChildren();
    buildGroupForLaser();
    downloadAsSVG("aperture_for_laser");
  }
}