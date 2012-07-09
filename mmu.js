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
};

GameBoyAdvanceMMU.prototype.clear = function() {
	this.memory = [
		null,
		null, // Unused
		new ArrayBuffer(this.SIZE_WORKING_RAM),
		new ArrayBuffer(this.SIZE_WORKING_IRAM),
		new ArrayBuffer(this.SIZE_IO),
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
		new DataView(this.memory[4]),
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
	this.memoryView[4].cachedInstructions = 0;
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
};

GameBoyAdvanceMMU.prototype.loadRom = function(rom) {
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
	return this.memoryView[memoryRegion].getInt8(this.maskOffset(offset));
};

GameBoyAdvanceMMU.prototype.load16 = function(offset) {
	var memoryRegion = this.getMemoryRegion(offset);
	return this.memoryView[memoryRegion].getInt16(this.maskOffset(offset), true);
};

GameBoyAdvanceMMU.prototype.load32 = function(offset) {
	var memoryRegion = this.getMemoryRegion(offset);
	return this.memoryView[memoryRegion].getInt32(this.maskOffset(offset), true);
};

GameBoyAdvanceMMU.prototype.loadU8 = function(offset) {
	var memoryRegion = this.getMemoryRegion(offset);
	return this.memoryView[memoryRegion].getUint8(this.maskOffset(offset));
};

GameBoyAdvanceMMU.prototype.loadU16 = function(offset) {
	var memoryRegion = this.getMemoryRegion(offset);
	return this.memoryView[memoryRegion].getUint16(this.maskOffset(offset), true);
};

GameBoyAdvanceMMU.prototype.store8 = function(offset, value) {
	var memoryRegion = this.getMemoryRegion(offset);
	if (memoryRegion >= this.REGION_ROM0) {
		throw "Bad access";
	}
	var maskedOffset = offset & 0x00FFFFFF;
	var memory = this.memoryView[memoryRegion];
	memory.setInt8(maskedOffset, value);
	if (memory.cachedInstructions) {
		delete icache[maskedOffset >> 1];
	}
};

GameBoyAdvanceMMU.prototype.store16 = function(offset, value) {
	var memoryRegion = this.getMemoryRegion(offset);
	if (memoryRegion >= this.REGION_ROM0) {
		throw "Bad access";
	}
	var maskedOffset = offset & 0x00FFFFFE;
	var memory = this.memoryView[memoryRegion];
	memory.setInt16(maskedOffset, value, true);
	if (memory.cachedInstructions) {
		delete icache[maskedOffset >> 1];
	}
};

GameBoyAdvanceMMU.prototype.store32 = function(offset, value) {
	var memoryRegion = this.getMemoryRegion(offset);
	if (memoryRegion >= this.REGION_ROM0) {
		console.log("Cannot write to read only memory");
		return;
	}
	var maskedOffset = offset & 0x00FFFFFC;
	var memory = this.memoryView[memoryRegion];
	memory.setInt32(maskedOffset, value, true);
	if (memory.cachedInstructions) {
		delete icache[maskedOffset >> 1];
	}
};


GameBoyAdvanceMMU.prototype.getMemoryRegion = function(offset) {
	var memoryRegion = offset >> this.BASE_OFFSET;
	if (memoryRegion > this.REGION_CART0) {
		return memoryRegion & 0xE;
	}
	return memoryRegion;
};
