GameBoyAdvanceIO = function() {
	// Video
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

	// DMA
	this.DMA0SAD_LO = 0x0B0;
	this.DMA0SAD_HI = 0x0B2;
	this.DMA0DAD_LO = 0x0B4;
	this.DMA0DAD_HI = 0x0B6;
	this.DMA0CNT_LO = 0x0B8;
	this.DMA0CNT_HI = 0x0BA;
	this.DMA1SAD_LO = 0x0BC;
	this.DMA1SAD_HI = 0x0BE;
	this.DMA1DAD_LO = 0x0C0;
	this.DMA1DAD_HI = 0x0C2;
	this.DMA1CNT_LO = 0x0C4;
	this.DMA1CNT_HI = 0x0C6;
	this.DMA2SAD_LO = 0x0C8;
	this.DMA2SAD_HI = 0x0CA;
	this.DMA2DAD_LO = 0x0CC;
	this.DMA2DAD_HI = 0x0CE;
	this.DMA2CNT_LO = 0x0D0;
	this.DMA2CNT_HI = 0x0D2;
	this.DMA3SAD_LO = 0x0D4;
	this.DMA3SAD_HI = 0x0D6;
	this.DMA3DAD_LO = 0x0D8;
	this.DMA3DAD_HI = 0x0DA;
	this.DMA3CNT_LO = 0x0DC;
	this.DMA3CNT_HI = 0x0DE;

	// Interrupts, etc
	this.IME = 0x208;
};

GameBoyAdvanceIO.prototype.setCPU = function(cpu) {
	this.cpu = cpu;
};

GameBoyAdvanceIO.prototype.setVideo = function(video) {
	this.video = video;
};

GameBoyAdvanceIO.prototype.clear = function() {
	this.registers = new Uint32Array(this.cpu.mmu.SIZE_IO);
};

GameBoyAdvanceIO.prototype.load8 = function(offset) {
	throw "Unimplmeneted unaligned I/O access";
}

GameBoyAdvanceIO.prototype.load16 = function(offset) {
	return this.loadU16(offset) >> 0;
}

GameBoyAdvanceIO.prototype.load32 = function(offset) {
	switch (offset) {
	case this.DMA0CNT_LO:
	case this.DMA1CNT_LO:
	case this.DMA2CNT_LO:
	case this.DMA3CNT_LO:
		return this.loadU16(offset | 2);
	}

	return this.loadU16(offset) | (this.loadU16(offset | 2) << 16);
};

GameBoyAdvanceIO.prototype.loadU8 = function(offset) {
	throw "Unimplmeneted unaligned I/O access";
}

GameBoyAdvanceIO.prototype.loadU16 = function(offset) {
	switch (offset) {
	case this.DISPCNT:
	case this.IME:
		// Handled transparently by the written registers
		break;
	case this.DISPSTAT:
		return this.registers[offset >> 1] | this.video.readDisplayStat();
	case this.DMA0CNT_HI:
	case this.DMA1CNT_HI:
	case this.DMA2CNT_HI:
	case this.DMA3CNT_HI:
		break; // FIXME: DMAs will disable themselves, we need to read that out
	default:
		throw "Unimplemented I/O register read: 0x" + offset.toString(16);
	}
	return this.registers[offset >> 1];
};

GameBoyAdvanceIO.prototype.store16 = function(offset, value) {
	switch (offset) {
	case this.DISPCNT:
		this.video.writeDisplayControl(value);
		break;
	case this.DISPSTAT:
		value &= this.video.DISPSTAT_MASK;
		this.video.writeDisplayStat(value);
		break;
	case this.DMA0CNT_LO:
		this.cpu.irq.dmaSetWordCount(0, value);
		return;
	case this.DMA0CNT_HI:
		this.cpu.irq.dmaWriteControl(0, value);
		break;
	case this.DMA1CNT_LO:
		this.cpu.irq.dmaSetWordCount(1, value);
		return;
	case this.DMA1CNT_HI:
		this.cpu.irq.dmaWriteControl(1, value);
		break;
	case this.DMA2CNT_LO:
		this.cpu.irq.dmaSetWordCount(2, value);
		return;
	case this.DMA2CNT_HI:
		this.cpu.irq.dmaWriteControl(2, value);
		break;
	case this.DMA3CNT_LO:
		this.cpu.irq.dmaSetWordCount(3, value);
		return;
	case this.DMA3CNT_HI:
		this.cpu.irq.dmaWriteControl(3, value);
		break;
	case this.IME:
		value &= 0x0001;
		this.cpu.irq.masterEnable(value);
		break;
	default:
		throw "Unimplemented I/O register write: 0x" + offset.toString(16);
	}
	this.registers[offset >> 1] = value;
};

GameBoyAdvanceIO.prototype.store32 = function(offset, value) {
	switch (offset) {
	case this.DMA0SAD_LO:
		this.cpu.irq.dmaSetSourceAddress(0, value);
		return;
	case this.DMA0DAD_LO:
		this.cpu.irq.dmaSetDestAddress(0, value);
		return;
	case this.DMA1SAD_LO:
		this.cpu.irq.dmaSetSourceAddress(1, value);
		return;
	case this.DMA1DAD_LO:
		this.cpu.irq.dmaSetDestAddress(1, value);
		return;
	case this.DMA2SAD_LO:
		this.cpu.irq.dmaSetSourceAddress(2, value);
		return;
	case this.DMA2DAD_LO:
		this.cpu.irq.dmaSetDestAddress(2, value);
		return;
	case this.DMA3SAD_LO:
		this.cpu.irq.dmaSetSourceAddress(3, value);
		return;
	case this.DMA3DAD_LO:
		this.cpu.irq.dmaSetDestAddress(3, value);
		return;
	}

	this.store16(offset, value & 0xFFFF);
	this.store16(offset + 2, value >> 16);
};
