GameBoyAdvanceVideo = function() {
	this.CYCLES_PER_PIXEL = 4;

	this.HORIZONTAL_PIXELS = 240;
	this.HBLANK_PIXELS = 68;
	this.HDRAW_LENGTH = 1006;
	this.HBLANK_LENGTH = 228;
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
	this.DISPSTAT_MASK = 0xFF380;
	this.vblanking = 0;
	this.hblanking = 0;
	this.vcounter = 0;
	this.vblankIRQ = 0;
	this.hblankIRQ = 0;
	this.vcounterIRQ = 0;
	this.vcountSetting = 0;

	// VCOUNT
	this.vcount = 0;

	this.lastHInterval = 0;
	this.inHblank = false;
	this.inVblank = false;
};

GameBoyAdvanceVideo.prototype.setCanvas = function(canvas) {
	this.canvas = canvas;
}

GameBoyAdvanceVideo.prototype.updateTimers = function(cpu) {
	var cycles = cpu.cycles;
	if (this.inHblank) {
		if (cycles - this.lastHInterval > this.HBLANK_LENGTH) {
			this.lastHInterval += this.HBLANK_LENGTH;
			this.inHblank = false;
			++this.vcount;
		}
	} else {
		if (cycles - this.lastHInterval > this.HDRAW_LENGTH) {
			this.lastHInterval += this.HDRAW_LENGTH;
			this.inHblank = true;
		}
	}
	if (this.inVblank) {
		if (this.vcount == this.VERTICAL_PIXELS + this.VBLANK_PIXELS) {
			this.vcount = 0;
			this.inVblank = false;
		}
	} else {
		if (this.vcount == this.VERTICAL_PIXELS) {
			this.inVblank = true;
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
	this.win0 = 0x2000;
	this.win1 = 0x4000;
	this.objwin = 0x8000;
};

GameBoyAdvanceVideo.prototype.writeDisplayStat = function(value) {
	this.vblankIRQ = value & 0x0080;
	this.hblankIRQ = value & 0x0100;
	this.vcounterIRQ = value & 0x0200;
	this.vcounterSetting = (value & 0xFF00) >> 8;
};

GameBoyAdvanceVideo.prototype.readDisplayStat = function() {
	return (this.vblanking) | (this.hblanking << 1) | (this.vcounter << 2);
};
