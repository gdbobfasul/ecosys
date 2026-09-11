# pupikes-toolkit-3drotate — Reviewer note (Huawei AppGallery)
Version 1.0021

## For reviewer
Reply to rule 4.3 ("photo editor, similar to existing apps; improve interaction design and feature depth").
The app is no longer a photo editor at all. Version 1.0021 makes "Paper 3D" its main screen — a concept we have not found in any other AppGallery app: FROM A PHOTO TO AN OBJECT IN YOUR HAND. Everything runs on the device (canvas + WebGL), no account, nothing uploaded.
- Figure: choose a paper 3D figure — photo cube (6 sides), pyramid (4 sides + base), gift box with a separate lid, photo lantern (4 arched photo windows, open bottom for an LED candle), photo stand (self-standing triangular tent), pop-up card (parallelogram mechanism: the photo stands up when the card opens) — set its size in mm and put a photo on each side (empty sides reuse the first photo).
- 3D preview: the assembled figure with the photos on its sides, rotated with a finger (our own WebGL engine, texture atlas built from the same drawing code as the print), auto-spin, save view as PNG.
- Print sheet: the figure is UNFOLDED into a real-scale template (mm) on A4 or Letter — solid cut lines, dashed fold lines, grey numbered glue tabs ("glue under side N"), side numbers, legend and step-by-step assembly instructions in the app language printed on the sheet; several figures per sheet, automatic 90° rotation / size reduction when the net does not fit, 150/300 DPI, export as PNG page(s) or a multi-page PDF (pdf-lib, offline).
- Stereo card: from ONE photo the app builds a simple depth model (radial dome + brightness relief, the same idea as its 3D relief mode) and renders two viewpoints — parallel pair, cross-eyed pair or red-cyan anaglyph — plus a printable stereo card sheet (62 mm pair at 65 mm eye distance + anaglyph + viewing note).
The previous 3D workbench (3D rotation with volume/relief, mockups, exact angles and presets, perspective straightening, 360° GIF, batch) remains as secondary tabs. 15-language interface; described in the store listing.
