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

	this.resetCPU();
};

GBACore.prototype.WARN = function(warn) {
	console.log("[WARNING] " + warn);
}

GBACore.prototype.ASSERT_UNREACHED = function(err) {
	throw "Should be unreached: " + err;
};

GBACore.prototype.resetCPU = function() {
	this.gprs = [
		0, 0, 0, 0,
		0, 0, 0, 0,
		0, 0, 0, 0,
		0, 0, 0, 0
	];
	this.execMode = 0;
	this.cpsrV = false;
	this.cpsrC = false;
	this.cpsrZ = false;
	this.cpsrN = false;

	this.nextPC = 0;

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
		new Array(this.SIZE_CART0 >> 2),
		null, // Unusued
		null,
		null, // Unusued
		null,
		null // Unused
	];
	this.cachedArm[this.REGION_CART1] = this.cachedArm[this.REGION_CART0];
	this.cachedArm[this.REGION_CART2] = this.cachedArm[this.REGION_CART0];

	this.cachedThumb = [
		null,
		null, // Unused
		new Array(this.SIZE_WORKING_RAM >> 1),
		new Array(this.SIZE_WORKING_IRAM >> 1),
		null,
		null,
		null,
		null,
		new Array(this.SIZE_CART0 >> 1),
		null, // Unusued
		null,
		null, // Unusued
		null,
		null // Unused
	];
	this.cachedThumb[this.REGION_CART1] = this.cachedThumb[this.REGION_CART0];
	this.cachedThumb[this.REGION_CART2] = this.cachedThumb[this.REGION_CART0];
};

GBACore.prototype.loadRom = function(rom) {
	this.resetCPU();
};

GBACore.prototype.load8 = function(offset) {
	var memoryRegion = this.getMemoryRegion(offset);
	return this.memoryView[memoryRegion].getInt8(offset & 0x00FFFFFF); // FIXME: allow >16MB reads
};

GBACore.prototype.load16 = function(offset) {
	var memoryRegion = this.getMemoryRegion(offset);
	return this.memoryView[memoryRegion].getInt16(offset & 0x00FFFFFF); // FIXME: allow >16MB reads
};

GBACore.prototype.load32 = function(offset) {
	var memoryRegion = this.getMemoryRegion(offset);
	return this.memoryView[memoryRegion].getInt32(offset & 0x00FFFFFF); // FIXME: allow >16MB reads
};

GBACore.prototype.loadInstruction = function() {
	var compiled = null;
	var memoryRegion = this.getMemoryRegion(this.nextPC);
	if (this.execMode == this.MODE_ARM) {
		var block = this.cachedArm[memoryRegion];
		var offset = (this.nextPC & 0x00FFFFFF) >> 2; // FIXME: allow >16MB reads
		if (block) {
			compiled = block[offset];
		}
		if (!compiled) {
			var instruction = this.load32(this.nextPC);
			compiled = this.compile(instruction);
			if (block) {
				block[offset] = compiled;
			}
		}
	} else {
		var block = this.cachedThumb[memoryRegion];
		var offset = (this.nextPC & 0x00FFFFFF) >> 1; // FIXME: allow >16MB reads
		if (block) {
			compiled = block[offset];
		}
		if (!compiled) {
			var instruction = this.load16(this.nextPC);
			compiled = this.compileThumb(instruction);
			if (block) {
				block[offset] = compiled;
			}
		}
	}
	return compiled;
};

GBACore.prototype.step = function() {
	this.loadInstruction(this.nextPC)();
	if (this.execMode == this.MODE_ARM) {
		this.advancePC();
	} else {
		this.advancePCThumb();
	}
};

GBACore.prototype.getMemoryRegion = function(offset) {
	var memoryRegion = (offset & this.BASE_MASK) >> this.BASE_OFFSET;
	switch (memoryRegion) {
	case this.BASE_CART0 + 1:
	case this.BASE_CART1 + 1:
	case this.BASE_CART2 + 1:
		return memoryRegion - 1;
	default:
		return memoryRegion;
	}
};

GBACore.prototype.advancePC = function() {
	this.gprs[this.PC] &= 0x0FFFFFFC;
	this.nextPC = this.gprs[this.PC];
	this.gprs[this.PC] += 4;
};

GBACore.prototype.advancePCThumb = function() {
	this.gprs[this.PC] &= 0x0FFFFFFE;
	this.nextPC = this.gprs[this.PC];
	this.gprs[this.PC] += 2;
};

GBACore.prototype.noop = function() {
};

GBACore.prototype.noopThumb = function() {
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
	var op = this.noop;
	var i = instruction & 0x0E000000;
	var cpu = this;

	var condOp = this.generateCond(cond);
	if (i == 0x02000000 || instruction & 0x00000090 != 0x00000090) {
		// Data processing/FSR transfer
		var opcode = instruction & 0x01E00000;
		var innerOp = null;
		var s = instruction & 0x00100000;
		var rn = (instruction & 0x000F0000) >> 16;
		var rd = (instruction & 0x0000F000) >> 12;

		// Parse shifter operand
		var shiftType = instruction & 0x00000060;
		// FIXME: this only applies if using non-immediate, which we always will be (?)
		var rm = instruction & 0x0000000F;
		var shiftOp = function() { return cpu.gprs[rm] };
		if (i) {
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
			}
		} else if (instruction & 0x00000010) {
			var rs = (instruction & 0x00000F00) >> 8;
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
				}
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
				}
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
				}
				break;
			}
		} else {
			var immediate = (instruction & 0x00000F80) >> 8;
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
			innerOp = function() {
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
			}
			break;
		case 0x00200000:
			// EOR
			innerOp = function() {
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
			}
			break;
		case 0x00400000:
			// SUB
			innerOp = function() {
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
			}
			break;
		case 0x00600000:
			// RSB
			innerOp = function() {
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
			}
			break;
		case 0x00800000:
			// ADD
			innerOp = function() {
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
			}
			break;
		case 0x00A00000:
			// ADC
			innerOp = function() {
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
			}
			break;
		case 0x00C00000:
			// SBC
			innerOp = function() {
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
			}
			break;
		case 0x00E00000:
			// RSC
			innerOp = function() {
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
			}
			break;
		case 0x01000000:
			// TST
			innerOp = function() {
				if (condOp && !condOp()) {
					return;
				}
				shiftOp();
				var aluOut = cpu.gprs[rn] & cpu.shifterOperand;
				cpu.cpsrN = aluOut & 0x80000000;
				cpu.cpsrZ = !aluOut;
				cpu.cpsrC = cpu.shifterCarryOut;
			}
			break;
		case 0x01200000:
			// TEQ
			innerOp = function() {
				if (condOp && !condOp()) {
					return;
				}
				shiftOp();
				var aluOut = cpu.gprs[rn] ^ cpu.shifterOperand;
				cpu.cpsrN = aluOut & 0x80000000;
				cpu.cpsrZ = !aluOut;
				cpu.cpsrC = cpu.shifterCarryOut;
			}
			break;
		case 0x01400000:
			// CMP
			innerOp = function() {
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
			}
			break;
		case 0x01600000:
			// CMN
			innerOp = function() {
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
			}
			break;
		case 0x01800000:
			// ORR
			innerOp = function() {
				if (condOp && !condOp()) {
					return;
				}
				shiftOp();
				cpu.gprs[rd] = cpu.gprs[rn] | cpu.shifterOperand;
				if (s) {
					cpu.cpsrN = cpu.gprs[rd] & 0x80000000;
					cpu.cpsrZ = !cpu.gprs[rd];
				}
			}
			break;
		case 0x01A00000:
			// MOV
			innerOp = function() {
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
			}
			break;
		case 0x01C00000:
			// BIC
			innerOp = function() {
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
			}
			break;
		case 0x01E00000:
			// MVN
			innerOp = function() {
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
			}
			break;
		}
		op = innerOp;
	} else if ((instruction & 0x0FFFFFF0) == 0x012FFF10) {
		// BX
		var rm = instruction & 0xF;
		op = function() {
			if (condOp && !condOp()) {
				return;
			}
			cpu.execMode = cpu.grps[rm] & 0x00000001;
			cpu.gprs[cpu.PC] = cpu.grps[rm] & 0xFFFFFFFE;
		}
	} else if ((instruction & 0x0FC000F0) == 0x00000090) {
		// MUL
	} else if ((instruction & 0x0F8000F0) == 0x00800090) {
		// MLL
	} else if ((instruction & 0x0E000010) == 0x06000000) {
		// Single data transfer
	} else if ((instruction & 0x0FB00FF0) == 0x01000090) {
		// Single data swap
	} else {
		switch (i) {
		case 0x00000000:
			// Halfword data transfer
			break;
		case 0x06000000:
			// Undefined
			return this.noop;
		case 0x08000000:
			// Block data transfer
			break;
		case 0x0A000000:
			// Branch
			break;
		case 0x0C000000:
			// Coprocessor data transfer
			break;
		case 0x0E000000:
			// Coprocessor data operation/SWI
			break;
		default:
			this.ASSERT_UNREACHED("Bad opcode");
		}
	}

	return op;
};

GBACore.prototype.compileThumb = function(instruction) {
	var op = this.noopThumb;
	var cpu = this;
	if ((instruction & 0xFC00) == 0x4000) {
		// Data-processing register
		switch (instruction & 0x0200) {
		}
	} else if ((instruction & 0xFC00) == 0x4400) {
		// Special data processing / branch/exchange instruction set
		var rm = (instruction & 0x0038) >> 3;
		var rd = instruction & 0x0007;
		switch (instruction & 0x03C0) {
		case 0x0000:
			// AND
			op = function() {
				cpu.gprs[rd] = cpu.gprs[rd] & cpu.gprs[rm];
				cpu.cpsrN = cpu.gprs[rd] & 0x80000000;
				cpu.cpsrZ = !cpu.gprs[rd];
			}
			break;
		case 0x0040:
			// EOR
			op = function() {
				cpu.gprs[rd] = cpu.gprs[rd] ^ cpu.gprs[rm];
				cpu.cpsrN = cpu.gprs[rd] & 0x80000000;
				cpu.cpsrZ = !cpu.gprs[rd];
			}
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
			}
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
			}
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
			}
			break;
		case 0x0140:
			// ADC
			op = function() {
				var m = (cpu.gprs[rm] >>> 0) + !!cpu.cpsrC;
				var d = (cpu.gprs[rd] >>> 0) + m;
				cpu.cpsrN = d & 0x80000000;
				cpu.cpsrZ = !d;
				cpu.cpsrC = d > 0xFFFFFFFF;
				cpu.cpsrV = cpu.gprs[rd] & 0x80000000 == m & 0x800000000 &&
				            cpu.gprs[rd] & 0x80000000 != d & 0x80000000 &&
				            m & 0x80000000 != d & 0x80000000;
				cpu.gprs[rd] = d;
			}
			break;
		case 0x0180:
			// SBC
			innerOp = function() {
				var m = (cpu.gprs[rm] >>> 0) + !cpu.cpsrC;
				var d = (cpu.gprs[rd] >>> 0) - m;
				cpu.cpsrN = d & 0x80000000;
				cpu.cpsrZ = !d;
				cpu.cpsrC = d > 0xFFFFFFFF;
				cpu.cpsrV = cpu.gprs[rd] & 0x80000000 != m & 0x800000000 &&
							cpu.gprs[rd] & 0x80000000 != d & 0x80000000;
				cpu.gprs[rd] = d;
			}
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
			}
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
			innerOp = function() {
				cpu.gprs[rd] = -cpu.gprs[rm];
				cpu.cpsrN = cpu.gprs[rd] & 0x80000000;
				cpu.cpsrZ = !cpu.gprs[rd];
				cpu.cpsrC = 0 >= (cpu.gprs[rn] >>> 0);
				cpu.cpsrV = cpu.gprs[rn] & 0x800000000 && cpu.gprs[rd] & 0x80000000;
			}
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
			}
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
			}
			break;
		case 0x0300:
			// ORR
			op = function() {
				cpu.gprs[rd] = cpu.gprs[rd] | cpu.gprs[rm];
				cpu.cpsrN = cpu.gprs[rd] & 0x80000000;
				cpu.cpsrZ = !cpu.gprs[rd];
			}
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
			}
			break;
		case 0x0380:
			// BIC
			op = function() {
				cpu.gprs[rd] = cpu.gprs[rd] & ~cpu.gprs[rm];
				cpu.cpsrN = cpu.gprs[rd] & 0x80000000;
				cpu.cpsrZ = !cpu.gprs[rd];
			}
			break;
		case 0x03C0:
			// MVN
			op = function() {
				cpu.gprs[rd] = ~cpu.gprs[rm];
				cpu.cpsrN = cpu.gprs[rd] & 0x80000000;
				cpu.cpsrZ = !cpu.gprs[rd];
			}
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
			this.WARN("Undefined instruction");
		}
	} else {
		this.ASSERT_UNREACHED("Bad opcode");
	}
	return op;
};
