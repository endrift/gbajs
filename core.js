GBACore = function() {
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

	this.SP = 13;
	this.LR = 14;
	this.PC = 15;

	this.MODE_ARM = 0;
	this.MODE_THUMB = 1;

	this.MODE_USER = 0x10;
	this.MODE_FIQ = 0x11;
	this.MODE_IRQ = 0x12;
	this.MODE_SUPERVISOR = 0x13;
	this.MODE_ABORT = 0x17;
	this.MODE_UNDEFINED = 0x1B;
	this.MODE_SYSTEM = 0x1F;

	this.UNALLOC_MASK = 0x0FFFFF00;
	this.USER_MASK = 0xF0000000;
	this.PRIV_MASK = 0x0000000F; // TODO: this prevents MSR from setting status bits
	this.STATE_MASK = 0x00000020;

	this.WORD_SIZE_ARM = 4;
	this.WORD_SIZE_THUMB = 2;

	this.resetCPU();
};

GBACore.prototype.WARN = function(warn) {
	console.log("[WARNING] " + warn);
};

GBACore.prototype.STUB = function(func) {
	console.log("[STUB] Unimplemented function: " + func);
};

GBACore.prototype.OP_STUB = function(op) {
	console.log("[STUB] Unimplemented opcode: " + op);
};

GBACore.prototype.ASSERT_UNREACHED = function(err) {
	throw "Should be unreached: " + err;
};

GBACore.prototype.resetCPU = function() {
	this.gprs = [
		0, 0, 0, 0,
		0, 0, 0, 0,
		0, 0, 0, 0,
		0, 0, 0, 0x08000000
	];
	this.execMode = 0;

	this.mode = this.MODE_SYSTEM;

	this.cpsrI = false;
	this.cpsrF = false;

	this.cpsrV = false;
	this.cpsrC = false;
	this.cpsrZ = false;
	this.cpsrN = false;

	this.spsr = 0;

	this.nextPC = this.gprs[this.PC];

	this.shifterOperand = 0;
	this.shifterCarryOut = 0;

	this.memory = [
		null,
		null, // Unused
		new ArrayBuffer(this.SIZE_WORKING_RAM),
		new ArrayBuffer(this.SIZE_WORKING_IRAM),
		null,
		new ArrayBuffer(this.SIZE_PALLETE_RAM),
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

	this.cachedArm = [
		null,
		null, // Unused
		new Array(this.SIZE_WORKING_RAM >> 2),
		new Array(this.SIZE_WORKING_IRAM >> 2),
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

	this.cachedThumb = [
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

	this.skipStatusBits = false;
};

GBACore.prototype.loadRom = function(rom) {
	this.resetCPU();
	this.memory[this.REGION_CART0] = rom;
	this.memory[this.REGION_CART1] = rom;
	this.memory[this.REGION_CART2] = rom;
	var view = new DataView(rom);
	this.memoryView[this.REGION_CART0] = view;
	this.memoryView[this.REGION_CART1] = view;
	this.memoryView[this.REGION_CART2] = view;

	var cachedArm = new Array(rom.byteLength >> 2);
	this.cachedArm[this.REGION_CART0] = cachedArm;
	this.cachedArm[this.REGION_CART1] = cachedArm;
	this.cachedArm[this.REGION_CART2] = cachedArm;

	var cachedThumb = new Array(rom.byteLength >> 1);
	this.cachedThumb[this.REGION_CART0] = cachedThumb;
	this.cachedThumb[this.REGION_CART1] = cachedThumb;
	this.cachedThumb[this.REGION_CART2] = cachedThumb;
};

GBACore.prototype.maskOffset = function(offset) {
	if (offset < this.BASE_CART0) {
		return offset & 0x00FFFFFF;
	} else {
		return offset & 0x01FFFFFF;
	}
};

GBACore.prototype.load8 = function(offset) {
	var memoryRegion = this.getMemoryRegion(offset);
	return this.memoryView[memoryRegion].getInt8(this.maskOffset(offset));
};

GBACore.prototype.load16 = function(offset) {
	var memoryRegion = this.getMemoryRegion(offset);
	return this.memoryView[memoryRegion].getInt16(this.maskOffset(offset), true);
};

GBACore.prototype.load32 = function(offset) {
	var memoryRegion = this.getMemoryRegion(offset);
	return this.memoryView[memoryRegion].getInt32(this.maskOffset(offset), true);
};

GBACore.prototype.store8 = function(offset, value) {
	var memoryRegion = this.getMemoryRegion(offset);
	if (memoryRegion >= this.REGION_ROM0) {
		throw "Bad access";
	}
	var maskedOffset = offset & 0x00FFFFFF;
	this.memoryView[memoryRegion].setInt8(maskedOffset, value);
	var cache;
	cache = this.cachedArm[memoryRegion];
	if (cache) {
		delete cache[maskedOffset >> 2];
	}
	cache = this.cachedThumb[memoryRegion];
	if (cache) {
		delete cache[maskedOffset >> 1];
	}
};

GBACore.prototype.store16 = function(offset, value) {
	var memoryRegion = this.getMemoryRegion(offset);
	if (memoryRegion >= this.REGION_ROM0) {
		throw "Bad access";
	}
	var maskedOffset = offset & 0x00FFFFFE;
	this.memoryView[memoryRegion].setInt16(maskedOffset, value, true);
	var cache;
	cache = this.cachedArm[memoryRegion];
	if (cache) {
		delete cache[maskedOffset >> 2];
	}
	cache = this.cachedThumb[memoryRegion];
	if (cache) {
		delete cache[maskedOffset >> 1];
	}
};

GBACore.prototype.store32 = function(offset, value) {
	var memoryRegion = this.getMemoryRegion(offset);
	if (memoryRegion >= this.REGION_ROM0) {
		throw "Bad access";
	}
	var maskedOffset = offset & 0x00FFFFFC;
	this.memoryView[memoryRegion].setInt32(maskedOffset, value, true);
	var cache;
	cache = this.cachedArm[memoryRegion];
	if (cache) {
		delete cache[maskedOffset >> 2];
	}
	cache = this.cachedThumb[memoryRegion];
	if (cache) {
		delete cache[maskedOffset >> 1];
		delete cache[(maskedOffset >> 1) + 1];
	}
};

GBACore.prototype.loadInstruction = function(address) {
	var compiled = null;
	var memoryRegion = this.getMemoryRegion(address);
	if (this.execMode == this.MODE_ARM) {
		var block = this.cachedArm[memoryRegion];
		var offset = (this.maskOffset(address)) >> 2;
		if (block) {
			compiled = block[offset];
		}
		if (!compiled) {
			var instruction = this.load32(address) >>> 0;
			compiled = this.compile(instruction);
			if (block) {
				block[offset] = compiled;
			}
		}
	} else {
		var block = this.cachedThumb[memoryRegion];
		var offset = (this.maskOffset(address)) >> 1;
		if (block) {
			compiled = block[offset];
		}
		if (!compiled) {
			var instruction = this.load16(address);
			compiled = this.compileThumb(instruction);
			if (block) {
				block[offset] = compiled;
			}
		}
	}
	return compiled;
};

GBACore.prototype.step = function() {
	var instruction = this.loadInstruction(this.nextPC);
	var instructionWidth;
	if (this.execMode == this.MODE_ARM) {
		instructionWidth = this.WORD_SIZE_ARM;
	} else {
		instructionWidth = this.WORD_SIZE_THUMB;
	}
	var nextPC;
	var shownPC;
	if (instruction.touchesPC) {
		nextPC = this.nextPC + instructionWidth;
		shownPC = nextPC + instructionWidth;
		this.gprs[this.PC] = shownPC;
	}

	instruction();

	if (instruction.touchesPC) {
		if (this.gprs[this.PC] == shownPC) {
			this.nextPC = nextPC;
		} else {
			this.nextPC = this.gprs[this.PC];
		}
	} else {
		this.nextPC += instructionWidth;
	}
};

GBACore.prototype.switchMode = function(newMode) {
	this.STUB("switchMode");
};

GBACore.prototype.getMemoryRegion = function(offset) {
	var memoryRegion = (offset & this.BASE_MASK) >> this.BASE_OFFSET;
	if (memoryRegion > this.BASE_CART0) {
		return memoryRegion & 0xE;
	}
	return memoryRegion;
};

GBACore.prototype.badOp = function(instruction) {
	return function() {
		throw "Illegal instruction: 0x" + instruction.toString(16);
	};
};

GBACore.prototype.generateCond = function(cond) {
	var cpu = this;
	switch (cond) {
	case 0x0:
		// EQ
		return function() {
			return cpu.cpsrZ;
		};
	case 0x10000000:
		// NE
		return function() {
			return !cpu.cpsrZ;
		};
	case 0x20000000:
		// CS
		return function() {
			return cpu.cpsrC;
		};
	case 0x30000000:
		// CC
		return function() {
			return !cpu.cpsrC;
		};
	case 0x40000000:
		// MI
		return function() {
			return cpu.cpsrN;
		};
	case 0x50000000:
		// PL
		return function() {
			return !cpu.cpsrN;
		};
	case 0x60000000:
		// VS
		return function() {
			return cpu.cpsrV;
		};
	case 0x70000000:
		// VC
		return function() {
			return !cpu.cpsrV;
		};
	case 0x80000000:
		// HI
		return function () {
			return cpu.csprC && !cpu.csprZ;
		};
	case 0x90000000:
		// LS
		return function () {
			return !cpu.csprC || cpu.csprZ;
		};
	case 0xA0000000:
		// GE
		return function () {
			return !cpu.csprN == !cpu.csprV;
		};
	case 0xB0000000:
		// LT
		return function () {
			return !cpu.csprN != !cpu.csprV;
		};
	case 0xC0000000:
		// GT
		return function () {
			return !cpu.csprZ && !cpu.csprN == !cpu.csprV;
		};
	case 0xD0000000:
		// LE
		return function () {
			return cpu.csprZ || !cpu.csprN != !cpu.csprV;
		};
	case 0xE:
		// AL
	default:
		return null;
	}
}

GBACore.prototype.compile = function(instruction) {
	var cond = (instruction & 0xF0000000) >>> 28;
	var op = this.badOp(instruction);
	var i = instruction & 0x0E000000;
	var cpu = this;

	var condOp = this.generateCond(cond);
	if ((instruction & 0x0FFFFFF0) == 0x012FFF10) {
		// BX
		var rm = instruction & 0xF;
		op = function() {
			if (condOp && !condOp()) {
				return;
			}
			cpu.execMode = cpu.gprs[rm] & 0x00000001;
			cpu.gprs[cpu.PC] = cpu.gprs[rm] & 0xFFFFFFFE;
		};
		op.touchesPC = true;
	} else if (!(instruction & 0x0C000000) && (i == 0x02000000 || (instruction & 0x00000090) != 0x00000090)) {
		var opcode = instruction & 0x01E00000;
		var s = instruction & 0x00100000;
		if ((opcode & 0x01800000) == 0x01000000 && !s) {
			if ((instruction & 0x00B0F000) == 0x0020F000) {
				// MSR
				var r = instruction & 0x00400000;
				var c = instruction & 0x00010000;
				var x = instruction & 0x00020000;
				var s = instruction & 0x00040000;
				var f = instruction & 0x00080000;
				var rm = instruction & 0x0000000F;
				var immediate = instruction & 0x000000FF;
				var rotateImm = (instruction & 0x00000F00) >> 7;
				immediate = (immediate >> rotateImm) | (immediate << (32 - rotateImm));

				op = function() {
					if (condOp && !condOp()) {
						return;
					}
					var operand;
					if (instruction & 0x02000000) {
						operand = immediate;
					} else {
						operand = cpu.gprs[rm];
					}
					var mask = (c ? 0x000000FF : 0x00000000) |
					           //(x ? 0x0000FF00 : 0x00000000) | // Irrelevant on ARMv4T
					           //(s ? 0x00FF0000 : 0x00000000) | // Irrelevant on ARMv4T
					           (f ? 0xFF000000 : 0x00000000);

					if (r) {
						mask &= cpu.USER_MASK | cpu.PRIV_MASK | cpu.STATE_MASK;
						cpu.spsr = (cpu.spsr & ~mask) | (operand & mask);
					} else {
						if (mask & cpu.USER_MASK) {
							cpu.cpsrN = operand & 0x80000000;
							cpu.csprZ = operand & 0x40000000;
							cpu.cpsrC = operand & 0x20000000;
							cpu.cpsrV = operand & 0x10000000;
						}
						if (cpu.mode != cpu.MODE_USER && (mask & cpu.PRIV_MASK)) {
							cpu.switchMode((operand & 0x0000000F) | 0x00000010);
							// TODO: is disabling interrupts allowed here?
							//cpu.cpsrI = operand & 0x00000080;
							//cpu.cpsrF = operand & 0x00000040;
						}
					}
				};
				op.touchesPC = rm == this.PC;
			}
		} else {
			// Data processing/FSR transfer
			var op = null;
			var rn = (instruction & 0x000F0000) >> 16;
			var rd = (instruction & 0x0000F000) >> 12;
			var touchesPC = rn == this.PC || rd == this.PC;

			// Parse shifter operand
			var shiftType = instruction & 0x00000060;
			var rm = instruction & 0x0000000F;
			var shiftOp = function() { return cpu.gprs[rm] };
			if (instruction & 0x02000000) {
				var immediate = instruction & 0x000000FF;
				var rotate = (instruction & 0x00000F00) >> 7;
				shiftOp = function() {
					if (rotate == 0) {
						cpu.shifterOperand = immediate;
						cpu.shifterCarryOut = cpu.cpsrC;
					} else {
						cpu.shifterOperand = (immediate >> rotate) | (immediate << (32 - rotate));
						cpu.shifterCarryOut = cpu.shifterOperand & 0x80000000;
					}
				};
			} else if (instruction & 0x00000010) {
				var rs = (instruction & 0x00000F00) >> 8;
				touchesPC = touchesPC || rs == this.PC || rm == this.PC;
				switch (shiftType) {
				case 0:
					// LSL
					shiftOp = function() {
						var shift = cpu.gprs[rs] & 0xFF;
						if (shift == 0) {
							cpu.shifterOperand = cpu.gprs[rm];
							cpu.shifterCarryOut = cpu.cpsrC;
						} else if (shift < 32) {
							cpu.shifterOperand = cpu.gprs[rm] << shift;
							cpu.shifterCarryOut = cpu.gprs[rm] & (1 << (32 - shift));
						} else if (shift == 32) {
							cpu.shifterOperand = 0;
							cpu.shifterCarryOut = cpu.gprs[rm] & 1;
						} else {
							cpu.shifterOperand = 0;
							cpu.shifterCarryOut = 0;
						}
					};
					break;
				case 1:
					// LSR
					shiftOp = function() {
						var shift = cpu.gprs[rs] & 0xFF;
						if (shift == 0) {
							cpu.shifterOperand = cpu.gprs[rm];
							cpu.shifterCarryOut = cpu.cpsrC;
						} else if (shift < 32) {
							cpu.shifterOperand = cpu.gprs[rm] >>> shift;
							cpu.shifterCarryOut = cpu.gprs[rm] & (1 << (shift - 1));
						} else if (shift == 32) {
							cpu.shifterOperand = 0;
							cpu.shifterCarryOut = cpu.gprs[rm] & 0x80000000;
						} else {
							cpu.shifterOperand = 0;
							cpu.shifterCarryOut = 0;
						}
					};
					break;
				case 2:
					// ASR
					shiftOp = function() {
						var shift = cpu.gprs[rs] & 0xFF;
						if (shift == 0) {
							cpu.shifterOperand = cpu.gprs[rm];
							cpu.shifterCarryOut = cpu.cpsrC;
						} else if (shift < 32) {
							cpu.shifterOperand = cpu.gprs[rm] >> shift;
							cpu.shifterCarryOut = cpu.gprs[rm] & (1 << (shift - 1));
						} else if (cpu.gprs[rm] & 0x80000000) {
							cpu.shifterOperand = 0xFFFFFFFF;
							cpu.shifterCarryOut = 0x80000000;
						} else {
							cpu.shifterOperand = 0;
							cpu.shifterCarryOut = 0;
						}
					};
					break;
				case 3:
					// ROR
					shiftOp = function() {
						var shift = cpu.gprs[rs] & 0xFF;
						var rotate = shift & 0x1F;
						if (shift == 0) {
							cpu.shifterOperand = cpu.gprs[rm];
							cpu.shifterCarryOut = cpu.cpsrC;
						} else if (rotate) {
							cpu.shifterOperand = (cpu.gprs[rm] >>> rotate) | (cpu.gprs[rm] << (32 - rotate));
							cpu.shifterCarryOut = cpu.gprs[rm] & (1 << (rotate - 1));
						} else {
							cpu.shifterOperand = cpu.gprs[rm];
							cpu.shifterCarryOut = cpu.gprs[rm] & 0x80000000;
						}
					};
					break;
				}
			} else {
				var immediate = (instruction & 0x00000F80) >> 8;
				touchesPC = touchesPC || rm == this.PC;
				switch (shiftType) {
				case 0:
					// LSL
					if (immediate) {
						shiftOp = function() {
							cpu.shifterOperand = cpu.gprs[rm] << immediate;
							cpu.shifterCarryOut = cpu.gprs[rm] & (1 << (32 - immediate));
						};
					} else {
						// This boils down to no shift
						shiftOp = function() {
							cpu.shifterOperand = cpu.gprs[rm];
							cpu.shifterCarryOut = cpu.cpsrC;
						};
					}
					break;
				case 1:
					// LSR
					if (immediate) {
						shiftOp = function() {
							cpu.shifterOperand = cpu.gprs[rm] >>> immediate;
							cpu.shifterCarryOut = cpu.gprs[rm] & (1 << (immediate - 1));
						};
					} else {
						shiftOp = function() {
							cpu.shifterOperand = 0;
							cpu.shifterCarryOut = cpu.gprs[rm] & 0x80000000;
						};
					}
					break;
				case 2:
					// ASR
					if (immediate) {
						shiftOp = function() {
							cpu.shifterOperand = cpu.gprs[rm] >> immediate;
							cpu.shifterCarryOut = cpu.gprs[rm] & (1 << (immediate - 1));
						};
					} else {
						shiftOp = function() {
							cpu.shifterCarryOut = cpu.gprs[rm] & 0x80000000;
							if (cpu.shifterCarryOut) {
								cpu.shifterOperand = 0xFFFFFFFF;
							} else {
								cpu.shifterOperand = 0;
							}
						};
					}
					break;
				case 3:
					// ROR
					if (immediate) {
						shiftOp = function() {
							cpu.shifterOperand = (cpu.gprs[rm] >>> immediate) | (cpu.gprs[rm] << (32 - immediate));
							cpu.shifterCarryOut = cpu.gprs[rm] & (1 << (immediate - 1));
						};
					} else {
						// RRX
						shiftOp = function() {
							cpu.shifterOperand = (!!cpu.cpsrC << 31) | (cpu.gprs[rm] >>> 1);
							cpu.shifterCarryOut =  cpu.gprs[rm] & 0x00000001;
						};
					}
					break;
				}
			}

			switch (opcode) {
			case 0x00000000:
				// AND
				op = function() {
					if (condOp && !condOp()) {
						return;
					}
					shiftOp();
					cpu.gprs[rd] = cpu.gprs[rn] & cpu.shifterOperand;
					if (s) {
						cpu.cpsrN = cpu.gprs[rd] & 0x80000000;
						cpu.cpsrZ = !cpu.gprs[rd];
						cpu.cpsrC = cpu.shifterCarryOut;
					}
				};
				break;
			case 0x00200000:
				// EOR
				op = function() {
					if (condOp && !condOp()) {
						return;
					}
					shiftOp();
					cpu.gprs[rd] = cpu.gprs[rn] ^ cpu.shifterOperand;
					if (s) {
						cpu.cpsrN = cpu.gprs[rd] & 0x80000000;
						cpu.cpsrZ = !cpu.gprs[rd];
						cpu.cpsrC = cpu.shifterCarryOut;
					}
				};
				break;
			case 0x00400000:
				// SUB
				op = function() {
					if (condOp && !condOp()) {
						return;
					}
					shiftOp();
					var d = cpu.gprs[rn] - cpu.shifterOperand;
					if (s) {
						cpu.cpsrN = d & 0x80000000;
						cpu.cpsrZ = !d;
						cpu.cpsrC = (cpu.gprs[rn] >>> 0) >= (cpu.shifterOperand >>> 0);
						cpu.cpsrV = cpu.gprs[rn] & 0x80000000 != cpu.shifterOperand & 0x800000000 &&
									cpu.gprs[rn] & 0x80000000 != d & 0x80000000;
					}
					cpu.gprs[rd] = d;
				};
				break;
			case 0x00600000:
				// RSB
				op = function() {
					if (condOp && !condOp()) {
						return;
					}
					shiftOp();
					var d = cpu.shifterOperand - cpu.gprs[rn];
					if (s) {
						cpu.cpsrN = d & 0x80000000;
						cpu.cpsrZ = !d;
						cpu.cpsrC = (cpu.shifterOperand >>> 0) >= (cpu.gprs[rn] >>> 0);
						cpu.cpsrV = cpu.shifterOperand & 0x800000000 != cpu.gprs[rn] & 0x80000000 &&
									cpu.shifterOperand & 0x800000000 != d & 0x80000000;
					}
					cpu.gprs[rd] = d;
				};
				break;
			case 0x00800000:
				// ADD
				op = function() {
					if (condOp && !condOp()) {
						return;
					}
					shiftOp();
					var d = (cpu.gprs[rn] >>> 0) + (cpu.shifterOperand >>> 0);
					if (s) {
						cpu.cpsrN = d & 0x80000000;
						cpu.cpsrZ = !d;
						cpu.cpsrC = d > 0xFFFFFFFF;
						cpu.cpsrV = cpu.gprs[rn] & 0x80000000 == cpu.shifterOperand & 0x800000000 &&
									cpu.gprs[rn] & 0x80000000 != d & 0x80000000 &&
									cpu.shifterOperand & 0x80000000 != d & 0x80000000;
					}
					cpu.gprs[rd] = d;
				};
				break;
			case 0x00A00000:
				// ADC
				op = function() {
					if (condOp && !condOp()) {
						return;
					}
					shiftOp();
					var shifterOperand = (cpu.shifterOperand >>> 0) + !!cpu.cpsrC;
					var d = (cpu.gprs[rn] >>> 0) + shifterOperand;
					if (s) {
						cpu.cpsrN = d & 0x80000000;
						cpu.cpsrZ = !d;
						cpu.cpsrC = d > 0xFFFFFFFF;
						cpu.cpsrV = cpu.gprs[rn] & 0x80000000 == shifterOperand & 0x800000000 &&
									cpu.gprs[rn] & 0x80000000 != d & 0x80000000 &&
									shifterOperand & 0x80000000 != d & 0x80000000;
					}
					cpu.gprs[rd] = d;
				};
				break;
			case 0x00C00000:
				// SBC
				op = function() {
					if (condOp && !condOp()) {
						return;
					}
					shiftOp();
					var shifterOperand = (cpu.shifterOperand >>> 0) + !cpu.cpsrC;
					var d = (cpu.gprs[rn] >>> 0) - shifterOperand;
					if (s) {
						cpu.cpsrN = d & 0x80000000;
						cpu.cpsrZ = !d;
						cpu.cpsrC = d > 0xFFFFFFFF;
						cpu.cpsrV = cpu.gprs[rn] & 0x80000000 != shifterOperand & 0x800000000 &&
									cpu.gprs[rn] & 0x80000000 != d & 0x80000000;
					}
					cpu.gprs[rd] = d;
				};
				break;
			case 0x00E00000:
				// RSC
				op = function() {
					if (condOp && !condOp()) {
						return;
					}
					shiftOp();
					var n = (cpu.gprs[rn] >>> 0) + !cpu.cpsrC;
					var d = (cpu.shifterOperand >>> 0) - n;
					if (s) {
						cpu.cpsrN = d & 0x80000000;
						cpu.cpsrZ = !d;
						cpu.cpsrC = d > 0xFFFFFFFF;
						cpu.cpsrV = cpu.shifterOperand & 0x80000000 != n & 0x80000000 &&
									cpu.shifterOperand & 0x80000000 != d & 0x80000000;
					}
					cpu.gprs[rd] = d;
				};
				break;
			case 0x01000000:
				// TST
				op = function() {
					if (condOp && !condOp()) {
						return;
					}
					shiftOp();
					var aluOut = cpu.gprs[rn] & cpu.shifterOperand;
					cpu.cpsrN = aluOut & 0x80000000;
					cpu.cpsrZ = !aluOut;
					cpu.cpsrC = cpu.shifterCarryOut;
				};
				break;
			case 0x01200000:
				// TEQ
				op = function() {
					if (condOp && !condOp()) {
						return;
					}
					shiftOp();
					var aluOut = cpu.gprs[rn] ^ cpu.shifterOperand;
					cpu.cpsrN = aluOut & 0x80000000;
					cpu.cpsrZ = !aluOut;
					cpu.cpsrC = cpu.shifterCarryOut;
				};
				break;
			case 0x01400000:
				// CMP
				op = function() {
					if (condOp && !condOp()) {
						return;
					}
					shiftOp();
					var aluOut = cpu.gprs[rn] - cpu.shifterOperand;
					cpu.cpsrN = aluOut & 0x80000000;
					cpu.cpsrZ = !aluOut;
					cpu.cpsrC = (cpu.gprs[rn] >>> 0) >= (cpu.shifterOperand >>> 0);
					cpu.cpsrV = cpu.gprs[rn] & 0x80000000 != cpu.shifterOperand & 0x800000000 &&
								cpu.gprs[rn] & 0x80000000 != aluOut & 0x80000000;
				};
				break;
			case 0x01600000:
				// CMN
				op = function() {
					if (condOp && !condOp()) {
						return;
					}
					shiftOp();
					var aluOut = (cpu.gprs[rn] >>> 0) + (cpu.shifterOperand >>> 0);
					cpu.cpsrN = aluOut & 0x80000000;
					cpu.cpsrZ = !aluOut;
					cpu.cpsrC = aluOut > 0xFFFFFFFF;
					cpu.cpsrV = cpu.gprs[rn] & 0x80000000 == cpu.shifterOperand & 0x800000000 &&
								cpu.gprs[rn] & 0x80000000 != aluOut & 0x80000000 &&
								cpu.shifterOperand & 0x80000000 != aluOut & 0x80000000;
				};
				break;
			case 0x01800000:
				// ORR
				op = function() {
					if (condOp && !condOp()) {
						return;
					}
					shiftOp();
					cpu.gprs[rd] = cpu.gprs[rn] | cpu.shifterOperand;
					if (s) {
						cpu.cpsrN = cpu.gprs[rd] & 0x80000000;
						cpu.cpsrZ = !cpu.gprs[rd];
					}
				};
				break;
			case 0x01A00000:
				// MOV
				op = function() {
					if (condOp && !condOp()) {
						return;
					}
					shiftOp();
					cpu.gprs[rd] = cpu.shifterOperand;
					if (s) {
						cpu.cpsrN = cpu.gprs[rd] & 0x80000000;
						cpu.cpsrZ = !cpu.gprs[rd];
						cpu.cpsrC = cpu.shifterCarryOut;
					}
				};
				break;
			case 0x01C00000:
				// BIC
				op = function() {
					if (condOp && !condOp()) {
						return;
					}
					shiftOp();
					cpu.gprs[rd] = cpu.gprs[rn] & ~cpu.shifterOperand;
					if (s) {
						cpu.cpsrN = cpu.gprs[rd] & 0x80000000;
						cpu.cpsrZ = !cpu.gprs[rd];
						cpu.cpsrC = cpu.shifterCarryOut;
					}
				};
				break;
			case 0x01E00000:
				// MVN
				op = function() {
					if (condOp && !condOp()) {
						return;
					}
					shiftOp();
					cpu.gprs[rd] = ~cpu.shifterOperand;
					if (s) {
						cpu.cpsrN = cpu.gprs[rd] & 0x80000000;
						cpu.cpsrZ = !cpu.gprs[rd];
						cpu.cpsrC = aluOut > cpu.shifterCarryOut;
					}
				};
				break;
			}
			op.touchesPC = touchesPC;
		}
	} else if ((instruction & 0x0E000010) == 0x06000000) {
		// Single data transfer
	} else if ((instruction & 0x0FB00FF0) == 0x01000090) {
		// Single data swap
	} else {
		switch (i) {
		case 0x00000000:
			// Halfword data transfer
			break;
		case 0x04000000:
			// LDR/STR
			var rn = (instruction & 0x000F0000) >> 16;
			var rd = (instruction & 0x0000F000) >> 12;
			var load = instruction & 0x00100000;
			var w = instruction & 0x00200000;
			var b = instruction & 0x00400000;
			var u = instruction & 0x00800000;
			var p = instruction & 0x01000000;
			var i = instruction & 0x02000000;

			var address = function() {
				throw "Unimplemented memory access: 0x" + instruction.toString(16);
			};
			if (i) {
				if (p) {
					if (w) {
					} else {
					}
				} else {
					if (w) {
					} else {
					}
				}
			} else {
				// Immediate
				var offset = instruction & 0x00000FFF;
				if (p) {
					if (w) {
					} else {
						if (u) {
							address = function() {
								return cpu.gprs[rn] + offset;
							};
						} else {
							address = function() {
								return cpu.gprs[rn] - offset;
							};
						}
					}
				} else {
					if (w) {
					} else {
					}
				}
			}
			if (load) {
				if (b) {
					// LDRB
				} else {
					// LDR
					op = function() {
						if (condOp && !condOp()) {
							return;
						}
						var a = address();
						cpu.gprs[rd] = cpu.load32(a);
					};
				}
			} else {
				if (b) {
					// STRB
				} else {
					// STR
					op = function() {
						if (condOp && !condOp()) {
							return;
						}
						var a = address();
						cpu.store32(a, cpu.gprs[rd]);
					};
				}
			}
			op.touchesPC = rn == this.PC || rd == this.PC;
			break;
		case 0x06000000:
			// Undefined
			return op;
		case 0x08000000:
			// Block data transfer
			break;
		case 0x0A000000:
			// Branch
			var immediate = instruction & 0x00FFFFFF;
			if (immediate & 0x00800000) {
				immediate |= 0xFF000000;
			}
			immediate <<= 2;
			var link = instruction & 0x01000000;
			op = function() {
				if (condOp && !condOp()) {
					return;
				}
				if (link) {
					cpu.gprs[cpu.LR] = cpu.gprs[cpu.PC] - 4;
				}
				cpu.gprs[cpu.PC] += immediate;
			};
			op.touchesPC = true;
			break;
		case 0x0C000000:
			// Coprocessor data transfer
			break;
		case 0x0E000000:
			// Coprocessor data operation/SWI
			break;
		default:
			this.ASSERT_UNREACHED("Bad opcode: 0x" + instruction.toString(16));
		}
	}

	return op;
};

GBACore.prototype.compileThumb = function(instruction) {
	var op = this.badOp(instruction);
	var cpu = this;
	if ((instruction & 0xFC00) == 0x4000) {
		// Data-processing register
		var rm = (instruction & 0x0038) >> 3;
		var rd = instruction & 0x0007;
		switch (instruction & 0x03C0) {
		case 0x0000:
			// AND
			op = function() {
				cpu.gprs[rd] = cpu.gprs[rd] & cpu.gprs[rm];
				cpu.cpsrN = cpu.gprs[rd] & 0x80000000;
				cpu.cpsrZ = !cpu.gprs[rd];
			};
			break;
		case 0x0040:
			// EOR
			op = function() {
				cpu.gprs[rd] = cpu.gprs[rd] ^ cpu.gprs[rm];
				cpu.cpsrN = cpu.gprs[rd] & 0x80000000;
				cpu.cpsrZ = !cpu.gprs[rd];
			};
			break;
		case 0x0080:
			// LSL
			op = function() {
				var rs = cpu.gprs[rm] & 0xFF;
				if (rs) {
					if (rs < 32) {
						cpu.cpsrC = cpu.gprs[rd] & (1 << (32 - rs));
						cpu.gprs[rd] <<= rs;
					} else {
						if (rs > 32) {
							cpu.cpsrC = 0;
						} else {
							cpu.cpsrC = cpu.gprs[rd] & 0x00000001;
						}
						cpu.gprs[rd] = 0;
					}
				}
				cpu.cpsrN = cpu.gprs[rd] & 0x80000000;
				cpu.cpsrZ = !cpu.gprs[rd];
			};
			break;
		case 0x00C0:
			// LSR
			op = function() {
				var rs = cpu.gprs[rm] & 0xFF;
				if (rs) {
					if (rs < 32) {
						cpu.cpsrC = cpu.gprs[rd] & (1 << (rs - 1));
						cpu.gprs[rd] >>>= rs;
					} else {
						if (rs > 32) {
							cpu.cpsrC = 0;
						} else {
							cpu.cpsrC = cpu.gprs[rd] & 0x80000000;
						}
						cpu.gprs[rd] = 0;
					}
				}
				cpu.cpsrN = cpu.gprs[rd] & 0x80000000;
				cpu.cpsrZ = !cpu.gprs[rd];
			};
			break;
		case 0x0100:
			// ASR
			op = function() {
				var rs = cpu.gprs[rm] & 0xFF;
				if (rs) {
					if (rs < 32) {
						cpu.cpsrC = cpu.gprs[rd] & (1 << (rs - 1));
						cpu.gprs[rd] >>= rs;
					} else {
						cpu.cpsrC = cpu.gprs[rd] & 0x80000000;
						if (cpu.cpsrC) {
							cpu.gprs[rd] = 0xFFFFFFFF;
						} else {
							cpu.gprs[rd] = 0;
						}
					}
				}
				cpu.cpsrN = cpu.gprs[rd] & 0x80000000;
				cpu.cpsrZ = !cpu.gprs[rd];
			};
			break;
		case 0x0140:
			// ADC
			op = function() {
				var m = (cpu.gprs[rm] >>> 0) + !!cpu.cpsrC;
				var oldD = cpu.gprs[rd];
				var d = (oldD >>> 0) + m;
				if (!cpu.skipStatusBits) {
					var oldDn = oldD & 0x80000000;
					var dn = d & 0x80000000;
					var mn = m & 0x80000000;
					cpu.cpsrN = dn;
					cpu.cpsrZ = !d;
					cpu.cpsrC = d > 0xFFFFFFFF;
					cpu.cpsrV = oldDn == mn && oldDn != dn && mn != dn;
				}
				cpu.gprs[rd] = d;
			};
			break;
		case 0x0180:
			// SBC
			op = function() {
				var m = (cpu.gprs[rm] >>> 0) + !cpu.cpsrC;
				var d = (cpu.gprs[rd] >>> 0) - m;
				cpu.cpsrN = d & 0x80000000;
				cpu.cpsrZ = !d;
				cpu.cpsrC = d > 0xFFFFFFFF;
				cpu.cpsrV = cpu.gprs[rd] & 0x80000000 != m & 0x800000000 &&
							cpu.gprs[rd] & 0x80000000 != d & 0x80000000;
				cpu.gprs[rd] = d;
			};
			break;
		case 0x01C0:
			// ROR
			op = function() {
				var rs = cpu.gprs[rm] & 0xFF;
				if (rs) {
					var r4 = rs & 0x0F;
					if (r4 > 0) {
						cpu.cpsrC = cpu.gprs[rd] & (1 << (r4 - 1));
						cpu.gprs[rd] = (cpu.gprs[rd] >>> r4) | (cpu.gprs[rd] << (32 - r4));
					} else {
						cpu.cpsrC = cpu.gprs[rd] & 0x80000000;
					}
				}
				cpu.cpsrN = cpu.gprs[rd] & 0x80000000;
				cpu.cpsrZ = !cpu.gprs[rd];
			};
			break;
		case 0x0200:
			// TST
			op = function() {
				var aluOut = cpu.gprs[rd] & cpu.gprs[rm];
				cpu.cpsrN = aluOut & 0x80000000;
				cpu.cpsrZ = !aluOut;
			}
			break;
		case 0x0240:
			// NEG
			op = function() {
				cpu.gprs[rd] = -cpu.gprs[rm];
				cpu.cpsrN = cpu.gprs[rd] & 0x80000000;
				cpu.cpsrZ = !cpu.gprs[rd];
				cpu.cpsrC = 0 >= (cpu.gprs[rn] >>> 0);
				cpu.cpsrV = cpu.gprs[rn] & 0x800000000 && cpu.gprs[rd] & 0x80000000;
			};
			break;
		case 0x0280:
			// CMP
			op = function() {
				var aluOut = cpu.gprs[rd] - cpu.gprs[rm];
				cpu.cpsrN = aluOut & 0x80000000;
				cpu.cpsrZ = !aluOut;
				cpu.cpsrC = (cpu.gprs[rd] >>> 0) >= (cpu.gprs[rm] >>> 0);
				cpu.cpsrV = cpu.gprs[rd] & 0x80000000 != cpu.gprs[rm] & 0x800000000 &&
					        cpu.gprs[rd] & 0x80000000 != aluOut & 0x80000000;
			};
			break;
		case 0x02C0:
			// CMN
			op = function() {
				var aluOut = (cpu.gprs[rd] >>> 0) + (cpu.gprs[rm] >>> 0);
				cpu.cpsrN = aluOut & 0x80000000;
				cpu.cpsrZ = !aluOut;
				cpu.cpsrC = aluOut > 0xFFFFFFFF;
				cpu.cpsrV = cpu.gprs[rd] & 0x80000000 == cpu.gprs[rm] & 0x800000000 &&
					        cpu.gprs[rd] & 0x80000000 != aluOut & 0x80000000 &&
					        cpu.gprs[rm] & 0x80000000 != aluOut & 0x80000000;
			};
			break;
		case 0x0300:
			// ORR
			op = function() {
				cpu.gprs[rd] = cpu.gprs[rd] | cpu.gprs[rm];
				cpu.cpsrN = cpu.gprs[rd] & 0x80000000;
				cpu.cpsrZ = !cpu.gprs[rd];
			};
			break;
		case 0x0340:
			// MUL
			op = function() {
				if ((cpu.gprs[rs] & 0xFFFF0000) && (cpu.gprs[rd] & 0xFFFF0000)) {
					// Our data type is a double--we'll lose bits if we do it all at once!
					var hi = ((cpu.gprs[rd] & 0xFFFF0000) * cpu.gprs[rs]) & 0xFFFFFFFF;
					var lo = ((cpu.gprs[rd] & 0x0000FFFF) * cpu.gprs[rs]) & 0xFFFFFFFF;
					cpu.gprs[rd] = (hi + lo) & 0xFFFFFFFF;
				} else {
					cpu.gprs[rd] *= cpu.gprs[rs];
				}
				cpu.cpsrN = cpu.gprs[rd] & 0x80000000;
				cpu.cpsrZ = !cpu.gprs[rd];
			};
			break;
		case 0x0380:
			// BIC
			op = function() {
				cpu.gprs[rd] = cpu.gprs[rd] & ~cpu.gprs[rm];
				cpu.cpsrN = cpu.gprs[rd] & 0x80000000;
				cpu.cpsrZ = !cpu.gprs[rd];
			};
			break;
		case 0x03C0:
			// MVN
			op = function() {
				cpu.gprs[rd] = ~cpu.gprs[rm];
				cpu.cpsrN = cpu.gprs[rd] & 0x80000000;
				cpu.cpsrZ = !cpu.gprs[rd];
			};
			break;
		}
		op.touchesPC = false;
	} else if ((instruction & 0xFC00) == 0x4400) {
		// Special data processing / branch/exchange instruction set
		var rm = 0x0038;
		var rn = 0x0007;
		var h1 = 0x0080;
		var h2 = 0x0040;
		switch (instruction & 0x0300) {
		case 0x0000:
			break;
		case 0x0100:
			break;
		case 0x0200:
			// MOV
			var rd = rn | (h1 >> 4);
			rm = (rm | h2) >> 3;
			op = function() {
				cpu.gprs[rd] = cpu.gprs[rm];
			};
			break;
		case 0x0300:
			break;
		}
	} else if ((instruction & 0xF800) == 0x1800) {
		// Add/subtract
	} else if ((instruction & 0xE000) == 0x2000) {
		// Add/subtract/compare/move immediate
	} else if ((instruction & 0xF800) == 0x4800) {
		// PC-relative load
	} else if ((instruction & 0xF200) == 0x5000) {
		// Load and store with relative offset
	} else if ((instruction & 0xF200) == 0x5200) {
		// Load and store sign-extend byte and halfword
	} else if ((instruction & 0xE000) == 0x3000) {
		// Load and store with immediate offset
	} else if ((instruction & 0xFF00) == 0xB000) {
		// Add offset to stack pointer
	} else if ((instruction & 0xF600) == 0xB400) {
		// Push and pop registers
		if (instruction & 0x0800) {
			// POP
		} else {
			// PUSH
			var r = instruction & 0x0100;
			var rs = instruction & 0x00FF;
			op = function() {
				var address = cpu.gprs[cpu.SP] - 4;
				if (r) {
					cpu.store32(address, cpu.gprs[cpu.LR]);
					address -= 4;
				}
				for (var m = 0x80, i = 0; m; m >>= 1, ++i, address -= 4) {
					if (rs & m) {
						cpu.store32(address, cpu.gprs[i]);
					}
				}
				cpu.gprs[cpu.SP] = address + 4;
			};
			op.touchesPC = false;
		}
	} else if ((instruction & 0xFF00) == 0xDF00) {
		// SWI
	} else if ((instruction & 0xF800) == 0xE000) {
		// Unconditional branch
	} else if ((instruction & 0xF000) == 0x8000) {
		switch (instruction & 0x7000) {
		case 0x0000:
			// Load and store halfword
			break;
		case 0x1000:
			// SP-relative load and store
			break;
		case 0x2000:
			// Load address
			break;
		case 0x3000:
			// Push and pop registers
			break;
		case 0x4000:
			// Multiple load and store
			break;
		case 0x5000:
			// Conditional branch
			break;
		case 0x7000:
			// Long branch with link
			break;
		default:
			this.WARN("Undefined instruction: 0x" + instruction.toString(16));
		}
	} else {
		this.ASSERT_UNREACHED("Bad opcode: 0x" + instruction.toString(16));
	}
	return op;
};
