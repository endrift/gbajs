"use strict";

var GameBoyAdvanceVideo = function() {
	this.CYCLES_PER_PIXEL = 4;

	this.HORIZONTAL_PIXELS = 240;
	this.HBLANK_PIXELS = 68;
	this.HDRAW_LENGTH = 1006;
	this.HBLANK_LENGTH = 226;
	this.VERTICAL_PIXELS = 160;
	this.VBLANK_PIXELS = 68;

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

	this.lastHInterval = 0;
	this.nextHInterval = 0;
};

GameBoyAdvanceVideo.prototype.setCanvas = function(canvas) {
	this.canvas = canvas;
}

GameBoyAdvanceVideo.prototype.updateTimers = function(cpu) {
	var cycles = cpu.cycles;
	if (cycles < this.nextHInterval) {
		return;
	}
	var cycling = false;
	this.lastHInterval = this.nextHInterval;
	if (this.inHblank) {
		this.nextHInterval = this.lastHInterval + this.HDRAW_LENGTH;
		this.inHblank = false;
		++this.vcount;
		if (this.vcount === this.VERTICAL_PIXELS + this.VBLANK_PIXELS) {
			this.vcount = 0;
		}
		cycling = true;
	} else {
		this.nextHInterval = this.lastHInterval + this.HBLANK_LENGTH;
		this.inHblank = true;
		if (this.hblankIRQ) {
			cpu.irq.raiseIRQ(cpu.irq.IRQ_HBLANK);
		}
		cycling = true;
	}
	if (this.inVblank) {
		if (this.vcount === this.VERTICAL_PIXELS + this.VBLANK_PIXELS - 1) {
			this.inVblank = false;
		}
	} else if (this.vcount === this.VERTICAL_PIXELS) {
		this.inVblank = true;
		if (this.vblankIRQ) {
			cpu.irq.raiseIRQ(cpu.irq.IRQ_VBLANK);
		}
	}
	if (cycling) {
		this.updateTimers(cpu);
	}
};

GameBoyAdvanceVideo.prototype.nextHblank = function() {
	if (this.inHblank) {
		return this.lastHInterval + this.HBLANK_LENGTH + this.HDRAW_LENGTH;
	} else {
		return this.lastHInterval + this.HDRAW_LENGTH;
	}
};

GameBoyAdvanceVideo.prototype.nextVblank = function() {
	var remainingLines;
	if (this.inVblank) {
		remainingLines = this.VERTICAL_PIXELS * 2 + this.VBLANK_PIXELS - this.vcount;
	} else {
		remainingLines = this.VERTICAL_PIXELS - this.vcount;
	}
	return this.lastHInterval + remainingLines * (this.HDRAW_LENGTH + this.HBLANK_LENGTH);
};

GameBoyAdvanceVideo.prototype.nextVcounter = function() {
	var remainingLines;
	if (this.vcount > this.vcountSetting) {
		remainingLines = this.vcountSetting + this.VERTICAL_PIXELS + this.VBLANK_PIXELS - this.vcount;
	} else {
		remainingLines = this.vcountSetting - this.vcount;
	}
	return this.lastHInterval + remainingLines * (this.HDRAW_LENGTH + this.HBLANK_LENGTH);
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
