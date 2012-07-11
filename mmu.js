GameBoyAdvanceMMU = function() {
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

	this.TIMINGS_8 = [
		1,
		0,
		1,
		3,
		1,
		1,
		1,
		1,
		5,
		0,
		5,
		0,
		5,
		0
	];

	this.TIMINGS_16 = [
		1,
		0,
		1,
		3,
		1,
		1,
		1,
		1,
		5,
		0,
		5,
		0,
		5,
		0
	];

	this.TIMINGS_32 = [
		1,
		0,
		1,
		6,
		1,
		2,
		2,
		1,
		8,
		0,
		8,
		0,
		8,
		0
	];
};

GameBoyAdvanceMMU.prototype.setCPU = function(cpu) {
	this.cpu = cpu;
}

GameBoyAdvanceMMU.prototype.setIO = function(io) {
	this.io = io;
}

GameBoyAdvanceMMU.prototype.clear = function() {
	this.memory = [
		null,
		null, // Unused
		new ArrayBuffer(this.SIZE_WORKING_RAM),
		new ArrayBuffer(this.SIZE_WORKING_IRAM),
		null, // This is owned by GameBoyAdvanceIO
		new ArrayBuffer(this.SIZE_PALETTE_RAM),
		new ArrayBuffer(this.SIZE_VRAM),
		new ArrayBuffer(this.SIZE_OAM),
		null,
		null, // Unused
		null,
		null, // Unused
		null,
		null, // Unused
		null,
		null // Unused
	];

	this.memoryView = [
		null,
		null, // Unused
		new DataView(this.memory[2]),
		new DataView(this.memory[3]),
		null,
		new DataView(this.memory[5]),
		new DataView(this.memory[6]),
		new DataView(this.memory[7]),
		null,
		null, // Unused
		null,
		null, // Unused
		null,
		null, // Unused
		null,
		null // Unused
	];

	this.memoryView[2].cachedInstructions = 0;
	this.memoryView[3].cachedInstructions = 0;
	this.memoryView[5].cachedInstructions = 0;
	this.memoryView[6].cachedInstructions = 0;
	this.memoryView[7].cachedInstructions = 0;

	this.icache = [
		null,
		null, // Unused
		new Array(this.SIZE_WORKING_RAM >> 1),
		new Array(this.SIZE_WORKING_IRAM >> 1),
		null,
		null,
		null,
		null,
		null,
		null, // Unusued
		null,
		null, // Unusued
		null,
		null // Unused
	];

	this.io.clear();
};

GameBoyAdvanceMMU.prototype.loadRom = function(rom, process) {
	cart = {
		title: null,
		code: null,
		maker: null,
		memory: rom,
	};

	this.memory[this.REGION_CART0] = rom;
	this.memory[this.REGION_CART1] = rom;
	this.memory[this.REGION_CART2] = rom;
	var view = new DataView(rom);
	this.memoryView[this.REGION_CART0] = view;
	this.memoryView[this.REGION_CART1] = view;
	this.memoryView[this.REGION_CART2] = view;

	var icache = new Array(rom.byteLength >> 1);
	this.icache[this.REGION_CART0] = icache;
	this.icache[this.REGION_CART1] = icache;
	this.icache[this.REGION_CART2] = icache;

	this.memory[this.REGION_CART_SRAM] = new ArrayBuffer(this.SIZE_CART_SRAM);
	this.memoryView[this.REGION_CART_SRAM] = new DataView(this.memory[this.REGION_CART_SRAM]);

	if (process) {
		var name = '';
		for (var i = 0; i < 12; ++i) {
			var c = view.getUint8(i + 0xA0);
			if (!c) {
				break;
			}
			name += String.fromCharCode(c);
		}
		cart.title = name;

		var code = '';
		for (var i = 0; i < 4; ++i) {
			var c = view.getUint8(i + 0xAC);
			if (!c) {
				break;
			}
			code += String.fromCharCode(c);
		}
		cart.code = code;

		var maker = '';
		for (var i = 0; i < 2; ++i) {
			var c = view.getUint8(i + 0xB0);
			if (!c) {
				break;
			}
			maker += String.fromCharCode(c);
		}
		cart.maker = maker;
	}

	this.cpu.prefetch(this.BASE_CART0);

	return cart;
};

GameBoyAdvanceMMU.prototype.maskOffset = function(offset) {
	if (offset < this.BASE_CART0) {
		return offset & 0x00FFFFFF;
	} else {
		return offset & 0x01FFFFFF;
	}
};

GameBoyAdvanceMMU.prototype.load8 = function(offset) {
	var memoryRegion = this.getMemoryRegion(offset);
	this.cpu.cycles += this.TIMINGS_8[memoryRegion];
	if (memoryRegion == this.REGION_IO) {
		return this.io.load8(offset & 0x00FFFFFF);
	}
	return this.memoryView[memoryRegion].getInt8(this.maskOffset(offset));
};

GameBoyAdvanceMMU.prototype.load16 = function(offset) {
	var memoryRegion = this.getMemoryRegion(offset);
	this.cpu.cycles += this.TIMINGS_16[memoryRegion];
	if (memoryRegion == this.REGION_IO) {
		return this.io.load16(offset & 0x00FFFFFE);
	}
	return this.memoryView[memoryRegion].getInt16(this.maskOffset(offset), true);
};

GameBoyAdvanceMMU.prototype.load32 = function(offset) {
	var memoryRegion = this.getMemoryRegion(offset);
	this.cpu.cycles += this.TIMINGS_32[memoryRegion];
	if (memoryRegion == this.REGION_IO) {
		return this.io.load32(offset & 0x00FFFFFC);
	}
	return this.memoryView[memoryRegion].getInt32(this.maskOffset(offset), true);
};

GameBoyAdvanceMMU.prototype.loadU8 = function(offset) {
	var memoryRegion = this.getMemoryRegion(offset);
	this.cpu.cycles += this.TIMINGS_8[memoryRegion];
	if (memoryRegion == this.REGION_IO) {
		return this.io.loadU8(offset & 0x00FFFFFF);
	}
	return this.memoryView[memoryRegion].getUint8(this.maskOffset(offset));
};

GameBoyAdvanceMMU.prototype.loadU16 = function(offset) {
	var memoryRegion = this.getMemoryRegion(offset);
	this.cpu.cycles += this.TIMINGS_32[memoryRegion];
	if (memoryRegion == this.REGION_IO) {
		return this.io.loadU16(offset & 0x00FFFFFE);
	}
	return this.memoryView[memoryRegion].getUint16(this.maskOffset(offset), true);
};

// Instruction loads -- we'll ignore advanced timings for now
GameBoyAdvanceMMU.prototype.iload16 = function(offset) {
	var memoryRegion = this.getMemoryRegion(offset);
	this.cpu.cycles += this.TIMINGS_16[memoryRegion];
	return this.memoryView[memoryRegion].getUint16(this.maskOffset(offset), true);
};

GameBoyAdvanceMMU.prototype.iload32 = function(offset) {
	var memoryRegion = this.getMemoryRegion(offset);
	this.cpu.cycles += this.TIMINGS_32[memoryRegion];
	return this.memoryView[memoryRegion].getInt32(this.maskOffset(offset), true);
};

GameBoyAdvanceMMU.prototype.freeLoadU8 = function(offset) {
	var memoryRegion = this.getMemoryRegion(offset);
	return this.memoryView[memoryRegion].getUint8(this.maskOffset(offset));
};

GameBoyAdvanceMMU.prototype.store8 = function(offset, value) {
	var memoryRegion = this.getMemoryRegion(offset);
	if (memoryRegion >= this.REGION_CART0 && memoryRegion < this.REGION_CART_SRAM) {
		throw "Bad access";
	}
	this.cpu.cycles += this.TIMINGS_8[memoryRegion];
	var maskedOffset = offset & 0x00FFFFFF;
	if (memoryRegion == this.REGION_IO) {
		this.io.store8(maskedOffset, value);
		return;
	}
	var memory = this.memoryView[memoryRegion];
	memory.setInt8(maskedOffset, value);
	if (memory.cachedInstructions) {
		delete this.icache[memoryRegion][maskedOffset >> 1];
	}
};

GameBoyAdvanceMMU.prototype.store16 = function(offset, value) {
	var memoryRegion = this.getMemoryRegion(offset);
	if (memoryRegion >= this.REGION_CART0 && memoryRegion < this.REGION_CART_SRAM) {
		throw "Bad access";
	}
	this.cpu.cycles += this.TIMINGS_16[memoryRegion];
	var maskedOffset = offset & 0x00FFFFFE;
	if (memoryRegion == this.REGION_IO) {
		this.io.store16(maskedOffset, value);
		return;
	}
	var memory = this.memoryView[memoryRegion];
	memory.setInt16(maskedOffset, value, true);
	if (memory.cachedInstructions) {
		delete this.icache[memoryRegion][maskedOffset >> 1];
	}
};

GameBoyAdvanceMMU.prototype.store32 = function(offset, value) {
	var memoryRegion = this.getMemoryRegion(offset);
	if (memoryRegion >= this.REGION_CART0 && memoryRegion < this.REGION_CART_SRAM) {
		throw "Bad access";
	}
	this.cpu.cycles += this.TIMINGS_32[memoryRegion];
	var maskedOffset = offset & 0x00FFFFFC;
	if (memoryRegion == this.REGION_IO) {
		this.io.store32(maskedOffset, value);
		return;
	}
	var memory = this.memoryView[memoryRegion];
	memory.setInt32(maskedOffset, value, true);
	if (memory.cachedInstructions) {
		delete this.icache[memoryRegion][maskedOffset >> 1];
		delete this.icache[memoryRegion][(maskedOffset >> 1) + 1];
	}
};

GameBoyAdvanceMMU.prototype.serviceDma = function(number, info) {
	var INCREMENT = 0;
	var DECREMENT = 1;
	var FIXED = 2;

	var sourceOffset;
	var destOffset;

	var width = info.width ? 4 : 2;

	switch (info.srcControl) {
	case INCREMENT:
		sourceOffset = width;
		break;
	case DECREMENT:
		sourceOffset = -width;
		break;
	case FIXED:
		sourceOffset = 0;
		break;
	}

	switch (info.dstControl) {
	case INCREMENT:
		destOffset = width;
		break;
	case DECREMENT:
		destOffset = -width;
		break;
	case FIXED:
		destOffset = 0;
		break;
	}

	var wordsRemaining = info.count;
	var source = this.maskOffset(info.source);
	var dest = this.maskOffset(info.dest);
	var sourceRegion = this.memoryView[this.getMemoryRegion(info.source)];
	var destRegion = this.memoryView[this.getMemoryRegion(info.dest)];
	if (width == 4) {
		for (var i = 0; i < wordsRemaining; ++i) {
			var word = sourceRegion.getInt32(source);
			destRegion.setInt32(dest, word);
			source += sourceOffset;
			dest += destOffset;
		}
	} else {
	}

	if (!info.repeat) {
		info.enable = false;

		// Clear the enable bit in memory
		var io = this.io.registers;
		var dmaRegister;
		switch (number) {
		case 0:
			dmaRegister = this.io.DMA0CNT_HI >> 1;
			break;
		case 1:
			dmaRegister = this.io.DMA1CNT_HI >> 1;
			break;
		case 2:
			dmaRegister = this.io.DMA2CNT_HI >> 1;
			break;
		case 3:
			dmaRegister = this.io.DMA3CNT_HI >> 1;
			break;
		}
		io[dmaRegister] &= 0x7FE0;
	}
};

GameBoyAdvanceMMU.prototype.getMemoryRegion = function(offset) {
	var memoryRegion = offset >> this.BASE_OFFSET;
	if (memoryRegion > this.REGION_CART0) {
		return memoryRegion & 0xE;
	}
	return memoryRegion;
};
