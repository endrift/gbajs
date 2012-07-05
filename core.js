GBACore = function() {
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
		new ArrayBuffer(this.SIZE_WORKING_IRAM),
		new ArrayBuffer(this.SIZE_WORKING_RAM),
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
};

GBACore.prototype.loadRom = function(rom) {
	this.resetCPU();
};

GBACore.prototype.load8 = function(offset) {
	var memoryZone = this.getMemoryZone(offset);
	return this.memoryView[memoryZone].getInt8(offset & 0x00FFFFFF); // FIXME: allow >16MB reads
};

GBACore.prototype.load16 = function(offset) {
	var memoryZone = this.getMemoryZone(offset);
	return this.memoryView[memoryZone].getInt16(offset & 0x00FFFFFF); // FIXME: allow >16MB reads
};

GBACore.prototype.load32 = function(offset) {
	var memoryZone = this.getMemoryZone(offset);
	return this.memoryView[memoryZone].getInt32(offset & 0x00FFFFFF); // FIXME: allow >16MB reads
};

GBACore.prototype.loadInstruction = function() {
	if (this.execMode == this.MODE_ARM) {
		var instruction = this.load32(this.nextPC);
		return this.compile(instruction);
	} else {
		var instruction = this.load16(this.nextPC);
		return this.compileThumb(instruction);
	}
};

GBACore.prototype.step = function() {
	this.loadInstruction(this.nextPC)();
	if (this.execMode == this.MODE_ARM) {
		this.advancePC();
	} else {
		this.advancePCThumb();
	}
};

GBACore.prototype.getMemoryZone = function(offset) {
	var memoryZone = (offset & this.BASE_MASK) >> this.baseOffset;
	switch (memoryZone) {
	case this.BASE_CART0 + 1:
	case this.BASE_CART1 + 1:
	case this.BASE_CART2 + 1:
		return memoryZone - 1;
	default:
		return memoryZone;
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

GBACore.prototype.compile = function(instruction) {
	var cond = (instruction & 0xF0000000) >>> 0 // >>> 0 converts from signed to unsigned;
	var op = this.noop;
	var i = instruction & 0x0E000000;
	var cpu = this;

	var condOp;
	switch (cond) {
	case 0x00000000:
		// EQ
		condOp = function() {
			return cpu.cpsrZ;
		};
		break;
	case 0x10000000:
		// NE
		condOp = function() {
			return !cpu.cpsrZ;
		};
		break;
	case 0x20000000:
		// CS
		condOp = function() {
			return cpu.cpsrC;
		};
		break;
	case 0x30000000:
		// CC
		condOp = function() {
			return !cpu.cpsrC;
		};
		break;
	case 0x40000000:
		// MI
		condOp = function() {
			return cpu.cpsrN;
		};
		break;
	case 0x50000000:
		// PL
		condOp = function() {
			return !cpu.cpsrN;
		};
		break;
	case 0x60000000:
		// VS
		condOp = function() {
			return cpu.cpsrV;
		};
		break;
	case 0x70000000:
		// VC
		condOp = function() {
			return !cpu.cpsrV;
		};
		break;
	case 0x80000000:
		// HI
		condOp = function () {
			return cpu.csprC && !cpu.csprZ;
		};
		break;
	case 0x90000000:
		// LS
		condOp = function () {
			return !cpu.csprC || cpu.csprZ;
		};
		break;
	case 0xA0000000:
		// GE
		condOp = function () {
			return !cpu.csprN == !cpu.csprV;
		};
		break;
	case 0xB0000000:
		// LT
		condOp = function () {
			return !cpu.csprN != !cpu.csprV;
		};
		break;
	case 0xC0000000:
		// GT
		condOp = function () {
			return !cpu.csprZ && !cpu.csprN == !cpu.csprV;
		};
		break;
	case 0xD0000000:
		// LE
		condOp = function () {
			return cpu.csprZ || !cpu.csprN != !cpu.csprV;
		};
		break;
	case 0xE0000000:
		// AL
	case 0xF0000000:
		condOp = false;
	}

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
	} else if (instruction & 0x0FFFFFF0 == 0x012FFF10) {
		// BX
		var rm = instruction & 0xF;
		op = function() {
			if (condOp && !condOp()) {
				return;
			}
			cpu.execMode = cpu.grps[rm] & 0x00000001;
			cpu.gprs[cpu.PC] = cpu.grps[rm] & 0xFFFFFFFE;
		}
	} else if (instruction & 0x0FC000F0 == 0x00000090) {
		// MUL
	} else if (instruction & 0x0F8000F0 == 0x00800090) {
		// MLL
	} else if (instruction & 0x0E000010 == 0x06000000) {
		// Single data transfer
	} else if (instruction & 0x0FB00FF0 == 0x01000090) {
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
	return this.noopThumb;
};
