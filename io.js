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

	// Sound
	this.SOUND1CNT_LO = 0x060;
	this.SOUND1CNT_HI = 0x062;
	this.SOUND1CNT_X = 0x064;
	this.SOUND2CNT_LO = 0x068;
	this.SOUND2CNT_HI = 0x06C;
	this.SOUND3CNT_LO = 0x070;
	this.SOUND3CNT_HI = 0x072;
	this.SOUND3CNT_X = 0x074;
	this.SOUND4CNT_LO = 0x078;
	this.SOUND4CNT_HI = 0x07C;
	this.SOUNDCNT_LO = 0x080;
	this.SOUNDCNT_HI = 0x082;
	this.SOUNDCNT_X = 0x084;
	this.SOUNDBIAS = 0x088;
	this.FIFO_A_LO = 0x0A0;
	this.FIFO_A_HI = 0x0A2;
	this.FIFO_B_LO = 0x0A4;
	this.FIFO_B_HI = 0x0A6;

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

	// Timers
	this.TM0CNT_LO = 0x100;
	this.TM0CNT_HI = 0x102;
	this.TM1CNT_LO = 0x104;
	this.TM1CNT_HI = 0x106;
	this.TM2CNT_LO = 0x108;
	this.TM2CNT_HI = 0x10A;
	this.TM3CNT_LO = 0x10C;
	this.TM3CNT_HI = 0x10E;

	// Keypad
	this.KEYINPUT = 0x130;
	this.KEYCNT = 0x132;

	// Interrupts, etc
	this.IE = 0x200;
	this.IF = 0x202;
	this.WAITCNT = 0x204;
	this.IME = 0x208;

	this.DEFAULT_SOUNDBIAS = 0x200;
};

GameBoyAdvanceIO.prototype.setCPU = function(cpu) {
	this.cpu = cpu;
};

GameBoyAdvanceIO.prototype.setVideo = function(video) {
	this.video = video;
};

GameBoyAdvanceIO.prototype.clear = function() {
	this.registers = new Uint16Array(this.cpu.mmu.SIZE_IO);

	this.registers[this.SOUNDBIAS >> 1] = this.DEFAULT_SOUNDBIAS;
};

GameBoyAdvanceIO.prototype.load8 = function(offset) {
	throw 'Unimplmeneted unaligned I/O access';
}

GameBoyAdvanceIO.prototype.load16 = function(offset) {
	return (this.loadU16(offset) << 16) >> 16;
}

GameBoyAdvanceIO.prototype.load32 = function(offset) {
	switch (offset) {
	case this.DMA0CNT_LO:
	case this.DMA1CNT_LO:
	case this.DMA2CNT_LO:
	case this.DMA3CNT_LO:
		return this.loadU16(offset | 2) << 16;
	}

	return this.loadU16(offset) | (this.loadU16(offset | 2) << 16);
};

GameBoyAdvanceIO.prototype.forceLoadU8 = function(offset) {
	try {
		return this.loadU8(offset) 
	} catch (exception) {
		var odd = offset & 0x0001;
		var value = this.registers[offset >> 1];
		return (value >>> (odd << 3)) & 0xFF;
	}
}

GameBoyAdvanceIO.prototype.loadU8 = function(offset) {
	var odd = offset & 0x0001;
	var value = this.loadU16(offset & 0xFFFE);
	return (value >>> (odd << 3)) & 0xFF;
}

GameBoyAdvanceIO.prototype.loadU16 = function(offset) {
	switch (offset) {
	case this.DISPCNT:
	case this.SOUNDCNT_HI:
	case this.SOUNDBIAS:
	case this.DMA0CNT_HI:
	case this.DMA1CNT_HI:
	case this.DMA2CNT_HI:
	case this.DMA3CNT_HI:
	case this.KEYINPUT:
	case this.WAITCNT:
	case this.IE:
	case this.IF:
	case this.IME:
		// Handled transparently by the written registers
		break;
	case this.DISPSTAT:
		return this.registers[offset >> 1] | this.video.readDisplayStat();
	case this.VCOUNT:
		return this.video.vcount;
	default:
		throw 'Unimplemented I/O register read: 0x' + offset.toString(16);
	}
	return this.registers[offset >> 1];
};

GameBoyAdvanceIO.prototype.store8 = function(offset, value) {
	switch (offset) {
	case this.SOUND1CNT_HI | 1:
	case this.SOUND2CNT_LO | 1:
	case this.SOUND3CNT_HI:
	case this.SOUND4CNT_LO | 1:
		this.cpu.log('Unimplemented sound register write: 0x' + offset.toString(16));
		break;
	case this.SOUND1CNT_X | 1:
	case this.SOUND2CNT_HI | 1:
		value &= 0xC7;
		this.cpu.log('Unimplemented sound register write: 0x' + offset.toString(16));
		break;
	case this.SOUND1CNT_LO:
		value &= 0x7F;
		this.cpu.log('Unimplemented sound register write: 0x' + offset.toString(16));
		break;
	case this.SOUND3CNT_LO:
	case this.SOUND3CNT_HI | 1:
		value &= 0xE0;
		this.cpu.log('Unimplemented sound register write: 0x' + offset.toString(16));
		break;
	case this.SOUND4CNT_HI | 1:
		value &= 0xC0;
		this.cpu.log('Unimplemented sound register write: 0x' + offset.toString(16));
		break;
	case this.SOUNDCNT_LO:
		value &= 0x77;
		this.cpu.log('Unimplemented sound register write: 0x' + offset.toString(16));
		break;
	case this.SOUNDCNT_X:
		value &= 0x80;
		this.cpu.log('Unimplemented sound register write: 0x' + offset.toString(16));
		break;
	case this.SOUNDBIAS | 1:
		value &= 0xC3;
		this.cpu.log('Unimplemented sound register write: 0x' + offset.toString(16));
		break;
	default:
		throw 'Unimplemented 8-bit I/O register write: 0x' + offset.toString(16);
	}

	if (offset & 1) {
		value <<= 8;
		value |= (this.registers[offset >> 1] & 0x00FF);
	}
	this.registers[offset >> 1] = value;
};

GameBoyAdvanceIO.prototype.store16 = function(offset, value) {
	switch (offset) {
	// Video
	case this.DISPCNT:
		this.video.writeDisplayControl(value);
		break;
	case this.DISPSTAT:
		value &= this.video.DISPSTAT_MASK;
		this.video.writeDisplayStat(value);
		break;
	case this.BLDCNT:
		value &= 0x4FFF;
		this.cpu.log('Unimplemented video register write: 0x' + offset.toString(16));
		break;
	case this.BLDALPHA:
		value &= 0x1F1F;
		this.cpu.log('Unimplemented video register write: 0x' + offset.toString(16));
		break;
	case this.BLDY:
		value &= 0x001F;
		this.cpu.log('Unimplemented video register write: 0x' + offset.toString(16));
		break;

	// Sound
	// TODO: implement sound
	case this.SOUND1CNT_LO:
		value &= 0x007F;
	case this.SOUND1CNT_HI:
	case this.SOUND2CNT_LO:
		this.cpu.log('Unimplemented sound register write: 0x' + offset.toString(16));
		break;
	case this.SOUND1CNT_X:
	case this.SOUND2CNT_HI:
		value &= 0xC7FF;
		this.cpu.log('Unimplemented sound register write: 0x' + offset.toString(16));
		break;
	case this.SOUND3CNT_LO:
		value &= 0x00E0;
		this.cpu.log('Unimplemented sound register write: 0x' + offset.toString(16));
		break;
	case this.SOUND3CNT_HI:
		value &= 0xE0FF;
		this.cpu.log('Unimplemented sound register write: 0x' + offset.toString(16));
		break;
	case this.SOUND3CNT_X:
		value &= 0xC7FF;
		this.cpu.log('Unimplemented sound register write: 0x' + offset.toString(16));
		break;
	case this.SOUND4CNT_LO:
		value &= 0xFF3F;
		this.cpu.log('Unimplemented sound register write: 0x' + offset.toString(16));
		break;
	case this.SOUND4CNT_HI:
		value &= 0xE0FF;
		this.cpu.log('Unimplemented sound register write: 0x' + offset.toString(16));
		break;
	case this.SOUNDCNT_LO:
		value &= 0xFF77;
		this.cpu.log('Unimplemented sound register write: 0x' + offset.toString(16));
		break;
	case this.SOUNDCNT_HI:
		value &= 0xFF0F;
		this.cpu.log('Unimplemented sound register write: 0x' + offset.toString(16));
		break;
	case this.SOUNDCNT_X:
		value &= 0x0080;
		this.cpu.log('Unimplemented sound register write: 0x' + offset.toString(16));
		break;

	// DMA
	case this.DMA0CNT_LO:
		this.cpu.irq.dmaSetWordCount(0, value);
		break;
	case this.DMA0CNT_HI:
		// The DMA registers need to set the values before writing the control, as writing the
		// control can synchronously trigger a DMA transfer
		this.registers[offset >> 1] = value & 0xFFE0;
		this.cpu.irq.dmaWriteControl(0, value);
		return;
	case this.DMA1CNT_LO:
		this.cpu.irq.dmaSetWordCount(1, value);
		break;
	case this.DMA1CNT_HI:
		this.registers[offset >> 1] = value & 0xFFE0;
		this.cpu.irq.dmaWriteControl(1, value);
		return;
	case this.DMA2CNT_LO:
		this.cpu.irq.dmaSetWordCount(2, value);
		break;
	case this.DMA2CNT_HI:
		this.registers[offset >> 1] = value & 0xFFE0;
		this.cpu.irq.dmaWriteControl(2, value);
		return;
	case this.DMA3CNT_LO:
		this.cpu.irq.dmaSetWordCount(3, value);
		break;
	case this.DMA3CNT_HI:
		this.registers[offset >> 1] = value & 0xFFE0;
		this.cpu.irq.dmaWriteControl(3, value);
		return;

	// Timers
	case this.TM0CNT_LO:
		this.cpu.irq.timerSetReload(0, value);
		return;
	case this.TM1CNT_LO:
		this.cpu.irq.timerSetReload(1, value);
		return;
	case this.TM2CNT_LO:
		this.cpu.irq.timerSetReload(2, value);
		return;
	case this.TM3CNT_LO:
		this.cpu.irq.timerSetReload(3, value);
		return;

	case this.TM0CNT_HI:
		value &= 0x00C7
		this.cpu.irq.timerWriteControl(0, value);
		break;
	case this.TM1CNT_HI:
		value &= 0x00C7
		this.cpu.irq.timerWriteControl(1, value);
		break;
	case this.TM2CNT_HI:
		value &= 0x00C7
		this.cpu.irq.timerWriteControl(2, value);
		break;
	case this.TM3CNT_HI:
		value &= 0x00C7
		this.cpu.irq.timerWriteControl(3, value);
		break;

	// Misc
	case this.IE:
		value &= 0x3FFF;
		this.cpu.irq.setInterruptsEnabled(value);
		return;
	case this.IF:
		this.cpu.irq.dismissIRQs(value);
		return;
	case this.WAITCNT:
		value &= 0xDFFF;
		this.cpu.mmu.adjustTimings(value);
		break;
	case this.IME:
		value &= 0x0001;
		this.cpu.irq.masterEnable(value);
		break;
	default:
		throw 'Unimplemented I/O register write: 0x' + offset.toString(16);
	}
	this.registers[offset >> 1] = value;
};

GameBoyAdvanceIO.prototype.store32 = function(offset, value) {
	switch (offset) {
	case this.DMA0SAD_LO:
		this.cpu.irq.dmaSetSourceAddress(0, value);
		break;
	case this.DMA0DAD_LO:
		this.cpu.irq.dmaSetDestAddress(0, value);
		break;
	case this.DMA1SAD_LO:
		this.cpu.irq.dmaSetSourceAddress(1, value);
		break;
	case this.DMA1DAD_LO:
		this.cpu.irq.dmaSetDestAddress(1, value);
		break;
	case this.DMA2SAD_LO:
		this.cpu.irq.dmaSetSourceAddress(2, value);
		break;
	case this.DMA2DAD_LO:
		this.cpu.irq.dmaSetDestAddress(2, value);
		break;
	case this.DMA3SAD_LO:
		this.cpu.irq.dmaSetSourceAddress(3, value);
		break;
	case this.DMA3DAD_LO:
		this.cpu.irq.dmaSetDestAddress(3, value);
		break;
	default:
		this.store16(offset, value & 0xFFFF);
		this.store16(offset | 2, value >>> 16);
		return;
	}

	this.registers[offset >> 1] = value & 0xFFFF;
	this.registers[(offset >> 1) + 1] = value >>> 16;
};
