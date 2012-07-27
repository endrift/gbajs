var GameBoyAdvancePalette = function() {
	this.LAYER_BG0 = 0;
	this.LAYER_BG1 = 1;
	this.LAYER_BG2 = 2;
	this.LAYER_BG3 = 3;
	this.LAYER_OBJ = 4;
	this.LAYER_BACKDROP = 5;

	this.rawPalette = [ new Uint16Array(0x100), new Uint16Array(0x100) ];
	this.colors = [ new Array(0x100), new Array(0x100) ];
	this.adjustedColors = [ new Array(0x100), new Array(0x100) ];
	this.passthroughColors = [
		this.colors[0], // BG0
		this.colors[1], // BG1
		this.colors[2], // BG2
		this.colors[3], // BG3
		this.colors[4], // OBJ
		this.colors[5] // Backdrop
	];

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

GameBoyAdvancePalette.prototype.store16 = function(offset, value) {
	var type = (offset & 0x200) >> 9;
	var index = (offset & 0x1FF) >> 1;
	this.rawPalette[type][index] = value;
	this.colors[type][index] = this.convert16To32(value);
	this.adjustedColors[type][index] = this.adjustColor(value);
};

GameBoyAdvancePalette.prototype.store32 = function(offset, value) {
	this.store16(offset, value & 0xFFFF);
	this.store16(offset + 2, value >> 16);
};

GameBoyAdvancePalette.prototype.convert16To32 = function(value) {
	var r = (value & 0x001F) << 3;
	var g = (value & 0x03E0) >> 2;
	var b = (value & 0x7C00) >> 7;
	return [ r, g, b ];
};

GameBoyAdvancePalette.prototype.makeDarkPalettes = function(layers) {
	this.adjustColor = this.adjustColorDark;
	this.resetPaletteLayers(layers);
	this.resetPalettes();
};

GameBoyAdvancePalette.prototype.makeBrightPalettes = function(layers) {
	this.adjustColor = this.adjustColorDark;
	this.resetPaletteLayers(layers);
	this.resetPalettes();
};

GameBoyAdvancePalette.prototype.makeNormalPalettes = function() {
	this.passthroughColors[0] = this.colors[0];
	this.passthroughColors[1] = this.colors[0];
	this.passthroughColors[2] = this.colors[0];
	this.passthroughColors[3] = this.colors[0];
	this.passthroughColors[4] = this.colors[1];
	this.passthroughColors[5] = this.colors[0];
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
		outPalette[i] = this.adjustColor(inPalette[i]);
	}

	outPalette = this.adjustedColors[1];
	inPalette = this.rawPalette[1];
	for (i = 0; i < 256; ++i) {
		outPalette[i] = this.adjustColor(inPalette[i]);
	}
}

GameBoyAdvancePalette.prototype.accessColor = function(layer, index) {
	return this.passthroughColors[layer][index];
};

GameBoyAdvancePalette.prototype.adjustColorDark = function(color) {
	var r = (color & 0x001F);
	var g = (color & 0x03E0) >> 5;
	var b = (color & 0x7C00) >> 10;

	r = r - (r * this.blendY);
	g = g - (g * this.blendY);
	b = b - (b * this.blendY);

	return [ r << 3, g << 3, b << 3 ];
};

GameBoyAdvancePalette.prototype.adjustColorBright = function(color) {
	var r = (color & 0x001F);
	var g = (color & 0x03E0) >> 5;
	var b = (color & 0x7C00) >> 10;

	r = r + ((31 - r) * this.blendY);
	g = g + ((31 - g) * this.blendY);
	b = b + ((31 - b) * this.blendY);

	return [ r << 3, g << 3, b << 3 ];
};

GameBoyAdvancePalette.prototype.adjustColor = GameBoyAdvancePalette.prototype.convert16To32;

GameBoyAdvancePalette.prototype.setBlendY = function(y) {
	this.blendY = y;
	this.resetPalettes();
};

var GameBoyAdvanceVideo = function() {
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
};

GameBoyAdvanceVideo.prototype.clear = function() {
	this.palette = new GameBoyAdvancePalette();

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

	// BLDCNT
	this.bg0Target1 = 0;
	this.bg1Target1 = 0;
	this.bg2Target1 = 0;
	this.bg3Target1 = 0;
	this.objTarget1 = 0;
	this.bdTarget1 = 0;
	this.bg0Target2 = 0;
	this.bg1Target2 = 0;
	this.bg2Target2 = 0;
	this.bg3Target2 = 0;
	this.objTarget2 = 0;
	this.bdTarget2 = 0;
	this.blendMode = 0;

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
			priority: 0,
			charBase: 0,
			mosaic: false,
			multipalette: false,
			screenBase: 0,
			overflow: 0,
			size: 0,
			x: 0,
			y: 0,
			dx: 0,
			dmx: 0,
			dy: 0,
			dmy: 0
		});
	}

	this.drawScanline = this.drawScanlineMode0;
};

GameBoyAdvanceVideo.prototype.setBacking = function(backing) {
	this.pixelData = backing.createImageData(this.HORIZONTAL_PIXELS, this.VERTICAL_PIXELS);
	this.context = backing;
}

GameBoyAdvanceVideo.prototype.updateTimers = function(cpu) {
	var cycles = cpu.cycles;

	if (this.nextEvent <= cycles) {
		if (this.inHblank) {
			// End Hblank
			this.inHblank = false;
			++this.vcount;
			switch (this.vcount) {
			case this.VERTICAL_PIXELS:
				this.inVblank = true;
				this.drawScanline(); // Draw final scanline
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
				this.vcount = 0;
				break;
			default:
				if (!this.inVblank) {
					this.drawScanline();
				}
				break;
			}
			this.nextEvent = this.nextHblank;
		} else {
			// Begin Hblank
			this.inHblank = true;
			this.lastHblank = this.nextHblank;
			this.nextEvent = this.lastHblank + this.HBLANK_LENGTH;
			this.nextHblank = this.nextEvent + this.HDRAW_LENGTH;
			this.nextHblankIRQ = this.nextHblank;
			this.cpu.mmu.runHblankDmas();
			if (this.hblankIRQ) {
				this.cpu.irq.raiseIRQ(this.cpu.irq.IRQ_HBLANK);
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

	if (this.forcedBlank) {
		this.drawScanline = this.drawScanlineBlank;
	} else {
		switch (this.backgroundMode) {
		case 0:
			this.drawScanline = this.drawScanlineMode0;
			break;
		default:
			break;
		}
	}
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
};

GameBoyAdvanceVideo.prototype.writeBackgroundHOffset = function(bg, value) {
	this.bg[bg].x = value & 0x1FF;
};

GameBoyAdvanceVideo.prototype.writeBackgroundVOffset = function(bg, value) {
	this.bg[bg].y = value & 0x1FF;
};

GameBoyAdvanceVideo.prototype.writeBlendControl = function(value) {
	this.bg0Target1 = value & 0x0001;
	this.bg1Target1 = value & 0x0002;
	this.bg2Target1 = value & 0x0004;
	this.bg3Target1 = value & 0x0008;
	this.objTarget1 = value & 0x0010;
	this.bdTarget1 = value & 0x0020;
	this.bg0Target2 = value & 0x0100;
	this.bg1Target2 = value & 0x0200;
	this.bg2Target2 = value & 0x0400;
	this.bg3Target2 = value & 0x0800;
	this.objTarget2 = value & 0x1000;
	this.bdTarget2 = value & 0x2000;
	this.blendMode = (value & 0x00C0) >> 6;

	switch (this.blendMode) {
	case 0:
		break;
	case 1:
		this.cpu.log('Unimplemented blending mode: alpha blending');
		break;
	case 2:
		this.palette.makeBrightPalettes(value & 0x3F);
		break;
	case 3:
		this.palette.makeDarkPalettes(value & 0x3F);
		break;
	}
};

GameBoyAdvanceVideo.prototype.writeBlendY = function(value) {
	this.blendY = value;
	this.palette.setBlendY(value >= 16 ? 1 : (value / 16));
};

GameBoyAdvanceVideo.prototype.accessMap = function(base, x, y) {
	var offset = base | ((x >> 2) & 0x3E) | ((y << 3) & 0x7C0);
	// TODO: precompute Y
	// TODO: calculate size > 1
	var mem = this.cpu.mmu.loadU16(offset);
	return {
		tile: mem & 0x03FF,
		hflip: mem & 0x0400,
		vflip: mem & 0x0800,
		palette: (mem & 0xF000) >> 12
	};
};

GameBoyAdvanceVideo.prototype.accessTile = function(base, map, y) {
	var offset = base | (map.tile << 5);
	if (!map.vflip) {
		offset |= y << 2;
	} else {
		offset |= (7 - y) << 2;
	}

	return this.cpu.mmu.load32(offset);
}

GameBoyAdvanceVideo.prototype.pullPixel = function(layer, map, row, x) {
	if (map.hflip) {
		x = 7 - x;
	}

	var pixel = (row >> (x << 2)) & 0xF;
	// TODO: 256-color mode
	return this.palette.accessColor(layer, (map.palette << 4) | pixel);
};

GameBoyAdvanceVideo.prototype.identity = function(x) {
	return x;
};

GameBoyAdvanceVideo.prototype.drawScanlineBlank = function() {
	var offset = (this.vcount - 1) * 4 * this.HORIZONTAL_PIXELS;
	for (var x = 0; x < this.HORIZONTAL_PIXELS; ++x) {
		this.pixelData.data[offset++] = 0xFF;
		this.pixelData.data[offset++] = 0xFF;
		this.pixelData.data[offset++] = 0xFF;
		this.pixelData.data[offset++] = 0xFF;
	}
};

GameBoyAdvanceVideo.prototype.drawScanlineBackdrop = function() {
	var offset = (this.vcount - 1) * 4 * this.HORIZONTAL_PIXELS;
	var bd = this.palette.accessColor(this.palette.LAYER_BACKDROP, 0);
	for (var x = 0; x < this.HORIZONTAL_PIXELS; ++x) {
		this.pixelData.data[offset++] = bd[0];
		this.pixelData.data[offset++] = bd[1];
		this.pixelData.data[offset++] = bd[2];
		offset++;
	}
};

GameBoyAdvanceVideo.prototype.drawScanlineMode0 = function() {
	var y = this.vcount - 1;
	var x;
	var localX;
	var localY;
	var xOff;
	var yOff;
	var bg;
	var map;
	var charBase;
	var screenBase;
	var pixel;
	var tileRow;

	this.drawScanlineBackdrop();
	if (this.bg3) {
		offset = y * 4 * this.HORIZONTAL_PIXELS;
		bg = this.bg[3];
		xOff = bg.x;
		yOff = bg.y;
		localY = y + yOff;
		screenBase = 0x06000000 | bg.screenBase;
		charBase = 0x06000000 | bg.charBase;
		map = this.accessMap(screenBase, xOff, localY);
		tileRow = this.accessTile(charBase, map, localY & 0x7);
		for (x = 0; x < this.HORIZONTAL_PIXELS; ++x) {
			localX = x + xOff;
			if (!(localX & 0x7)) {
				map = this.accessMap(screenBase, localX, localY);
				tileRow = this.accessTile(charBase, map, localY & 0x7);
			}
			pixel = this.pullPixel(3, map, tileRow, localX & 0x7);
			this.pixelData.data[offset++] = pixel[0];
			this.pixelData.data[offset++] = pixel[1];
			this.pixelData.data[offset++] = pixel[2];
			offset++;
		}
	}
};

GameBoyAdvanceVideo.prototype.finishDraw = function() {
	this.context.putImageData(this.pixelData, 0, 0);
};
