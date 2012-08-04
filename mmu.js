function MemoryView(memory, offset) {
	this.buffer = memory;
	this.view = new DataView(this.buffer, !!offset);
};

MemoryView.prototype.load8 = function(offset) {
	return this.view.getInt8(offset);
};

MemoryView.prototype.load16 = function(offset) {
	return this.view.getInt16(offset, true);
};

MemoryView.prototype.loadU8 = function(offset) {
	return this.view.getUint8(offset);
};

MemoryView.prototype.loadU16 = function(offset) {
	return this.view.getUint16(offset, true);
};

MemoryView.prototype.load32 = function(offset) {
	return this.view.getInt32(offset, true);
};

MemoryView.prototype.store8 = function(offset, value) {
	this.view.setInt8(offset, value);
};

MemoryView.prototype.store16 = function(offset, value) {
	this.view.setInt16(offset, value, true);
};

MemoryView.prototype.store32 = function(offset, value) {
	this.view.setInt32(offset, value, true);
};

function MemoryBlock(size) {
	MemoryView.call(this, new ArrayBuffer(size));
};

MemoryBlock.prototype = Object.create(MemoryView.prototype);

var ROMView = function(rom, offset) {
	MemoryView.call(this, rom, offset);
};

ROMView.prototype = Object.create(MemoryView.prototype);

ROMView.prototype.store8 = function(offset, value) {};

ROMView.prototype.store16 = function(offset, value) {};

ROMView.prototype.store32 = function(offset, value) {};

function BIOSView(rom, offset) {
	MemoryView.call(this, rom, offset);
};

BIOSView.prototype = Object.create(ROMView.prototype);

BIOSView.prototype.load8 = function(offset) {
	if (offset >= this.buffer.byteLength) {
		return -1;
	}
	return this.view.getInt8(offset);
};

BIOSView.prototype.load16 = function(offset) {
	if (offset >= this.buffer.byteLength) {
		return -1;
	}
	return this.view.getInt16(offset, true);
};

BIOSView.prototype.loadU8 = function(offset) {
	if (offset >= this.buffer.byteLength) {
		return -1;
	}
	return this.view.getUint8(offset);
};

BIOSView.prototype.loadU16 = function(offset) {
	if (offset >= this.buffer.byteLength) {
		return -1;
	}
	return this.view.getUint16(offset, true);
};

BIOSView.prototype.load32 = function(offset) {
	if (offset >= this.buffer.byteLength) {
		return -1;
	}
	return this.view.getInt32(offset, true);
};

function DummyMemory() {
};

DummyMemory.prototype.load8 = function(offset) {};

DummyMemory.prototype.load16 = function(offset) {};

DummyMemory.prototype.loadU8 = function(offset) {};

DummyMemory.prototype.loadU16 = function(offset) {};

DummyMemory.prototype.load32 = function(offset) {};

DummyMemory.prototype.store8 = function(offset, value) {};

DummyMemory.prototype.store16 = function(offset, value) {};

DummyMemory.prototype.store32 = function(offset, value) {};

function GameBoyAdvanceMMU() {
	this.REGION_BIOS = 0x0;
	this.REGION_WORKING_RAM = 0x2;
	this.REGION_WORKING_IRAM = 0x3;
	this.REGION_IO = 0x4;
	this.REGION_PALETTE_RAM = 0x5;
	this.REGION_VRAM = 0x6;
	this.REGION_OAM = 0x7;
	this.REGION_CART0 = 0x8;
	this.REGION_CART1 = 0xA;
	this.REGION_CART2 = 0xC;
	this.REGION_CART_SRAM = 0xE;

	this.BASE_BIOS = 0x00000000;
	this.BASE_WORKING_RAM = 0x02000000;
	this.BASE_WORKING_IRAM = 0x03000000;
	this.BASE_IO = 0x04000000;
	this.BASE_PALETTE_RAM = 0x05000000;
	this.BASE_VRAM = 0x06000000;
	this.BASE_OAM = 0x07000000;
	this.BASE_CART0 = 0x08000000;
	this.BASE_CART1 = 0x0A000000;
	this.BASE_CART2 = 0x0C000000;
	this.BASE_CART_SRAM = 0x0E000000;

	this.BASE_MASK = 0x0F000000;
	this.BASE_OFFSET = 24;
	this.OFFSET_MASK = 0x00FFFFFF;

	this.SIZE_BIOS = 0x00004000;
	this.SIZE_WORKING_RAM = 0x00040000;
	this.SIZE_WORKING_IRAM = 0x00008000;
	this.SIZE_IO = 0x00000400;
	this.SIZE_PALETTE_RAM = 0x00000400;
	this.SIZE_VRAM = 0x00018000;
	this.SIZE_OAM = 0x00000400;
	this.SIZE_CART0 = 0x02000000;
	this.SIZE_CART1 = 0x02000000;
	this.SIZE_CART2 = 0x02000000;
	this.SIZE_CART_SRAM = 0x00010000;

	this.DMA_TIMING_NOW = 0;
	this.DMA_TIMING_VBLANK = 1;
	this.DMA_TIMING_HBLANK = 2;
	this.DMA_TIMING_CUSTOM = 3;

	this.DMA_INCREMENT = 0;
	this.DMA_DECREMENT = 1;
	this.DMA_FIXED = 2;
	this.DMA_INCREMENT_RELOAD = 3;

	this.DMA_OFFSET = [ 1, -1, 0, 1 ];

	this.WAITSTATES = [ 0, 0, 2, 0, 0, 0, 0, 0, 4, 0, 4, 0, 4, 0, 4 ];
	this.WAITSTATES_32 = [ 0, 0, 5, 0, 0, 1, 0, 1, 7, 0, 9, 0, 13, 0, 8 ];
	this.WAITSTATES_SEQ = [ 0, 0, 2, 0, 0, 0, 0, 0, 2, 0, 4, 0, 8, 0, 4 ];
	this.WAITSTATES_SEQ_32 = [ 0, 0, 5, 0, 0, 1, 0, 1, 5, 0, 9, 0, 17, 0, 8 ];
	this.NULLWAIT = [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ];

	this.ROM_WS = [ 4, 3, 2, 8 ];
	this.ROM_WS_SEQ = [
		[ 2, 1 ],
		[ 4, 1 ],
		[ 8, 1 ]
	];

	this.ICACHE_PAGE_BITS = 10;
	this.PAGE_MASK = (2 << this.ICACHE_PAGE_BITS) - 1;
};

GameBoyAdvanceMMU.prototype.mmap = function(region, object) {
	this.memory[region] = object;
}

GameBoyAdvanceMMU.prototype.clear = function() {
	this.memory = [
		null,
		null, // Unused
		new MemoryBlock(this.SIZE_WORKING_RAM),
		new MemoryBlock(this.SIZE_WORKING_IRAM),
		null, // This is owned by GameBoyAdvanceIO
		null, // This is owned by GameBoyAdvancePalette
		null, // This is owned by GameBoyAdvanceVRAM
		null, // This is owned by GameBoyAdvanceOAM
		new DummyMemory(),
		new DummyMemory(),
		new DummyMemory(),
		new DummyMemory(),
		new DummyMemory(),
		new DummyMemory(),
		null,
		null // Unused
	];

	this.icache = [];

	this.waitstates = this.WAITSTATES.slice(0);
	this.waitstatesSeq = this.WAITSTATES_SEQ.slice(0);
	this.waitstates32 = this.WAITSTATES_32.slice(0);
	this.waitstatesSeq32 = this.WAITSTATES_SEQ_32.slice(0);

	this.DMA_REGISTER = [
		this.cpu.irq.io.DMA0CNT_HI >> 1,
		this.cpu.irq.io.DMA1CNT_HI >> 1,
		this.cpu.irq.io.DMA2CNT_HI >> 1,
		this.cpu.irq.io.DMA3CNT_HI >> 1
	];
};

GameBoyAdvanceMMU.prototype.loadBios = function(bios) {
	this.memory[this.REGION_BIOS] = new BIOSView(bios);
};

GameBoyAdvanceMMU.prototype.loadRom = function(rom, process) {
	var cart = {
		title: null,
		code: null,
		maker: null,
		memory: rom,
	};

	var lo = new ROMView(rom);
	this.memory[this.REGION_CART0] = lo;
	this.memory[this.REGION_CART1] = lo;
	this.memory[this.REGION_CART2] = lo;

	if (rom.byteLength > 0x01000000) {
		var hi = new ROMView(rom, 0x01000000);
		this.memory[this.REGION_CART0 + 1] = hi;
		this.memory[this.REGION_CART1 + 1] = hi;
		this.memory[this.REGION_CART2 + 1] = hi;
	}

	this.memory[this.REGION_CART_SRAM] = new MemoryBlock(this.SIZE_CART_SRAM);

	if (process) {
		var name = '';
		for (var i = 0; i < 12; ++i) {
			var c = lo.loadU8(i + 0xA0);
			if (!c) {
				break;
			}
			name += String.fromCharCode(c);
		}
		cart.title = name;

		var code = '';
		for (var i = 0; i < 4; ++i) {
			var c = lo.loadU8(i + 0xAC);
			if (!c) {
				break;
			}
			code += String.fromCharCode(c);
		}
		cart.code = code;

		var maker = '';
		for (var i = 0; i < 2; ++i) {
			var c = lo.loadU8(i + 0xB0);
			if (!c) {
				break;
			}
			maker += String.fromCharCode(c);
		}
		cart.maker = maker;
	}

	return cart;
};

GameBoyAdvanceMMU.prototype.load8 = function(offset) {
	return this.memory[offset >> this.BASE_OFFSET].load8(offset & 0x00FFFFFF);
};

GameBoyAdvanceMMU.prototype.load16 = function(offset) {
	return this.memory[offset >> this.BASE_OFFSET].load16(offset & 0x00FFFFFF);
};

GameBoyAdvanceMMU.prototype.load32 = function(offset) {
	return this.memory[offset >> this.BASE_OFFSET].load32(offset & 0x00FFFFFF);
};

GameBoyAdvanceMMU.prototype.loadU8 = function(offset) {
	return this.memory[offset >> this.BASE_OFFSET].loadU8(offset & 0x00FFFFFF);
};

GameBoyAdvanceMMU.prototype.loadU16 = function(offset) {
	return this.memory[offset >> this.BASE_OFFSET].loadU16(offset & 0x00FFFFFF);
};

GameBoyAdvanceMMU.prototype.store8 = function(offset, value) {
	var maskedOffset = offset & 0x00FFFFFF;
	var memory = this.memory[offset >> this.BASE_OFFSET];
	memory.store8(maskedOffset, value);
	this.icache[offset >> this.ICACHE_PAGE_BITS] = null;
};

GameBoyAdvanceMMU.prototype.store16 = function(offset, value) {
	var maskedOffset = offset & 0x00FFFFFE;
	var memory = this.memory[offset >> this.BASE_OFFSET];
	memory.store16(maskedOffset, value);
	this.icache[offset >> this.ICACHE_PAGE_BITS] = null;
};

GameBoyAdvanceMMU.prototype.store32 = function(offset, value) {
	var maskedOffset = offset & 0x00FFFFFC;
	var memory = this.memory[offset >> this.BASE_OFFSET];
	memory.store32(maskedOffset, value);
	this.icache[offset >> this.ICACHE_PAGE_BITS] = null;
	this.icache[(offset + 2) >> this.ICACHE_PAGE_BITS] = null;
};

GameBoyAdvanceMMU.prototype.wait = function(memory) {
	this.cpu.cycles += 1 + this.waitstates[memory >> this.BASE_OFFSET];
};

GameBoyAdvanceMMU.prototype.wait32 = function(memory) {
	this.cpu.cycles += 1 + this.waitstates32[memory >> this.BASE_OFFSET];
};

GameBoyAdvanceMMU.prototype.waitSeq = function(memory) {
	this.cpu.cycles += 1 + this.waitstatesSeq[memory >> this.BASE_OFFSET];
};

GameBoyAdvanceMMU.prototype.waitSeq32 = function(memory) {
	this.cpu.cycles += 1 + this.waitstatesSeq32[memory >> this.BASE_OFFSET];
};

GameBoyAdvanceMMU.prototype.scheduleDma = function(number, info) {
	switch (info.timing) {
	case this.DMA_TIMING_NOW:
		this.serviceDma(number, info);
		break;
	case this.DMA_TIMING_HBLANK:
		// Handled implicitly
		break;
	case this.DMA_TIMING_VBLANK:
		// Handled implicitly
		break;
	case this.DMA_TIMING_CUSTOM:
		switch (number) {
		case 0:
			this.core.WARN('Discarding invalid DMA0 scheduling');
			break;
		case 1:
		case 2:
			this.cpu.irq.audio.scheduleFIFODma(number, info);
			break;
		case 3:
			this.cpu.irq.video.scheduleVCaptureDma(dma, info);
			break;
		}
	}
};

GameBoyAdvanceMMU.prototype.runHblankDmas = function() {
	var dma;
	for (var i = 0; i < this.cpu.irq.dma.length; ++i) {
		dma = this.cpu.irq.dma[i];
		if (dma.enable && dma.timing == this.DMA_TIMING_HBLANK) {
			this.serviceDma(i, dma);
		}
	}
};

GameBoyAdvanceMMU.prototype.runVblankDmas = function() {
	var dma;
	for (var i = 0; i < this.cpu.irq.dma.length; ++i) {
		dma = this.cpu.irq.dma[i];
		if (dma.enable && dma.timing == this.DMA_TIMING_VBLANK) {
			this.serviceDma(i, dma);
		}
	}
};

GameBoyAdvanceMMU.prototype.serviceDma = function(number, info) {
	if (!info.enable) {
		// There was a DMA scheduled that got canceled
		return;
	}

	var width = info.width;
	var sourceOffset = this.DMA_OFFSET[info.srcControl] * width;
	var destOffset = this.DMA_OFFSET[info.dstControl] * width;
	var wordsRemaining = info.nextCount;
	var source = info.nextSource & this.OFFSET_MASK;
	var dest = info.nextDest & this.OFFSET_MASK;
	var sourceRegion = info.nextSource >> this.BASE_OFFSET;
	var destRegion = info.nextDest >> this.BASE_OFFSET;
	var sourceBlock = this.memory[sourceRegion];
	var destBlock = this.memory[destRegion];
	var word;
	if (sourceBlock && destBlock) {
		if (width == 4) {
			while (wordsRemaining--) {
				word = sourceBlock.load32(source);
				destBlock.store32(dest, word);
				source += sourceOffset;
				dest += destOffset;
			}
		} else {
			while (wordsRemaining--) {
				word = sourceBlock.loadU16(source);
				destBlock.store16(dest, word);
				source += sourceOffset;
				dest += destOffset;
			}
		}
	} else {
		this.core.WARN('Invalid DMA');
	}

	if (info.doIrq) {
		info.nextIRQ = this.cpu.cycles + 2;
		info.nextIRQ += (width == 4 ? this.waitstates32[sourceRegion] + this.waitstates32[destRegion]
		                            : this.waitstates[sourceRegion] + this.waitstates[destRegion]);
		info.nextIRQ += (info.count - 1) * (width == 4 ? this.waitstatesSeq32[sourceRegion] + this.waitstatesSeq32[destRegion]
		                                               : this.waitstatesSeq[sourceRegion] + this.waitstatesSeq[destRegion]);
	}

	// FIXME: Games just seem to want to trample their RAM by incrementing these addresses during
	// sound FIFO DMAs...investigate further
	if (!(info.timing == this.DMA_TIMING_CUSTOM && (number == 1 || number == 2))) {
		info.nextSource = source | (sourceRegion << this.BASE_OFFSET);
		info.nextDest = dest | (destRegion << this.BASE_OFFSET);
		info.nextCount = wordsRemaining;
	}

	if (!info.repeat) {
		info.enable = false;

		// Clear the enable bit in memory
		var io = this.memory[this.REGION_IO];
		io.registers[this.DMA_REGISTER[number]] &= 0x7FE0;
	} else {
		info.nextCount = info.count;
		if (info.dstControl == this.DMA_INCREMENT_RELOAD) {
			info.nextDest = info.dest;
		}
		this.scheduleDma(number, info);
	}
};

GameBoyAdvanceMMU.prototype.adjustTimings = function(word) {
	var sram = word & 0x0003;
	var ws0 = (word & 0x000C) >> 2;
	var ws0seq = (word & 0x0010) >> 4;
	var ws1 = (word & 0x0060) >> 5;
	var ws1seq = (word & 0x0080) >> 7;
	var ws2 = (word & 0x0300) >> 8;
	var ws2seq = (word & 0x0400) >> 10;

	// FIXME: are these seq and 32-bit correct?
	this.waitstates[this.REGION_CART_SRAM] = this.ROM_WS[sram];
	this.waitstatesSeq[this.REGION_CART_SRAM] = this.ROM_WS[sram];
	this.waitstates32[this.REGION_CART_SRAM] = this.ROM_WS[sram];
	this.waitstatesSeq32[this.REGION_CART_SRAM] = this.ROM_WS[sram];

	// TODO: waitstates for second ROM half
	this.waitstates[this.REGION_CART0] = this.ROM_WS[ws0];
	this.waitstates[this.REGION_CART1] = this.ROM_WS[ws1];
	this.waitstates[this.REGION_CART2] = this.ROM_WS[ws2];

	this.waitstatesSeq[this.REGION_CART0] = this.ROM_WS_SEQ[0][ws0seq];
	this.waitstatesSeq[this.REGION_CART1] = this.ROM_WS_SEQ[1][ws1seq];
	this.waitstatesSeq[this.REGION_CART2] = this.ROM_WS_SEQ[2][ws2seq];

	this.waitstates32[this.REGION_CART0] = this.waitstates[this.REGION_CART0] + 1 + this.waitstatesSeq[this.REGION_CART0];
	this.waitstates32[this.REGION_CART1] = this.waitstates[this.REGION_CART1] + 1 + this.waitstatesSeq[this.REGION_CART1];
	this.waitstates32[this.REGION_CART2] = this.waitstates[this.REGION_CART2] + 1 + this.waitstatesSeq[this.REGION_CART2];

	this.waitstatesSeq32[this.REGION_CART0] = 2 * this.waitstatesSeq[this.REGION_CART0] + 1;
	this.waitstatesSeq32[this.REGION_CART1] = 2 * this.waitstatesSeq[this.REGION_CART1] + 1;
	this.waitstatesSeq32[this.REGION_CART2] = 2 * this.waitstatesSeq[this.REGION_CART2] + 1;
};
