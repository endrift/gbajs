ARMCore = function() {
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

	// These are all extra cycles above the normal
	this.LDR_CYCLES = 2;
	this.STR_CYCLES = 1;

	this.PC_CYCLES = 2;
	this.B_THUMB_CYCLES = 3;
	this.SHIFT_RS_CYCLES = 1;
};

ARMCore.prototype.WARN = function(warn) {
	console.log("[WARNING] " + warn);
};

ARMCore.prototype.STUB = function(func) {
	console.log("[STUB] Unimplemented function: " + func);
};

ARMCore.prototype.OP_STUB = function(op) {
	console.log("[STUB] Unimplemented opcode: " + op);
};

ARMCore.prototype.ASSERT_UNREACHED = function(err) {
	throw "Should be unreached: " + err;
};

ARMCore.prototype.ASSERT = function(test, err) {
	if (!test) {
		throw "Assertion failed: " + err;
	}
};

ARMCore.prototype.resetCPU = function(startOffset, mmu, irq) {
	this.gprs = new Int32Array(16);
	this.gprs[this.PC] = startOffset;

	this.mmu = mmu;
	this.irq = irq;

	mmu.setCPU(this);
	irq.setCPU(this);

	this.execMode = this.MODE_ARM;
	this.instructionWidth = this.WORD_SIZE_ARM;

	this.mode = this.MODE_SYSTEM;

	this.cpsrI = false;
	this.cpsrF = false;

	this.cpsrV = false;
	this.cpsrC = false;
	this.cpsrZ = false;
	this.cpsrN = false;

	this.spsr = 0;

	this.nextPC = this.gprs[this.PC];
	this.cycles = 0;

	this.shifterOperand = 0;
	this.shifterCarryOut = 0;

	this.mmu.clear();

	this.skipStatusBits = false;
	this.prefetch = {
		'address': 0,
		'instruction': null
	};
};

ARMCore.prototype.loadInstruction = function(address) {
	var compiled = null;
	var next = null;
	if (address == this.prefetch.address && this.prefetch.instruction) {
		return this.prefetch.instruction;
	}
	var memoryRegion = this.mmu.getMemoryRegion(address);
	if (this.execMode == this.MODE_ARM) {
		var block = this.mmu.icache[memoryRegion];
		var offset = (this.mmu.maskOffset(address)) >> 1;
		compiled = block[offset];
		next = block[offset + 2];
		if (!compiled) {
			var instruction = this.mmu.iload32(address) >>> 0;
			compiled = this.compile(instruction);
			block[offset] = compiled;
			++mmu.memoryView[memoryRegion].cachedInstructions;
		}
		if (!next) {
			var instruction = this.mmu.iload32(address + this.WORD_SIZE_ARM) >>> 0;
			next = this.compile(instruction);
			block[offset + 2] = next;
			++mmu.memoryView[memoryRegion].cachedInstructions;
			this.prefetch.address = address + this.WORD_SIZE_ARM;
			this.prefetch.instruction = next;
		}
	} else {
		var block = this.mmu.icache[memoryRegion];
		var offset = (this.mmu.maskOffset(address)) >> 1;
		compiled = block[offset];
		next = block[offset + 1];
		if (!compiled) {
			var instruction = this.mmu.iload16(address);
			compiled = this.compileThumb(instruction);
			block[offset] = compiled;
			++mmu.memoryView[memoryRegion].cachedInstructions;
		}
		if (!next) {
			var instruction = this.mmu.iload16(address + this.WORD_SIZE_THUMB);
			next = this.compileThumb(instruction);
			block[offset + 1] = next;
			++mmu.memoryView[memoryRegion].cachedInstructions;
			this.prefetch.address = address + this.WORD_SIZE_THUMB;
			this.prefetch.instruction = next;
		}
	}
	return compiled;
};

ARMCore.prototype.step = function() {
	var instruction = this.loadInstruction(this.nextPC);
	if (instruction.touchesPC) {
		var nextPC = this.nextPC + this.instructionWidth;
		var shownPC = nextPC + this.instructionWidth;
		this.gprs[this.PC] = shownPC;

		instruction();

		if (this.gprs[this.PC] == shownPC) {
			this.nextPC = nextPC;
		} else {
			this.nextPC = this.gprs[this.PC] & 0xFFFFFFFE;
			if (this.execMode == this.MODE_ARM) {
				this.instructionWidth = this.WORD_SIZE_ARM;
			} else {
				this.instructionWidth = this.WORD_SIZE_THUMB;
			}
		}
	} else {
		instruction();
		this.nextPC += this.instructionWidth;
	}
	this.cycles += 1 + instruction.extraCycles;
};

ARMCore.prototype.switchMode = function(newMode) {
	//this.STUB("switchMode");
};

ARMCore.prototype.badOp = function(instruction) {
	return function() {
		throw "Illegal instruction: 0x" + instruction.toString(16);
	};
};

ARMCore.prototype.generateCond = function(cond) {
	var cpu = this;
	switch (cond) {
	case 0x0:
		// EQ
		return function() {
			return cpu.cpsrZ;
		};
	case 0x1:
		// NE
		return function() {
			return !cpu.cpsrZ;
		};
	case 0x2:
		// CS
		return function() {
			return cpu.cpsrC;
		};
	case 0x3:
		// CC
		return function() {
			return !cpu.cpsrC;
		};
	case 0x4:
		// MI
		return function() {
			return cpu.cpsrN;
		};
	case 0x5:
		// PL
		return function() {
			return !cpu.cpsrN;
		};
	case 0x6:
		// VS
		return function() {
			return cpu.cpsrV;
		};
	case 0x7:
		// VC
		return function() {
			return !cpu.cpsrV;
		};
	case 0x8:
		// HI
		return function () {
			return cpu.cpsrC && !cpu.cpsrZ;
		};
	case 0x9:
		// LS
		return function () {
			return !cpu.cpsrC || cpu.cpsrZ;
		};
	case 0xA:
		// GE
		return function () {
			return !cpu.cpsrN == !cpu.cpsrV;
		};
	case 0xB:
		// LT
		return function () {
			return !cpu.cpsrN != !cpu.cpsrV;
		};
	case 0xC:
		// GT
		return function () {
			return !cpu.cpsrZ && !cpu.cpsrN == !cpu.cpsrV;
		};
	case 0xD:
		// LE
		return function () {
			return cpu.cpsrZ || !cpu.cpsrN != !cpu.cpsrV;
		};
	case 0xE:
		// AL
	default:
		return null;
	}
}

ARMCore.prototype.compile = function(instruction) {
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
		op.extraCycles = this.PC_CYCLES;
		op.touchesPC = true;
		op.writeCpsr = false;
	} else if (!(instruction & 0x0C000000) && (i == 0x02000000 || (instruction & 0x00000090) != 0x00000090)) {
		var opcode = instruction & 0x01E00000;
		var s = instruction & 0x00100000;
		var shiftsRs = false;
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
							cpu.cpsrZ = operand & 0x40000000;
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
				shiftsRs = true;
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
		op.writeCpsr = s;
		op.extraCycles = op.touchesPC * this.PC_CYCLES + shiftsRs * this.SHIFT_RS_CYCLES;
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
						cpu.gprs[rd] = cpu.mmu.load32(a);
					};
				}
				op.extraCycles = this.LDR_CYCLES;
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
						cpu.mmu.store32(a, cpu.gprs[rd]);
					};
				}
				op.extraCycles = this.STR_CYCLES;
			}
			op.touchesPC = rn == this.PC || rd == this.PC;
			op.extraCycles += this.PC_CYCLES * op.touchesPC;
			op.writeCpsr = false;
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
			op.extraCycles = this.PC_CYCLES;
			op.touchesPC = true;
			op.writeCpsr = false;
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
	op.readCpsr = true;

	this.ASSERT(typeof(op.touchesPC) !== "undefined", "touchesPC undefined");
	this.ASSERT(typeof(op.extraCycles) !== "undefined", "extraCycles undefined");
	this.ASSERT(typeof(op.writeCpsr) !== "undefined", "writeCpsr undefined");

	return op;
};

ARMCore.prototype.compileThumb = function(instruction) {
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
			// LSL(2)
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
			// LSR(2)
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
			// ASR(2)
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
				cpu.cpsrC = 0 >= (cpu.gprs[rd] >>> 0);
				cpu.cpsrV = cpu.gprs[rm] & 0x800000000 && cpu.gprs[rd] & 0x80000000;
			};
			break;
		case 0x0280:
			// CMP(2)
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
		op.extraCycles = 0;
		op.readCpsr = false;
		op.writeCpsr = true;
	} else if ((instruction & 0xFC00) == 0x4400) {
		// Special data processing / branch/exchange instruction set
		var rm = (instruction & 0x0078) >> 3;
		var rn = instruction & 0x0007;
		var h1 = instruction & 0x0080;
		var rd = rn | (h1 >> 4);
		switch (instruction & 0x0300) {
		case 0x0000:
			// ADD(4)
			op = function() {
				cpu.gprs[rd] += cpu.gprs[rm];
			};
			op.touchesPC = (rm == this.PC) || (rd == this.PC);
			op.writeCpsr = false;
			break;
		case 0x0100:
			// CMP(3)
			op = function() {
				var aluOut = cpu.gprs[rd] - cpu.gprs[rm];
				cpu.cpsrN = aluOut & 0x80000000;
				cpu.cpsrZ = !aluOut;
				cpu.cpsrC = (cpu.gprs[rd] >>> 0) >= (cpu.gprs[rm] >>> 0);
				cpu.cpsrV = cpu.gprs[rd] & 0x80000000 != cpu.gprs[rm] & 0x800000000 &&
					        cpu.gprs[rd] & 0x80000000 != aluOut & 0x80000000;
			}
			op.touchesPC = (rm == this.PC) || (rd == this.PC);
			op.writeCpsr = true;
			break;
		case 0x0200:
			// MOV(3)
			op = function() {
				cpu.gprs[rd] = cpu.gprs[rm];
			};
			op.touchesPC = (rm == this.PC) || (rd == this.PC);
			op.writeCpsr = false;
			break;
		case 0x0300:
			// BX
			op = function() {
				cpu.execMode = cpu.gprs[rm] & 0x00000001;
				cpu.gprs[cpu.PC] = cpu.gprs[rm] & 0xFFFFFFFE;
			};
			op.touchesPC = true;
			op.writeCpsr = false;
			break;
		}
		op.extraCycles = op.touchesPC * this.PC_CYCLES;
		op.readCpsr = false;
	} else if ((instruction & 0xF800) == 0x1800) {
		// Add/subtract
		var rm = (instruction & 0x01C0) >> 6;
		var rn = (instruction & 0x0038) >> 3;
		var rd = instruction & 0x0007;
		switch (instruction & 0x0600) {
		case 0x0000:
			// ADD(3)
			op = function() {
				var d = (cpu.gprs[rn] >>> 0) + (cpu.gprs[rm] >>> 0);
				cpu.cpsrN = d & 0x80000000;
				cpu.cpsrZ = !d;
				cpu.cpsrC = d > 0xFFFFFFFF;
				cpu.cpsrV = (cpu.gprs[rn] & 0x80000000) == (cpu.gprs[rm] & 0x800000000) &&
				            (cpu.gprs[rn] & 0x80000000) != (d & 0x80000000) &&
				            (cpu.gprs[rm] & 0x80000000) != (d & 0x80000000);
				cpu.gprs[rd] = d;
			};
			break;
		case 0x0200:
			// SUB(3)
			op = function() {
				var d = cpu.gprs[rn] - cpu.gprs[rm];
				cpu.cpsrN = d & 0x80000000;
				cpu.cpsrZ = !d;
				cpu.cpsrC = (cpu.gprs[rn] >>> 0) >= (cpu.gprs[rm] >>> 0);
				cpu.cpsrV = cpu.gprs[rn] & 0x80000000 != cpu.gprs[rm] & 0x800000000 &&
							cpu.gprs[rn] & 0x80000000 != d & 0x80000000;
				cpu.gprs[rd] = d;
			};
			break;
		case 0x0400:
			var immediate = (instruction & 0x01C0) >> 6;
			if (immediate) {
				// ADD(1)
				op = function() {
					var d = (cpu.gprs[rn] >>> 0) + immediate;
					cpu.cpsrN = d & 0x80000000;
					cpu.cpsrZ = !d;
					cpu.cpsrC = d > 0xFFFFFFFF;
					cpu.cpsrV = (cpu.gprs[rn] & 0x80000000) == (immediate & 0x800000000) &&
								(cpu.gprs[rn] & 0x80000000) != (d & 0x80000000) &&
								(immediate & 0x80000000) != (d & 0x80000000);
					cpu.gprs[rd] = d;
				};
			} else {
				// MOV(2)
				op = function() {
					var d = (cpu.gprs[rn] >>> 0);
					cpu.cpsrN = d & 0x80000000;
					cpu.cpsrZ = !d;
					cpu.cpsrC = 0;
					cpu.cpsrV = 0;
					cpu.gprs[rd] = d;
				};
			}
			break;
		case 0x0600:
			// SUB(1)
			var immediate = (instruction & 0x01C0) >> 6;
			op = function() {
				var d = cpu.gprs[rn] - immediate;
				cpu.cpsrN = d & 0x80000000;
				cpu.cpsrZ = !d;
				cpu.cpsrC = (cpu.gprs[rn] >>> 0) >= immediate;
				cpu.cpsrV = cpu.gprs[rn] & 0x80000000 != immediate & 0x800000000 &&
				            cpu.gprs[rn] & 0x80000000 != d & 0x80000000;
				cpu.gprs[rd] = d;
			};
			break;
		}
		op.touchesPC = false;
		op.extraCycles = 0;
		op.readCpsr = false;
		op.writeCpsr = true;
	} else if (!(instruction & 0xE000)) {
		// Shift by immediate
		var rd = instruction & 0x0007;
		var rm = (instruction & 0x0038) >> 3;
		var immediate = (instruction & 0x07C0) >> 6;
		switch (instruction & 0x1800) {
		case 0x0000:
			// LSL(1)
			op = function() {
				if (immediate == 0) {
					cpu.gprs[rd] = cpu.gprs[rm];
				} else {
					cpu.cpsrC = cpu.gprs[rm] & (32 - immediate);
					cpu.gprs[rd] = cpu.gprs[rm] << immediate;
				}
				cpu.cpsrN = cpu.gprs[rd] & 0x80000000;
				cpu.cpsrZ = !cpu.gprs[rd];
			};
			break;
		case 0x0800:
			// LSR(1)
			op = function() {
				if (immediate == 0) {
					cpu.cpsrC = cpu.gprs[rm] & 0x80000000;
					cpu.gprs[rd] = 0;
				} else {
					cpu.cpsrC = cpu.gprs[rm] & (immediate - 1);
					cpu.gprs[rd] = cpu.gprs[rm] >>> immediate;
				}
				cpu.cpsrN = 0;
				cpu.cpsrZ = !cpu.gprs[rd];
			};
			break;
		case 0x1000:
			// ASR(1)
			op = function() {
				if (immediate == 0) {
					cpu.cpsrC = cpu.gprs[rm] & 0x80000000;
					if (cpu.cpsrC) {
						cpu.gprs[rd] = 0xFFFFFFFF;
					} else {
						cpu.gprs[rd] = 0;
					}
				} else {
					cpu.cpsrC = cpu.gprs[rm] & (immediate - 1);
					cpu.gprs[rd] = cpu.gprs[rm] >> immediate;
				}
				cpu.cpsrN = cpu.gprs[rd] & 0x80000000;
				cpu.cpsrZ = !cpu.gprs[rd];
			};
			break;
		case 0x1800:
			break;
		}
		op.touchesPC = false;
		op.extraCycles = 0;
		op.readCpsr = false;
		op.writeCpsr = true;
	} else if ((instruction & 0xE000) == 0x2000) {
		// Add/subtract/compare/move immediate
		var immediate = instruction & 0x00FF;
		var rn = (instruction & 0x0700) >> 8;
		switch (instruction & 0x1800) {
		case 0x0000:
			// MOV(1)
			op = function() {
				cpu.gprs[rn] = immediate;
				cpu.cpsrN = immediate & 0x80000000;
				cpu.cpsrZ = !immediate;
			};
			break;
		case 0x0800:
			// CMP(1)
			op = function() {
				var aluOut = cpu.gprs[rn] - immediate;
				cpu.cpsrN = aluOut & 0x80000000;
				cpu.cpsrZ = !aluOut;
				cpu.cpsrC = (cpu.gprs[rn] >>> 0) >= immediate;
				cpu.cpsrV = cpu.gprs[rn] & 0x80000000 != immediate & 0x800000000 &&
				            cpu.gprs[rn] & 0x80000000 != aluOut & 0x80000000;
			};
			break;
		case 0x1000:
			// ADD(2)
			op = function() {
				var d = (cpu.gprs[rn] >>> 0) + immediate;
				cpu.cpsrN = d & 0x80000000;
				cpu.cpsrZ = !d;
				cpu.cpsrC = d > 0xFFFFFFFF;
				cpu.cpsrV = (cpu.gprs[rn] & 0x80000000) == (immediate & 0x800000000) &&
							(cpu.gprs[rn] & 0x80000000) != (d & 0x80000000) &&
							(immediate & 0x80000000) != (d & 0x80000000);
				cpu.gprs[rn] = d;
			}
			break;
		case 0x1800:
			// SUB(2)
			op = function() {
				var d = cpu.gprs[rn] - immediate;
				cpu.cpsrN = d & 0x80000000;
				cpu.cpsrZ = !d;
				cpu.cpsrC = (cpu.gprs[rn] >>> 0) >= immediate;
				cpu.cpsrV = cpu.gprs[rn] & 0x80000000 != immediate &&
							cpu.gprs[rn] & 0x80000000 != d & 0x80000000;
				cpu.gprs[rn] = d;
			};
			break;
		}
		op.touchesPC = false;
		op.extraCycles = 0;
		op.readCpsr = false;
		op.writeCpsr = true;
	} else if ((instruction & 0xF800) == 0x4800) {
		// LDR(3)
		var rd = (instruction & 0x0700) >> 8;
		var immediate = (instruction & 0x00FF) << 2;
		op = function() {
			cpu.gprs[rd] = cpu.mmu.load32((cpu.gprs[cpu.PC] & 0xFFFFFFFC) + immediate);
		};
		op.touchesPC = true;
		op.extraCycles = this.LDR_CYCLES;
		op.readCpsr = false;
		op.writeCpsr = false;
	} else if ((instruction & 0xF200) == 0x5000) {
		// Load and store with relative offset
	} else if ((instruction & 0xF200) == 0x5200) {
		// Load and store sign-extend byte and halfword
	} else if ((instruction & 0xE000) == 0x6000) {
		// Load and store with immediate offset
		var rd = instruction & 0x0007;
		var rn = (instruction & 0x0038) >> 3;
		var immediate = (instruction & 0x07C0) >> 4;
		var b = instruction & 0x1000;
		var load = instruction & 0x0800;
		if (load) {
			if (b) {
				// LDRB(1)
				op = function() {
					cpu.gprs[rd] = cpu.mmu.loadU8(cpu.gprs[rn] + immediate);
				}
			} else {
				// LDR(1)
				op = function() {
					cpu.gprs[rd] = cpu.mmu.load32(cpu.gprs[rn] + immediate);
				}
			}
			op.extraCycles = this.LDR_CYCLES;
		} else {
			if (b) {
				// STRB(1)
				op = function() {
					cpu.mmu.store8(cpu.gprs[rn] + immediate, cpu.gprs[rd]);
				};
			} else {
				// STR(1)
				op = function() {
					cpu.mmu.store32(cpu.gprs[rn] + immediate, cpu.gprs[rd]);
				}
			}
			op.extraCycles = this.STR_CYCLES;
		}
		op.touchesPC = false;
		op.readCpsr = false;
		op.writeCpsr = false;
	} else if ((instruction & 0xF600) == 0xB400) {
		// Push and pop registers
		var r = instruction & 0x0100;
		var rs = instruction & 0x00FF;
		if (instruction & 0x0800) {
			// POP
			op = function() {
				var address = cpu.gprs[cpu.SP];
				var m, i;
				for (m = 0x01, i = 0; i < 8; m <<= 1, ++i) {
					if (rs & m) {
						cpu.gprs[i] = cpu.mmu.load32(address);
						address += 4;
					}
				}
				if (r) {
					cpu.gprs[cpu.PC] = cpu.mmu.load32(address) & 0xFFFFFFFE;
				}
				cpu.gprs[cpu.SP] = address;
			};
			op.touchesPC = r;
			op.extraCycles = this.LDR_CYCLES + op.touchesPC ? this.PC_CYCLES : 0;
			for (var x = rs; x; x >>= 1) {
				if (x & 1) {
					++op.extraCycles;
				}
			}
		} else {
			// PUSH
			op = function() {
				var address = cpu.gprs[cpu.SP] - 4;
				if (r) {
					cpu.mmu.store32(address, cpu.gprs[cpu.LR]);
					address -= 4;
				}
				var m, i;
				for (m = 0x80, i = 7; m; m >>= 1, --i) {
					if (rs & m) {
						cpu.mmu.store32(address, cpu.gprs[i]);
						address -= 4;
					}
				}
				cpu.gprs[cpu.SP] = address + 4;
			};
			op.touchesPC = false;
			op.extraCycles = this.STR_CYCLES;
			for (var x = rs; x; x >>= 1) {
				if (x & 1) {
					++op.extraCycles;
				}
			}
		}
		op.readCpsr = false;
		op.writeCpsr = false;
	} else if ((instruction & 0xF800) == 0xE000) {
		// B(2)
		var immediate = instruction & 0x07FF;
		if (immediate & 0x0400) {
			immediate |= 0xFFFFF800;
		}
		immediate <<= 1;
		op = function() {
			cpu.gprs[cpu.PC] += immediate;
		};
		op.touchesPC = true;
		op.extraCycles = this.PC_CYCLES;
		op.readCpsr = false;
		op.writeCpsr = false;
	} else if (instruction & 0x8000) {
		switch (instruction & 0x7000) {
		case 0x0000:
			// Load and store halfword
			var rd = instruction & 0x0007;
			var rn = (instruction & 0x0038) >> 3;
			var immediate = (instruction & 0x07C0) >> 5;
			if (instruction & 0x0800) {
				// LDRH(1)
				op = function() {
					cpu.gprs[rd] = cpu.mmu.loadU16(cpu.gprs[rn] + immediate);
				};
				op.extraCycles = this.LDR_CYCLES;
			} else {
				// STRH(1)
				op = function() {
					cpu.mmu.store16(cpu.gprs[rn] + immediate, cpu.gprs[rd]);
				};
				op.extraCycles = this.STR_CYCLES;
			}
			op.touchesPC = false;
			op.readCpsr = false;
			op.writeCpsr = false;
			break;
		case 0x1000:
			// SP-relative load and store
			var rd = (instruction & 0x0700) >> 8;
			var immediate = (instruction & 0x00FF) << 2;
			var load = instruction & 0x0800;
			if (load) {
				// LDR(4)
				op = function() {
					cpu.gprs[rd] = cpu.mmu.load32(cpu.gprs[cpu.SP] + immediate);
				}
				op.extraCycles = this.LDR_CYCLES;
			} else {
				// STR(3)
				op = function() {
					cpu.mmu.store32(cpu.gprs[cpu.SP] + immediate, cpu.gprs[rd]);
				}
				op.extraCycles = this.STR_CYCLES;
			}
			op.touchesPC = false;
			op.readCpsr = false;
			op.writeCpsr = false;
			break;
		case 0x2000:
			// Load address
			if (instruction & 0x0800) {
				// ADD(6)
				var rd = (instruction & 0x0700) >> 8;
				var immediate = (instruction & 0x00FF) << 2;
				op = function() {
					cpu.gprs[rd] = cpu.gprs[cpu.SP] + immediate;
				};
				op.touchesPC = false;
				op.extraCycles = this.STR_CYCLES;
				op.readCpsr = false;
				op.writeCpsr = false;
			}
			break;
		case 0x3000:
			// Miscellaneous
			if (!(instruction & 0x0F00)) {
				// Adjust stack pointer
				// ADD(7)/SUB(4)
				var b = instruction & 0x0080;
				var immediate = (instruction & 0x7F) << 2;
				if (b) {
					immediate = -immediate;
				}
				op = function() {
					cpu.gprs[cpu.SP] += immediate;
				};
				op.touchesPC = false;
				op.extraCycles = 0;
				op.readCpsr = false;
				op.writeCpsr = false;
			}
			break;
		case 0x4000:
			// Multiple load and store
			var rn = (instruction & 0x0700) >> 8;
			var rs = instruction & 0x00FF;
			if (instruction & 0x0800) {
				// LDMIA
				op = function() {
					var address = cpu.gprs[rn];
					var m, i;
					for (m = 0x01, i = 0; i < 8; m <<= 1, ++i) {
						if (rs & m) {
							cpu.gprs[i] = cpu.mmu.load32(address);
							address += 4;
						}
					}
					cpu.gprs[rn] = address;
				};
				op.extraCycles = this.LDR_CYCLES;
				for (var x = rs; x; x >>= 1) {
					if (x & 1) {
						++op.extraCycles;
					}
				}
			} else {
				// STMIA
				op = function() {
					var address = cpu.gprs[rn];
					var m, i;
					for (m = 0x01, i = 0; i < 8; m <<= 1, ++i) {
						if (rs & m) {
							cpu.mmu.store32(address, cpu.gprs[i]);
							address += 4;
						}
					}
					cpu.gprs[rn] = address;
				};
				op.extraCycles = this.STR_CYCLES;
				for (var x = rs; x; x >>= 1) {
					if (x & 1) {
						++op.extraCycles;
					}
				}
			}
			op.touchesPC = false;
			op.readCpsr = false;
			op.writeCpsr = false;
			break;
		case 0x5000:
			// Conditional branch
			var cond = (instruction & 0x0F00) >> 8;
			var immediate = (instruction & 0x00FF);
			if (cond == 0xF) {
				// SWI
				op = function() {
					cpu.irq.swi(immediate);
				}
				op.touchesPC = false;
				op.extraCycles = 0;
				op.readCpsr = false;
				op.writeCpsr = false;
			} else {
				// B(1)
				if (instruction & 0x0080) {
					immediate |= 0xFFFFFF00;
				}
				immediate <<= 1;
				var condOp = this.generateCond(cond);
				op = function() {
					if (condOp()) {
						cpu.gprs[cpu.PC] += immediate;
					}
				}
				op.touchesPC = true;
				op.extraCycles = this.PC_CYCLES;
				op.readCpsr = false;
				op.writeCpsr = false;
			}
			break;
		case 0x6000:
		case 0x7000:
			// BL(X)
			var immediate = instruction & 0x07FF;
			var h = instruction & 0x1800;
			switch (h) {
			case 0x0800:
				// BLX (ARMv5T)
				/*op = function() {
					var pc = cpu.gprs[cpu.PC];
					cpu.gprs[cpu.PC] = (cpu.gprs[cpu.LR] + (immediate << 1)) & 0xFFFFFFFC;
					cpu.gprs[cpu.LR] = pc - 1;
					cpu.execMode = cpu.MODE_ARM;
				}*/
				break;
			case 0x1000:
				// BL(1)
				if (immediate & 0x0400) {
					immediate |= 0xFFFFFC00;
				}
				immediate <<= 12;
				op = function() {
					cpu.gprs[cpu.LR] = cpu.gprs[cpu.PC] + immediate;
				}
				break;
			case 0x1800:
				// BL(2)
				op = function() {
					var pc = cpu.gprs[cpu.PC];
					cpu.gprs[cpu.PC] = (cpu.gprs[cpu.LR] + (immediate << 1)) & 0xFFFFFFFC;
					cpu.gprs[cpu.LR] = pc - 1;
				}
				break;
			}
			op.touchesPC = true;
			op.extraCycles = this.B_THUMB_CYCLES;
			op.readCpsr = false;
			op.writeCpsr = false;
			break;
		default:
			this.WARN("Undefined instruction: 0x" + instruction.toString(16));
		}
	} else {
		this.ASSERT_UNREACHED("Bad opcode: 0x" + instruction.toString(16));
	}

	this.ASSERT(typeof(op.touchesPC) !== "undefined", "touchesPC undefined");
	this.ASSERT(typeof(op.extraCycles) !== "undefined", "extraCycles undefined");
	this.ASSERT(typeof(op.readCpsr) !== "undefined", "readCpsr undefined");
	this.ASSERT(typeof(op.writeCpsr) !== "undefined", "writeCpsr undefined");

	return op;
};
