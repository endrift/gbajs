GameBoyAdvanceIO = function() {
	this.DISPCNT = 0x000;
	this.GREENSWP = 0x002;
	this.DISPSTAT = 0x004;
	this.VCOUNT = 0x006;
	this.BG0CNT = 0x008;
	this.BG1CNT = 0x00A;
	this.BG2CNT = 0x00C;
	this.BG3CNT = 0x00E;
	this.BG0HOFS = 0x010;
	this.BG0VOFS = 0x012;
	this.BG1HOFS = 0x014;
	this.BG1VOFS = 0x016;
	this.BG2HOFS = 0x018;
	this.BG2VOFS = 0x01A;
	this.BG3HOFS = 0x01C;
	this.BG3VOFS = 0x01E;
	this.BG2PA = 0x020;
	this.BG2PB = 0x022;
	this.BG2PC = 0x024;
	this.BG2PD = 0x026;
	this.BG2X_LO = 0x028;
	this.BG2X_HI = 0x02E;
	this.BG2Y_LO = 0x02C;
	this.BG2Y_HI = 0x02E;
	this.BG3PA = 0x030;
	this.BG3PB = 0x032;
	this.BG3PC = 0x034;
	this.BG3PD = 0x036;
	this.BG3X_LO = 0x038;
	this.BG3X_HI = 0x03A;
	this.BG3Y_LO = 0x03C;
	this.BG3Y_HI = 0x03E;
	this.WIN0H = 0x040;
	this.WIN1H = 0x042;
	this.WIN0V = 0x044;
	this.WIN1V = 0x046;
	this.WININ = 0x048;
	this.WINOUT = 0x04A;
	this.MOSAIC = 0x04C;
	this.BLDCNT = 0x050;
	this.BLDALPHA = 0x052;
	this.BLDY = 0x054;
};

GameBoyAdvanceIO.prototype.setMMU = function(mmu) {
	this.mmu = mmu;
};

GameBoyAdvanceIO.prototype.setVideo = function(video) {
	this.video = video;
};

GameBoyAdvanceIO.prototype.clear = function() {
	this.registers = new Uint32Array(this.mmu.SIZE_IO);
};

GameBoyAdvanceIO.prototype.load8 = function(offset) {
	throw "Unimplmeneted unaligned I/O access";
}

GameBoyAdvanceIO.prototype.load16 = function(offset) {
	return this.loadU16(offset) >> 0;
}

GameBoyAdvanceIO.prototype.load32 = function(offset) {
	return this.loadU16(offset) | (this.loadU16(offset + 2) << 16);
};

GameBoyAdvanceIO.prototype.loadU8 = function(offset) {
	throw "Unimplmeneted unaligned I/O access";
}

GameBoyAdvanceIO.prototype.loadU16 = function(offset) {
	switch (offset) {
	default:
	}
	return this.registers[offset >> 1];
};

GameBoyAdvanceIO.prototype.store16 = function(offset, value) {
	switch (offset) {
	default:
	}
	this.registers[offset >> 1] = value;
};

GameBoyAdvanceIO.prototype.store32 = function(offset, value) {
	this.store16(offset, value & 0xFFFF);
	this.store16(offset + 2, value >> 16);
};
