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

	this.lastHblank = 0;
	this.nextHblank = this.HDRAW_LENGTH;
	this.nextEvent = this.nextHblank;
};

GameBoyAdvanceVideo.prototype.setCanvas = function(canvas) {
	this.canvas = canvas;
}

GameBoyAdvanceVideo.prototype.updateTimers = function(cpu) {
	var cycles = cpu.cycles;

	while (this.nextEvent <= cycles) {
		this.lastHblank = this.nextHblank;
		if (this.inHblank) {
			this.inHblank = false;
			this.nextEvent = this.nextHblank;
			++this.vcount;
			switch (this.vcount) {
			case this.VERTICAL_PIXELS:
				this.inVblank = true;
				if (this.vblankIRQ) {
					cpu.irq.raiseIRQ(cpu.irq.IRQ_VBLANK);
					return;
				}
				break;
			case this.VERTICAL_TOTAL_PIXELS - 1:
				this.inVblank = false;
				break;
			case this.VERTICAL_TOTAL_PIXELS:
				this.vcount = 0;
				break;
			}
		} else {
			this.inHblank = true;
			this.nextEvent = this.nextHblank + this.HBLANK_LENGTH;
			this.nextHblank = this.nextEvent + this.HDRAW_LENGTH;
			if (this.hblankIRQ) {
				cpu.irq.raiseIRQ(cpu.irq.IRQ_HBLANK);
				return;
			}
		}
	}
};

GameBoyAdvanceVideo.prototype.nextHblank = function() {
	if (this.inHblank) {
		return this.lastHblank + this.HORIZONTAL_LENGTH;
	} else {
		return this.lastHblank + this.HDRAW_LENGTH;
	}
};

GameBoyAdvanceVideo.prototype.nextVblank = function() {
	var remainingLines;
	if (this.inVblank) {
		remainingLines = this.VERTICAL_PIXELS * 2 + this.VBLANK_PIXELS - this.vcount;
	} else {
		remainingLines = this.VERTICAL_PIXELS - this.vcount;
	}
	return this.lastHblank + remainingLines * (this.HDRAW_LENGTH + this.HBLANK_LENGTH);
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
