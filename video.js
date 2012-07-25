var GameBoyAdvancePalette = function() {
	this.palette = [ new Uint16Array(0x100), new Uint16Array(0x100) ];
};

GameBoyAdvancePalette.prototype.loadU8 = function(offset) {
	return (this.loadU16(offset) >> (8 * (offset & 1))) & 0xFF;
};

GameBoyAdvancePalette.prototype.loadU16 = function(offset) {
	return this.palette[(offset & 0x200) >> 9][(offset & 0x1FF) >> 1];
};

GameBoyAdvancePalette.prototype.load16 = function(offset) {
	return (this.loadU16(offset) << 16) >> 16;
};

GameBoyAdvancePalette.prototype.store16 = function(offset, value) {
	this.palette[(offset & 0x200) >> 9][(offset & 0x1FF) >> 1] = value;
};

GameBoyAdvancePalette.prototype.store32 = function(offset, value) {
	this.store16(offset, value & 0xFFFF);
	this.store16(offset + 2, value >> 16);
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

	this.lastHblank = 0;
	this.nextHblank = this.HDRAW_LENGTH;
	this.nextEvent = this.nextHblank;

	this.nextHblankIRQ = 0;
	this.nextVblankIRQ = 0;
	this.nextVcounterIRQ = 0;
};

GameBoyAdvanceVideo.prototype.setCanvas = function(canvas) {
	this.canvas = canvas;
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
	this.cpu.log('Unimplemented video register write: BG' + bg + 'CNT');
};

GameBoyAdvanceVideo.prototype.writeBackgroundHOffset = function(bg, value) {
	this.cpu.log('Unimplemented video register write: BG' + bg + 'HOFS');
};

GameBoyAdvanceVideo.prototype.writeBackgroundVOffset = function(bg, value) {
	this.cpu.log('Unimplemented video register write: BG' + bg + 'VOFS');
};
