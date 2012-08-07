function MemoryAligned16(size) {
	this.buffer = new Uint16Array(size >> 1);
};

MemoryAligned16.prototype.loadU8 = function(offset, value) {
	var index = offset >> 1;
	if (offset & 1) {
		return (this.buffer[index] & 0xFF00) >>> 8;
	} else {
		return this.buffer[index] & 0x00FF;
	}
};

MemoryAligned16.prototype.loadU16 = function(offset) {
	return this.buffer[offset >> 1];
};

MemoryAligned16.prototype.load32 = function(offset) {
	return this.buffer[offset >> 1] | (this.vram[(offset >> 1) | 1] << 16);
};

MemoryAligned16.prototype.store8 = function(offset, value) {
	var index = offset >> 1;
	if (offset & 1) {
		this.store16(offset, (this.buffer[index] & 0x00FF) | (value << 8));
	} else {
		this.store16(offset, this.buffer[index] = (this.buffer[index] & 0xFF00) | value);
	}
};

MemoryAligned16.prototype.store16 = function(offset, value) {
	this.buffer[offset >> 1] = value;
};

MemoryAligned16.prototype.store32 = function(offset, value) {
	var index = offset >> 1;
	this.store16(offset, this.buffer[index] = value & 0xFFFF);
	this.store16(offset + 2, this.buffer[index + 1] = value >>> 16);
};

function GameBoyAdvanceVRAM(size) {
	MemoryAligned16.call(this, size);
	this.vram = this.buffer;
};

GameBoyAdvanceVRAM.prototype = Object.create(MemoryAligned16.prototype);

function GameBoyAdvanceOAM(size) {
	MemoryAligned16.call(this, size);
	this.oam = this.buffer;
	this.objs = new Array(128);
	for (var i = 0; i < 128; ++i) {
		this.objs[i] = new GameBoyAdvanceOBJ(this, i);
	}
	this.scalerot = new Array(32);
	for (var i = 0; i < 32; ++i) {
		this.scalerot[i] = {
			a: 1,
			b: 0,
			c: 0,
			d: 1
		};
	}
};

GameBoyAdvanceOAM.prototype = Object.create(MemoryAligned16.prototype);

GameBoyAdvanceOAM.prototype.store16 = function(offset, value) {
	var index = (offset & 0x3F8) >> 3;
	var obj = this.objs[index];
	var scalerot = this.scalerot[index >> 2];
	var layer = obj.priority;
	var disable = obj.disable;
	var y = obj.y;
	switch (offset & 0x00000006) {
	case 0:
		// Attribute 0
		obj.y = value & 0x00FF;
		obj.scalerot = value & 0x0100;
		if (obj.scalerot) {
			obj.scalerotOam = this.scalerot[obj.scalerotParam];
			obj.doublesize = !!(value & 0x0200);
			obj.disable = 0;
			obj.hflip = 0;
			obj.vflip = 0;
		} else {
			obj.doublesize = false;
			obj.disable = value & 0x0200;
			obj.hflip = obj.scalerotParam & 0x0008;
			obj.vflip = obj.scalerotParam & 0x0010;
		}
		obj.mode = value & 0x0C00;
		obj.mosaic = value & 0x1000;
		obj.multipalette = value & 0x2000;
		obj.shape = (value & 0xC000) >> 14;

		switch (obj.mode) {
		case 0x0000:
			// Normal
			obj.pushPixel = obj.multipalette ? this.video.pushPixelOpaque256 : this.video.pushPixelOpaque;
			break;
		case 0x0400:
			// Semi-transparent
			obj.pushPixel = obj.multipalette ? this.video.pushPixelBlend256 : this.video.pushPixelBlend;
			break;
		case 0x0800:
			// OBJ Window
			break;
		}

		if (disable && !obj.disable) {
			this.video.objLayers[layer].insert(obj);
		} else if (!disable && obj.disable) {
			this.video.objLayers[layer].remove(obj);
		}

		obj.recalcSize();
		break;
	case 2:
		// Attribute 1
		obj.x = value & 0x01FF;
		if (obj.scalerot) {
			obj.scalerotParam = (value & 0x3E00) >> 9;
			obj.scalerotOam = this.scalerot[obj.scalerotParam];
			obj.hflip = 0;
			obj.vflip = 0;
			obj.drawScanline = obj.drawScanlineAffine;
		} else {
			obj.hflip = value & 0x1000;
			obj.vflip = value & 0x2000;
			obj.drawScanline = obj.drawScanlineNormal;
		}
		obj.size = (value & 0xC000) >> 14;

		obj.recalcSize();
		break;
	case 4:
		// Attribute 2
		obj.tileBase = value & 0x03FF;
		obj.priority = (value & 0x0C00) >> 10;
		obj.palette = (value & 0xF000) >> 8; // This is shifted up 4 to make pushPixel faster
		if (layer != obj.priority) {
			this.video.objLayers[layer].remove(obj);
			this.video.objLayers[obj.priority].insert(obj);
		}
		break;
	case 6:
		// Scaling/rotation parameter
		switch (index & 0x3) {
		case 0:
			scalerot.a = (value << 16) / 0x1000000;
			break;
		case 1:
			scalerot.b = (value << 16) / 0x1000000;
			break;
		case 2:
			scalerot.c = (value << 16) / 0x1000000;
			break;
		case 3:
			scalerot.d = (value << 16) / 0x1000000;
			break;
		}
		break;
	}

	MemoryAligned16.prototype.store16.call(this, offset, value);
};

function GameBoyAdvancePalette() {
	this.rawPalette = [ new Uint16Array(0x100), new Uint16Array(0x100) ];
	this.colors = [ new Array(0x100), new Array(0x100) ];
	this.adjustedColors = [ new Array(0x100), new Array(0x100) ];
	this.passthroughColors = [
		this.colors[0], // BG0
		this.colors[0], // BG1
		this.colors[0], // BG2
		this.colors[0], // BG3
		this.colors[1], // OBJ
		this.colors[0] // Backdrop
	];

	var i;
	for (i = 0; i < 256; ++i) {
		this.colors[0][i] = [ 0, 0, 0 ];
		this.colors[1][i] = [ 0, 0, 0 ];
		this.adjustedColors[0][i] = [ 0, 0, 0 ];
		this.adjustedColors[1][i] = [ 0, 0, 0 ];
	}

	this.blendY = 1;
};

GameBoyAdvancePalette.prototype.loadU8 = function(offset) {
	return (this.loadU16(offset) >> (8 * (offset & 1))) & 0xFF;
};

GameBoyAdvancePalette.prototype.loadU16 = function(offset) {
	return this.rawPalette[(offset & 0x200) >> 9][(offset & 0x1FF) >> 1];
};

GameBoyAdvancePalette.prototype.load16 = function(offset) {
	return (this.loadU16(offset) << 16) >> 16;
};

GameBoyAdvancePalette.prototype.load32 = function(offset) {
	return this.loadU16(offset) | (this.loadU16(offset + 2) << 16);
};

GameBoyAdvancePalette.prototype.store16 = function(offset, value) {
	var type = (offset & 0x200) >> 9;
	var index = (offset & 0x1FF) >> 1;
	this.rawPalette[type][index] = value;
	this.convert16To32(value, this.colors[type][index]);
	this.adjustColor(value, this.adjustedColors[type][index]);
};

GameBoyAdvancePalette.prototype.store32 = function(offset, value) {
	this.store16(offset, value & 0xFFFF);
	this.store16(offset + 2, value >> 16);
};

GameBoyAdvancePalette.prototype.convert16To32 = function(value, array) {
	var r = (value & 0x001F) << 3;
	var g = (value & 0x03E0) >> 2;
	var b = (value & 0x7C00) >> 7;

	array[0] = r;
	array[1] = g;
	array[2] = b;
};

GameBoyAdvancePalette.prototype.makeDarkPalettes = function(layers) {
	if (this.adjustColor != this.adjustColorDark) {
		this.adjustColor = this.adjustColorDark;
		this.resetPalettes();
	}
	this.resetPaletteLayers(layers);
};

GameBoyAdvancePalette.prototype.makeBrightPalettes = function(layers) {
	if (this.adjustColor != this.adjustColorBright) {
		this.adjustColor = this.adjustColorBright;
		this.resetPalettes();
	}
	this.resetPaletteLayers(layers);
};

GameBoyAdvancePalette.prototype.makeNormalPalettes = function() {
	this.passthroughColors[0] = this.colors[0];
	this.passthroughColors[1] = this.colors[0];
	this.passthroughColors[2] = this.colors[0];
	this.passthroughColors[3] = this.colors[0];
	this.passthroughColors[4] = this.colors[1];
	this.passthroughColors[5] = this.colors[0];
};

GameBoyAdvancePalette.prototype.makeSpecialPalette = function(layer) {
	this.passthroughColors[layer.index] = this.adjustedColors[layer.bg ? 0 : 1];
};

GameBoyAdvancePalette.prototype.makeNormalPalette = function(layer) {
	this.passthroughColors[layer.index] = this.colors[layer.bg ? 0 : 1];
};

GameBoyAdvancePalette.prototype.resetPaletteLayers = function(layers) {
	if (layers & 0x01) {
		this.passthroughColors[0] = this.adjustedColors[0];
	} else {
		this.passthroughColors[0] = this.colors[0];
	}
	if (layers & 0x02) {
		this.passthroughColors[1] = this.adjustedColors[0];
	} else {
		this.passthroughColors[1] = this.colors[0];
	}
	if (layers & 0x04) {
		this.passthroughColors[2] = this.adjustedColors[0];
	} else {
		this.passthroughColors[2] = this.colors[0];
	}
	if (layers & 0x08) {
		this.passthroughColors[3] = this.adjustedColors[0];
	} else {
		this.passthroughColors[3] = this.colors[0];
	}
	if (layers & 0x10) {
		this.passthroughColors[4] = this.adjustedColors[1];
	} else {
		this.passthroughColors[4] = this.colors[1];
	}
	if (layers & 0x20) {
		this.passthroughColors[5] = this.adjustedColors[0];
	} else {
		this.passthroughColors[5] = this.colors[0];
	}
};

GameBoyAdvancePalette.prototype.resetPalettes = function() {
	var i;
	var outPalette = this.adjustedColors[0];
	var inPalette = this.rawPalette[0];
	for (i = 0; i < 256; ++i) {
		this.adjustColor(inPalette[i], outPalette[i]);
	}

	outPalette = this.adjustedColors[1];
	inPalette = this.rawPalette[1];
	for (i = 0; i < 256; ++i) {
		this.adjustColor(inPalette[i], outPalette[i]);
	}
}

GameBoyAdvancePalette.prototype.accessColor = function(layer, index) {
	return this.passthroughColors[layer][index];
};

GameBoyAdvancePalette.prototype.adjustColorDark = function(color, array) {
	var r = (color & 0x001F);
	var g = (color & 0x03E0) >> 5;
	var b = (color & 0x7C00) >> 10;

	r = r - (r * this.blendY);
	g = g - (g * this.blendY);
	b = b - (b * this.blendY);

	array[0] = r << 3;
	array[1] = g << 3;
	array[2] = b << 3;
};

GameBoyAdvancePalette.prototype.adjustColorBright = function(color, array) {
	var r = (color & 0x001F);
	var g = (color & 0x03E0) >> 5;
	var b = (color & 0x7C00) >> 10;

	r = r + ((31 - r) * this.blendY);
	g = g + ((31 - g) * this.blendY);
	b = b + ((31 - b) * this.blendY);

	array[0] = r << 3;
	array[1] = g << 3;
	array[2] = b << 3;
};

GameBoyAdvancePalette.prototype.adjustColor = GameBoyAdvancePalette.prototype.convert16To32;

GameBoyAdvancePalette.prototype.setBlendY = function(y) {
	if (this.blendY != y) {
		this.blendY = y;
		this.resetPalettes();
	}
};

function GameBoyAdvanceOBJ(oam, index) {
	this.TILE_OFFSET = 0x10000;
	this.oam = oam;

	this.index = index;
	this.x = 0;
	this.y = 0;
	this.scalerot = 0;
	this.doublesize = false;
	this.disable = 1;
	this.mode = 0;
	this.mosaic = false;
	this.multipalette = false;
	this.shape = 0;
	this.scalerotParam = 0;
	this.hflip = 0;
	this.vflip = 0;
	this.tileBase = 0;
	this.priority = 0;
	this.palette = 0;
	this.drawScanline = this.drawScanlineNormal;
	this.pushPixel = null;
	this.cachedWidth = 8;
	this.cachedHeight = 8;
};

GameBoyAdvanceOBJ.prototype.drawScanlineNormal = function(backing, y, yOff) {
	var video = this.oam.video;
	var x;
	var underflow;
	var offset;
	if (this.x < video.HORIZONTAL_PIXELS) {
		underflow = 0;
		offset = (backing.y * video.HORIZONTAL_PIXELS + this.x) * 4;
	} else {
		underflow = 512 - this.x;
		offset = (backing.y * video.HORIZONTAL_PIXELS) * 4;
	}
	
	var localX;
	var localY;
	if (!this.vflip) {
		localY = y - yOff;
	} else {
		localY = this.cachedHeight - y + yOff - 1;
	}
	var localYLo = localY & 0x7;
	var tileOffset;
	if (video.objCharacterMapping) {
		tileOffset = ((localY & 0x01F8) * this.cachedWidth) >> 6;
	} else {
		tileOffset = (localY & 0x01F8) << 2;
	}

	var paletteShift = this.multipalette ? 1 : 0;

	if (!this.hflip) {
		localX = underflow;
	} else {
		localX = this.cachedWidth - underflow - 1;
	}

	tileRow = video.accessTile(this.TILE_OFFSET + (x & 0x4) * paletteShift, this.tileBase + (tileOffset << paletteShift) + ((localX & 0x01F8) >> (3 - paletteShift)), localYLo << paletteShift);
	for (x = underflow; x < this.cachedWidth; ++x) {
		if (!this.hflip) {
			localX = x;
		} else {
			localX = this.cachedWidth - x - 1;
		}
		if (!paletteShift) {
			if (!(x & 0x7)) {
				tileRow = video.accessTile(this.TILE_OFFSET, this.tileBase + tileOffset + (localX >> 3), localYLo);
			}
		} else {
			if (!(x & 0x3)) {
				tileRow = video.accessTile(this.TILE_OFFSET + (localX & 0x4), this.tileBase + (tileOffset << 1) + ((localX & 0x01F8) >> 2), localYLo << 1);
			}
		}
		this.pushPixel(4, this, video, tileRow, localX & 0x7, offset, backing);
		offset += 4;
	}
};

GameBoyAdvanceOBJ.prototype.drawScanlineAffine = function(backing, y, yOff) {
	var video = this.oam.video;
	var x;
	var underflow;
	var offset;
	if (this.x < video.HORIZONTAL_PIXELS) {
		underflow = 0;
		offset = (backing.y * video.HORIZONTAL_PIXELS + this.x) * 4;
	} else {
		underflow = 512 - this.x;
		offset = (backing.y * video.HORIZONTAL_PIXELS) * 4;
	}

	var localX;
	var localY;
	var yDiff = y - yOff;
	var tileOffset;

	var paletteShift = this.multipalette ? 1 : 0;
	var totalWidth = this.cachedWidth << this.doublesize;
	var totalHeight = this.cachedHeight << this.doublesize;
	var drawWidth = totalWidth;
	if (drawWidth > video.HORIZONTAL_PIXELS) {
		totalWidth = video.HORIZONTAL_PIXELS;
	}

	for (x = underflow; x < drawWidth; ++x) {
		localX = this.scalerotOam.a * (x - (totalWidth >> 1)) + this.scalerotOam.b * (yDiff - (totalHeight >> 1)) + (this.cachedWidth >> 1);
		localY = this.scalerotOam.c * (x - (totalWidth >> 1)) + this.scalerotOam.d * (yDiff - (totalHeight >> 1)) + (this.cachedHeight >> 1);

		if (localX < 0 || localX >= this.cachedWidth || localY < 0 || localY >= this.cachedHeight) {
			offset += 4;
			continue;
		}

		if (video.objCharacterMapping) {
			tileOffset = ((localY & 0x01F8) * this.cachedWidth) >> 6;
		} else {
			tileOffset = (localY & 0x01F8) << 2;
		}
		tileRow = video.accessTile(this.TILE_OFFSET + (localX & 0x4) * paletteShift, this.tileBase + (tileOffset << paletteShift) + ((localX & 0x01F8) >> (3 - paletteShift)), (localY & 0x7) << paletteShift);
		this.pushPixel(4, this, video, tileRow, localX & 0x7, offset, backing);
		offset += 4;
	}
};

GameBoyAdvanceOBJ.prototype.recalcSize = function() {
	// TODO: scale/rotation
	switch (this.shape) {
	case 0:
		// Square
		this.cachedHeight = this.cachedWidth = 8 << this.size;
		break;
	case 1:
		// Horizontal
		switch (this.size) {
		case 0:
			this.cachedHeight = 8;
			this.cachedWidth = 16;
			break;
		case 1:
			this.cachedHeight = 8;
			this.cachedWidth = 32;
			break;
		case 2:
			this.cachedHeight = 16;
			this.cachedWidth = 32;
			break;
		case 3:
			this.cachedHeight = 32;
			this.cachedWidth = 64;
			break;
		}
		break;
	case 2:
		// Vertical
		switch (this.size) {
		case 0:
			this.cachedHeight = 16;
			this.cachedWidth = 8;
			break;
		case 1:
			this.cachedHeight = 32;
			this.cachedWidth = 8;
			break;
		case 2:
			this.cachedHeight = 32;
			this.cachedWidth = 16;
			break;
		case 3:
			this.cachedHeight = 64;
			this.cachedWidth = 32;
			break;
		}
		break;
	default:
		// Bad!
	}
};

function GameBoyAdvanceOBJLayer(i) {
	this.bg = false;
	this.index = i;
	this.priority = i;
	this.objs = new Array();
};

GameBoyAdvanceOBJLayer.prototype.drawScanline = function(backing, video) {
	var y = video.vcount;
	var wrappedY;
	var obj;
	// Draw in reverse: OBJ0 is higher priority than OBJ1, etc
	for (var i = this.objs.length; i--;) {
		obj = this.objs[i];
		if (obj.y < video.VERTICAL_PIXELS) {
			wrappedY = obj.y;
		} else {
			wrappedY = obj.y - 256;
		}
		var totalHeight;
		if (!obj.scalerot) {
			totalHeight = obj.cachedHeight;
		} else {
			totalHeight = obj.cachedHeight << obj.doublesize;
		}
		if (wrappedY <= y && (wrappedY + totalHeight) > y) {
			this.objs[i].drawScanline(backing, y, wrappedY);
		}
	}
};

GameBoyAdvanceOBJLayer.prototype.insert = function(obj) {
	this.objs.push(obj);
	this.objs.sort(this.objComparator);
};

GameBoyAdvanceOBJLayer.prototype.remove = function(obj) {
	for (var i = 0; i < this.objs.length; ++i) {
		if (this.objs[i] === obj) {
			this.objs.splice(i, 1);
			break;
		}
	}
};

GameBoyAdvanceOBJLayer.prototype.objComparator = function(a, b) {
	return a.index - b.index;
};

function GameBoyAdvanceVideo() {
	this.LAYER_BG0 = 0;
	this.LAYER_BG1 = 1;
	this.LAYER_BG2 = 2;
	this.LAYER_BG3 = 3;
	this.LAYER_OBJ = 4;
	this.LAYER_BACKDROP = 5;

	this.CYCLES_PER_PIXEL = 4;

	this.HORIZONTAL_PIXELS = 240;
	this.HBLANK_PIXELS = 68;
	this.HDRAW_LENGTH = 1006;
	this.HBLANK_LENGTH = 226;
	this.HORIZONTAL_LENGTH = 1232;

	this.VERTICAL_PIXELS = 160;
	this.VBLANK_PIXELS = 68;
	this.VERTICAL_TOTAL_PIXELS = 228;

	this.TOTAL_LENGTH = 280896;

	this.drawCallback = function() {};
};

GameBoyAdvanceVideo.prototype.clear = function() {
	this.palette = new GameBoyAdvancePalette();
	this.vram = new GameBoyAdvanceVRAM(this.cpu.mmu.SIZE_VRAM);
	this.oam = new GameBoyAdvanceOAM(this.cpu.mmu.SIZE_OAM);
	this.oam.video = this;
	this.objLayers = [
		new GameBoyAdvanceOBJLayer(0),
		new GameBoyAdvanceOBJLayer(1),
		new GameBoyAdvanceOBJLayer(2),
		new GameBoyAdvanceOBJLayer(3)
	];

	// DISPCNT
	this.backgroundMode = 0;
	this.displayFrameSelect = 0;
	this.hblankIntervalFree = 0;
	this.objCharacterMapping = 0;
	this.forcedBlank = 0;
	this.bg0 = 0;
	this.bg1 = 0;
	this.bg2 = 0;
	this.bg3 = 0;
	this.obj = 0;
	this.win0 = 0;
	this.win1 = 0;
	this.objwin = 0;

	// DISPSTAT
	this.DISPSTAT_MASK = 0xFF38;
	this.inHblank = false;
	this.inVblank = false;
	this.vcounter = 0;
	this.vblankIRQ = 0;
	this.hblankIRQ = 0;
	this.vcounterIRQ = 0;
	this.vcountSetting = 0;

	// VCOUNT
	this.vcount = 0;

	// WIN0H
	this.win0Left = 0;
	this.win0Right = 240;

	// WIN1H
	this.win1Left = 0;
	this.win1Right = 240;

	// WIN0V
	this.win0Top = 0;
	this.win0Bottom = 160;

	// WIN1V
	this.win1Top = 0;
	this.win1Bottom = 160;

	// WININ/WINOUT
	this.windows = new Array();
	for (var i = 0; i < 4; ++i) {
		this.windows.push({
			enabled: new Array(5),
			special: 0
		});
	};

	// BLDCNT
	this.target1 = new Array(5);
	this.target2 = new Array(5);
	this.blendMode = 0;

	// BLDALPHA
	this.blendA = 0;
	this.blendB = 0;

	// BLDY
	this.blendY = 0;

	this.lastHblank = 0;
	this.nextHblank = this.HDRAW_LENGTH;
	this.nextEvent = this.nextHblank;

	this.nextHblankIRQ = 0;
	this.nextVblankIRQ = 0;
	this.nextVcounterIRQ = 0;

	this.bg = new Array();
	for (var i = 0; i < 4; ++i) {
		this.bg.push({
			bg: true,
			index: i,
			video: this,
			vram: this.vram,
			priority: 0,
			charBase: 0,
			mosaic: false,
			multipalette: false,
			screenBase: 0,
			overflow: 0,
			size: 0,
			x: 0,
			y: 0,
			refx: 0,
			refy: 0,
			dx: 0,
			dmx: 0,
			dy: 0,
			dmy: 0,
			pushPixel: this.pushPixelOpaque,
			drawScanline: this.drawScanlineBGMode0
		});
	}

	this.bgModes = [
		this.drawScanlineBGMode0,
		this.drawScanlineBGMode1,
		function () { throw 'Unimplemented BG Mode 2'; },
		function () { throw 'Unimplemented BG Mode 3'; },
		function () { throw 'Unimplemented BG Mode 4'; },
		function () { throw 'Unimplemented BG Mode 5'; }
	];

	this.drawLayers = [];

	this.sharedMap = {
		tile: 0,
		hflip: false,
		vflip: false,
		palette: 0
	};
};

GameBoyAdvanceVideo.prototype.setBacking = function(backing) {
	this.pixelData = backing.createImageData(this.HORIZONTAL_PIXELS, this.VERTICAL_PIXELS);
	this.context = backing;

	// Clear backing first
	for (var offset = 0; offset < this.HORIZONTAL_PIXELS * this.VERTICAL_PIXELS * 4;) {
		this.pixelData.data[offset++] = 0xFF;
		this.pixelData.data[offset++] = 0xFF;
		this.pixelData.data[offset++] = 0xFF;
		this.pixelData.data[offset++] = 0xFF;
	}

	this.platformBacking = this.pixelData.data;
}

GameBoyAdvanceVideo.prototype.updateTimers = function(cpu) {
	var cycles = cpu.cycles;

	if (this.nextEvent <= cycles) {
		if (this.inHblank) {
			// End Hblank
			this.inHblank = false;
			this.pixelData.data.y = this.vcount; // Used inside of drawScanline
			switch (this.vcount + 1) {
			case this.VERTICAL_PIXELS:
				this.inVblank = true;
				this.drawScanline(this.platformBacking); // Draw final scanline
				this.finishDraw();
				this.nextVblankIRQ = this.nextEvent + this.TOTAL_LENGTH;
				this.cpu.mmu.runVblankDmas();
				if (this.vblankIRQ) {
					this.cpu.irq.raiseIRQ(this.cpu.irq.IRQ_VBLANK);
				}
				break;
			case this.VERTICAL_TOTAL_PIXELS - 1:
				this.inVblank = false;
				break;
			case this.VERTICAL_TOTAL_PIXELS:
				this.vcount = -1;
				break;
			default:
				if (!this.inVblank) {
					this.drawScanline(this.platformBacking);
				}
				break;
			}
			++this.vcount;
			this.nextEvent = this.nextHblank;
		} else {
			// Begin Hblank
			this.inHblank = true;
			this.lastHblank = this.nextHblank;
			this.nextEvent = this.lastHblank + this.HBLANK_LENGTH;
			this.nextHblank = this.nextEvent + this.HDRAW_LENGTH;
			this.nextHblankIRQ = this.nextHblank;
			if (this.vcount < this.VERTICAL_PIXELS) {
				this.cpu.mmu.runHblankDmas();
				if (this.hblankIRQ) {
					this.cpu.irq.raiseIRQ(this.cpu.irq.IRQ_HBLANK);
				}
			}
		}
	}
};

GameBoyAdvanceVideo.prototype.writeDisplayControl = function(value) {
	this.backgroundMode = value & 0x0007;
	this.displayFrameSelect = value & 0x0010;
	this.hblankIntervalFree = value & 0x0020;
	this.objCharacterMapping = value & 0x0040;
	this.forcedBlank = value & 0x0080;
	this.bg0 = value & 0x0100;
	this.bg1 = value & 0x0200;
	this.bg2 = value & 0x0400;
	this.bg3 = value & 0x0800;
	this.obj = value & 0x1000;
	this.win0 = value & 0x2000;
	this.win1 = value & 0x4000;
	this.objwin = value & 0x8000;

	this.resetLayers();
};

GameBoyAdvanceVideo.prototype.writeDisplayStat = function(value) {
	this.vblankIRQ = value & 0x0008;
	this.hblankIRQ = value & 0x0010;
	this.vcounterIRQ = value & 0x0020;
	this.vcountSetting = (value & 0xFF00) >> 8;
};

GameBoyAdvanceVideo.prototype.readDisplayStat = function() {
	return (this.inVblank) | (this.inHblank << 1) | (this.vcounter << 2);
};

GameBoyAdvanceVideo.prototype.writeBackgroundControl = function(bg, value) {
	var bgData = this.bg[bg];
	bgData.priority = value & 0x0003;
	bgData.charBase = (value & 0x000C) << 12;
	bgData.mosaic = value & 0x0040;
	bgData.multipalette = value & 0x0080;
	bgData.screenBase = (value & 0x1F00) << 3;
	bgData.overflow = value & 0x2000;
	bgData.size = (value & 0xC000) >> 14;

	this.drawLayers.sort(this.layerComparator);
};

GameBoyAdvanceVideo.prototype.writeBackgroundHOffset = function(bg, value) {
	this.bg[bg].x = value & 0x1FF;
};

GameBoyAdvanceVideo.prototype.writeBackgroundVOffset = function(bg, value) {
	this.bg[bg].y = value & 0x1FF;
};

GameBoyAdvanceVideo.prototype.writeBackgroundRefX = function(bg, value) {
	this.bg[bg].refx = (value << 4) / 4096;
};

GameBoyAdvanceVideo.prototype.writeBackgroundRefY = function(bg, value) {
	this.bg[bg].refy = (value << 4) / 4096;
};

GameBoyAdvanceVideo.prototype.writeBackgroundParamA = function(bg, value) {
	this.bg[bg].dx = (value >> 0) / 256;
};

GameBoyAdvanceVideo.prototype.writeBackgroundParamB = function(bg, value) {
	this.bg[bg].dmx = (value >> 0) / 256;
};

GameBoyAdvanceVideo.prototype.writeBackgroundParamC = function(bg, value) {
	this.bg[bg].dy = (value >> 0) / 256;
};

GameBoyAdvanceVideo.prototype.writeBackgroundParamD = function(bg, value) {
	this.bg[bg].dmy = (value >> 0) / 256;
};

GameBoyAdvanceVideo.prototype.writeWin0H = function(value) {
	this.win0Left = (value & 0xFF00) >> 8;
	this.win0Right = Math.min(this.HORIZONTAL_PIXELS, value & 0x00FF);
	if (this.win0Left > this.win0Right) {
		this.win0Right = this.HORIZONTAL_PIXELS;
	}
};

GameBoyAdvanceVideo.prototype.writeWin1H = function(value) {
	this.win1Left = (value & 0xFF00) >> 8;
	this.win1Right = Math.min(this.HORIZONTAL_PIXELS, value & 0x00FF);
	if (this.win1Left > this.win1Right) {
		this.win1Right = this.HORIZONTAL_PIXELS;
	}
};

GameBoyAdvanceVideo.prototype.writeWin0V = function(value) {
	this.win0Top = (value & 0xFF00) >> 8;
	this.win0Bottom = Math.min(this.VERTICAL_PIXELS, value & 0x00FF);
	if (this.win0Top > this.win0Bottom) {
		this.win0Bottom = this.VERTICAL_PIXELS;
	}
};

GameBoyAdvanceVideo.prototype.writeWin1V = function(value) {
	this.win1Top = (value & 0xFF00) >> 8;
	this.win1Bottom = Math.min(this.VERTICAL_PIXELS, value & 0x00FF);
	if (this.win1Top > this.win1Bottom) {
		this.win1Bottom = this.VERTICAL_PIXELS;
	}
};

GameBoyAdvanceVideo.prototype.writeWindow = function(index, value) {
	var window = this.windows[index];
	window.enabled[0] = value & 0x01;
	window.enabled[1] = value & 0x02;
	window.enabled[2] = value & 0x04;
	window.enabled[3] = value & 0x08;
	window.enabled[4] = value & 0x10;
	window.special = value & 0x20;
};

GameBoyAdvanceVideo.prototype.writeWinIn = function(value) {
	this.writeWindow(0, value);
	this.writeWindow(1, value >> 8);
};

GameBoyAdvanceVideo.prototype.writeWinOut = function(value) {
	this.writeWindow(2, value);
	this.writeWindow(3, value >> 8);
};

GameBoyAdvanceVideo.prototype.writeBlendControl = function(value) {
	this.target1[0] = value & 0x0001;
	this.target1[1] = value & 0x0002;
	this.target1[2] = value & 0x0004;
	this.target1[3] = value & 0x0008;
	this.target1[4] = value & 0x0010;
	this.target1[5] = value & 0x0020;
	this.target2[0] = value & 0x0100;
	this.target2[1] = value & 0x0200;
	this.target2[2] = value & 0x0400;
	this.target2[3] = value & 0x0800;
	this.target2[4] = value & 0x1000;
	this.target2[5] = value & 0x2000;
	this.blendMode = (value & 0x00C0) >> 6;

	var i;
	for (i = 0; i < 4; ++i) {
		this.bg[i].pushPixel = this.bg[i].multipalette ? this.pushPixelOpaque256 : this.pushPixelOpaque;
	}
	switch (this.blendMode) {
	case 1:
		// Alpha
		for (i = 0; i < 4; ++i) {
			if (this.target1[i]) {
				this.bg[i].pushPixel = this.bg[i].multipalette ? this.pushPixelBlend256 : this.pushPixelBlend;
			}
		}
	case 0:
		// Normal
		this.palette.makeNormalPalettes();
		break;
	case 2:
		// Brighter
		this.palette.makeBrightPalettes(value & 0x3F);
		break;
	case 3:
		// Darker
		this.palette.makeDarkPalettes(value & 0x3F);
		break;
	}
};

GameBoyAdvanceVideo.prototype.setBlendEnabled = function(layer, enabled) {
	layer.pushPixel = layer.multipalette ? this.pushPixelOpaque256 : this.pushPixelOpaque;
	if (enabled) {
		switch (this.blendMode) {
		case 1:
			// Alpha
			layer.pushPixel = layer.multipalette ? this.pushPixelBlend256 : this.pushPixelBlend;
		case 0:
			// Normal
			this.palette.makeNormalPalette(layer);
			break;
		case 2:
			// Brighter
		case 3:
			// Darker
			this.palette.makeSpecialPalette(layer);
			break;
		}
	} else {
		this.palette.makeNormalPalette(layer);
	}
};

GameBoyAdvanceVideo.prototype.writeBlendAlpha = function(value) {
	this.blendA = (value & 0x001F) / 16;
	if (this.blendA > 1) {
		this.blendA = 1;
	}
	this.blendB = ((value & 0x1F00) >> 8) / 16;
	if (this.blendB > 1) {
		this.blendB = 1;
	}
};

GameBoyAdvanceVideo.prototype.writeBlendY = function(value) {
	this.blendY = value;
	this.palette.setBlendY(value >= 16 ? 1 : (value / 16));
};

GameBoyAdvanceVideo.prototype.resetLayers = function() {
	this.drawLayers = this.obj ? this.objLayers.slice(0) : [];
	if (this.backgroundMode < 2) {
		if (this.bg0) {
			this.drawLayers.push(this.bg[0]);
		}
		if (this.bg1) {
			this.drawLayers.push(this.bg[1]);
		}
	}
	if (this.bg2) {
		this.bg[2].drawScanline = this.bgModes[this.backgroundMode];
		this.drawLayers.push(this.bg[2]);
	}
	if ((this.backgroundMode == 0 || this.backgroundMode == 2) && this.bg3) {
		this.bg[3].drawScanline = this.bgModes[this.backgroundMode];
		this.drawLayers.push(this.bg[3]);
	}
	this.drawLayers.sort(this.layerComparator);
};

GameBoyAdvanceVideo.prototype.layerComparator = function(a, b) {
	var diff = a.priority - b.priority;
	if (!diff) {
		if (a.bg && !b.bg) {
			return 1;
		} else if (!a.bg && b.bg) {
			return -1;
		}
		return a.index - b.index;
	}
	return diff;
};

GameBoyAdvanceVideo.prototype.accessMapMode0 = function(base, size, x, yBase, out) {
	var offset = base + ((x >> 2) & 0x3E) + yBase;

	if (size & 1) {
		offset += (x & 0x100) << 3;
	}

	var mem = this.vram.loadU16(offset);
	out.tile = mem & 0x03FF;
	out.hflip = mem & 0x0400;
	out.vflip = mem & 0x0800;
	out.palette = (mem & 0xF000) >> 8 // This is shifted up 4 to make pushPixel faster
};

GameBoyAdvanceVideo.prototype.accessMapMode1 = function(base, size, x, yBase, out) {
	var offset = base + (x >> 3) + yBase;

	out.tile = this.vram.loadU8(offset);
};

GameBoyAdvanceVideo.prototype.accessTile = function(base, tile, y) {
	var offset = base + (tile << 5);
	offset |= y << 2;

	return this.vram.load32(offset);
}

GameBoyAdvanceVideo.prototype.pushPixelOpaque = function(layer, map, video, row, x, offset, backing) {
	var index = (row >> (x << 2)) & 0xF;
	// Index 0 is transparent
	if (index) {
		var pixel = video.palette.accessColor(layer, map.palette | index);
		backing[offset] = pixel[0];
		backing[offset + 1] = pixel[1];
		backing[offset + 2] = pixel[2];
	}
};

GameBoyAdvanceVideo.prototype.pushPixelOpaque256 = function(layer, map, video, row, x, offset, backing) {
	var index = (row >> (x << 3)) & 0xFF;
	if (index) {
		var pixel = video.palette.accessColor(layer, index);
		backing[offset] = pixel[0];
		backing[offset + 1] = pixel[1];
		backing[offset + 2] = pixel[2];
	}
};

GameBoyAdvanceVideo.prototype.pushPixelBlend = function(layer, map, video, row, x, offset, backing) {
	var index = (row >> (x << 2)) & 0xF;
	// Index 0 is transparent
	if (index) {
		var pixel = video.palette.accessColor(layer, map.palette | index);
		// TODO: better detect which layer is below us
		backing[offset] = backing[offset] * video.blendB + pixel[0] * video.blendA;
		backing[offset + 1] = backing[offset + 1] * video.blendB + pixel[1] * video.blendA;
		backing[offset + 2] = backing[offset + 2] * video.blendB + pixel[2] * video.blendA;
	}
};

GameBoyAdvanceVideo.prototype.pushPixelBlend256 = function(layer, map, video, row, x, offset, backing) {
	var index = (row >> (x << 3)) & 0xFF;
	// Index 0 is transparent
	if (index) {
		var pixel = video.palette.accessColor(layer, index);
		// TODO: better detect which layer is below us
		backing[offset] = backing[offset] * video.blendB + pixel[0] * video.blendA;
		backing[offset + 1] = backing[offset + 1] * video.blendB + pixel[1] * video.blendA;
		backing[offset + 2] = backing[offset + 2] * video.blendB + pixel[2] * video.blendA;
	}
};

GameBoyAdvanceVideo.prototype.identity = function(x) {
	return x;
};

GameBoyAdvanceVideo.prototype.drawScanlineBlank = function(backing) {
	var offset = backing.y * 4 * this.HORIZONTAL_PIXELS;
	for (var x = 0; x < this.HORIZONTAL_PIXELS; ++x) {
		backing[offset++] = 0xFF;
		backing[offset++] = 0xFF;
		backing[offset++] = 0xFF;
		backing[offset++] = 0xFF;
	}
};

GameBoyAdvanceVideo.prototype.drawScanlineBackdrop = function(backing) {
	var offset = backing.y * 4 * this.HORIZONTAL_PIXELS;
	var bd = this.palette.accessColor(this.LAYER_BACKDROP, 0);
	for (var x = 0; x < this.HORIZONTAL_PIXELS; ++x) {
		backing[offset++] = bd[0];
		backing[offset++] = bd[1];
		backing[offset++] = bd[2];
		offset++;
	}
};

GameBoyAdvanceVideo.prototype.drawScanlineBGMode0 = function(backing, bg, start, end) {
	var video = this.video;
	var x;
	var y = video.vcount;
	var offset = (backing.y * video.HORIZONTAL_PIXELS + start) << 2;
	var xOff = bg.x;
	var yOff = bg.y;
	var localX;
	var localXLo;
	var localY = y + yOff;
	var localYLo = localY & 0x7;
	var screenBase = bg.screenBase;
	var charBase = bg.charBase;
	var size = bg.size;
	var index = bg.index;
	var map = video.sharedMap;
	var paletteShift = bg.multipalette ? 1 : 0;

	var yBase = (localY << 3) & 0x7C0;
	if (size == 2) {
		yBase += (localY << 3) & 0x800;
	}
	if (size == 3) {
		yBase += (localY << 4) & 0x1000;
	}

	video.accessMapMode0(screenBase, size, start + xOff, yBase, map);
	var tileRow = video.accessTile(charBase, map.tile << paletteShift, (!map.vflip ? localYLo : 7 - localYLo) << paletteShift);
	for (x = start; x < end; ++x) {
		localX = x + xOff;
		localXLo = localX & 0x7;
		if (!paletteShift) {
			if (!localXLo) {
				video.accessMapMode0(screenBase, size, localX, yBase, map);
				tileRow = video.accessTile(charBase, map.tile, !map.vflip ? localYLo : 7 - localYLo);
				if (!tileRow) {
					x += 7;
					offset += 32;
					continue;
				}
			}
		} else {
			if (!localXLo) {
				video.accessMapMode0(screenBase, size, localX, yBase, map);
				tileRow = video.accessTile(charBase, map.tile << 1, (!map.vflip ? localYLo : 7 - localYLo) << 1);
				if (!tileRow) {
					x += 3;
					offset += 16;
					continue;
				}
			} else if (!(localXLo & 0x3)) {
				tileRow = video.accessTile(charBase + 4, map.tile << 1, (!map.vflip ? localYLo : 7 - localYLo) << 1);
				if (!tileRow) {
					x += 3;
					offset += 16;
					continue;
				}
			}
		}
		if (map.hflip) {
			localXLo = 7 - localXLo;
		}
		bg.pushPixel(index, map, video, tileRow, localXLo, offset, backing);
		offset += 4;
	}
};

GameBoyAdvanceVideo.prototype.drawScanlineBGMode1 = function(backing, bg, start, end) {
	var video = this.video;
	var x;
	var y = video.vcount;
	var offset = (backing.y * video.HORIZONTAL_PIXELS + start) << 2;
	var localX;
	var localY;
	var screenBase = bg.screenBase;
	var charBase = bg.charBase;
	var size = bg.size;
	var index = bg.index;
	var map = video.sharedMap;
	var color;
	var det = 1 / (bg.dx * bg.dmy - bg.dmx * bg.dy);

	var yBase;

	for (x = start; x < end; ++x) {
		localX = bg.dx * x + bg.dmx * y + bg.refx;
		localY = bg.dy * x + bg.dmy * y + bg.refy;
		localX %= 256;
		localY %= 256;
		yBase = (localY << 2) & 0x7E0;
		video.accessMapMode1(screenBase, size, localX, yBase, map);
		color = this.vram.loadU8(charBase + (map.tile << 6) + ((localY & 0x7) << 3) + (localX & 0x7));
		video.pushPixelOpaque256(0, map, video, color, 0, offset, backing);
		offset += 4;
	}
};

GameBoyAdvanceVideo.prototype.drawScanline = function(backing) {
	if (this.forcedBlank) {
		this.drawScanlineBlank(backing);
		return;
	}
	this.drawScanlineBackdrop(backing);
	var layer;
	var firstStart;
	var firstEnd;
	var lastStart;
	var lastEnd;
	var y = this.vcount;
	// Draw lower priority first and then draw over them
	for (var i = this.drawLayers.length; i--;) {
		layer = this.drawLayers[i];
		if (layer.bg) {
			if (!(this.win0 || this.win1)) {
				layer.drawScanline(backing, layer, 0, this.HORIZONTAL_PIXELS);
			} else {
				firstEnd = this.HORIZONTAL_PIXELS;
				lastStart = 0;
				if (this.win1 && y >= this.win1Top && y < this.win1Bottom) {
					firstEnd = Math.min(firstEnd, this.win1Left);
					lastStart = Math.max(lastStart, this.win1Right);
					if (this.windows[1].enabled[layer.index]) {
						this.setBlendEnabled(layer, this.windows[1].special && this.target1[layer.index]);
						layer.drawScanline(backing, layer, this.win1Left, this.win1Right);
					}
				}
				if (this.win0 && y >= this.win0Top && y < this.win0Bottom) {
					firstEnd = Math.min(firstEnd, this.win0Left);
					lastStart = Math.max(lastStart, this.win0Right);
					if (this.windows[0].enabled[layer.index]) {
						this.setBlendEnabled(layer, this.windows[0].special && this.target1[layer.index]);
						layer.drawScanline(backing, layer, this.win0Left, this.win0Right);
					}
				}
				if (this.windows[2].enabled[layer.index]) {
					// WINOUT
					this.setBlendEnabled(layer, this.windows[2].special && this.target1[layer.index]);
					layer.drawScanline(backing, layer, 0, firstEnd);
					// TODO: middle region
					layer.drawScanline(backing, layer, lastStart, this.HORIZONTAL_PIXELS);
				}
				// TODO: objwin
			}
		} else {
			layer.drawScanline(backing, this);
		}
	}
};

GameBoyAdvanceVideo.prototype.finishDraw = function() {
	this.context.putImageData(this.pixelData, 0, 0);
	this.drawCallback();
};
