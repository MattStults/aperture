# Aperture

> **Written February–July 2017** (15 commits, all by Matt Stults). This is old personal work,
> not recent code. It was moved from Bitbucket to GitHub in October 2026 with its full history;
> the code is unchanged since July 2017. This README is the only later addition.
> It predates AI coding tools: every line of code here was written by hand.

A generator for a mechanical iris aperture: the ring of overlapping blades that opens and
closes like a camera shutter. It computes the shape of each blade so the blades sweep past each
other without colliding. It then lays the result out as layers for laser cutting, and builds an
animated, printable 3D model in Blender.

## What's interesting in it

- **`js/aperture-part.js`** (about 660 lines of [paper.js](http://paperjs.org/)) does the
  geometry.
  - `computeRotation` derives how far each blade must rotate from where neighbouring unit
    circles intersect.
  - `buildPieceShape` builds a blade by intersecting and subtracting circles swept along each
    blade's path of motion.
  - `buildPieceSweep` / `buildTranslationBox` approximate the area a blade covers as it moves,
    so that clearance can be cut out of its neighbours.
  - `buildBlenderPieceLayers` adds the pivots, the grooves they run in, and margins for
    clearance and material shrinkage, and assigns every part a depth layer.
- **`aperture_to_blender.py`** imports the SVG into Blender. It extrudes the layers, joins and
  cleans up the meshes, copies the blade around the ring, and keyframes the open/close motion.
- `aperture.html` shows an animated preview in the browser. The `*.stl` files are the
  successive print attempts.
- `aperture_deprecated.py` is an earlier, abandoned approach, kept for the record.

## Status and known issues

This is a prototype from a hobby build, without tests. The Blender script as last committed
still contains a debugging `raise` in `scaleAllCurves` that stops the pipeline, and it reads
the SVG from a hard-coded path. `aperture-part.js` has small bugs: a misspelled property
(`pivotCeil.bame`, so that layer keeps the wrong name), and an unused function
(`getPiecePartDepths`) that refers to variables that don't exist.

## Third-party code

- `js/paper-full.js`: [paper.js](http://paperjs.org/), the vector graphics library (MIT licence).
