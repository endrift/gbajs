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

	this.BANK_NONE = 0
	this.BANK_FIQ = 1;
	this.BANK_IRQ = 2;
	this.BANK_SUPERVISOR = 3;
	this.BANK_ABORT = 4;
	this.BANK_UNDEFINED = 5;

	this.UNALLOC_MASK = 0x0FFFFF00;
	this.USER_MASK = 0xF0000000;
	this.PRIV_MASK = 0x0000000F; // TODO: this prevents MSR from setting status bits
	this.STATE_MASK = 0x00000020;

	this.WORD_SIZE_ARM = 4;
	this.WORD_SIZE_THUMB = 2;

	this.log = function () {}
};

ARMCore.prototype.WARN = function(warn) {
	this.log("[WARNING] " + warn);
};

ARMCore.prototype.STUB = function(func) {
	this.log("[STUB] Unimplemented function: " + func);
};

ARMCore.prototype.OP_STUB = function(op) {
	this.log("[STUB] Unimplemented opcode: " + op);
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
	this.gprs[this.PC] = startOffset + this.WORD_SIZE_ARM;

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

	this.currentBank = null;
	this.bankedRegisters = [
		new Int32Array(7),
		new Int32Array(7),
		new Int32Array(2),
		new Int32Array(2),
		new Int32Array(2),
		new Int32Array(2)
	];
	this.spsr = new Int32Array(5);

	this.cycles = 0;

	this.shifterOperand = 0;
	this.shifterCarryOut = 0;

	this.mmu.clear();

	this.prefetch0 = null;
	this.prefetch1 = null;
};

ARMCore.prototype.setLogger = function(logger) {
	this.log = logger;
}

ARMCore.prototype.prefetch = function(address) {
	var compiled = null;
	var next = null;
	var memoryRegion = address >> this.mmu.BASE_OFFSET;
	if (this.execMode == this.MODE_ARM) {
		var block = this.mmu.icache[memoryRegion];
		var offset = (address & this.mmu.OFFSET_MASK) >> 1;
		compiled = block[offset];
		next = block[offset + 2];
		if (!compiled || compiled.execMode != this.MODE_ARM) {
			var instruction = this.mmu.load32(address) >>> 0;
			compiled = this.compile(instruction);
			block[offset] = compiled;
			++mmu.memoryView[memoryRegion].cachedInstructions;
		}
		this.prefetch0 = compiled;
		if (!next || next.execMode != this.MODE_ARM) {
			var instruction = this.mmu.load32(address + this.WORD_SIZE_ARM) >>> 0;
			next = this.compile(instruction);
			block[offset + 2] = next;
			++mmu.memoryView[memoryRegion].cachedInstructions;
		}
		this.prefetch1 = next;
	} else {
		var block = this.mmu.icache[memoryRegion];
		var offset = (address & this.mmu.OFFSET_MASK) >> 1;
		compiled = block[offset];
		next = block[offset + 1];
		if (!compiled || compiled.execMode != this.MODE_THUMB) {
			var instruction = this.mmu.load16(address);
			compiled = this.compileThumb(instruction);
			block[offset] = compiled;
			++mmu.memoryView[memoryRegion].cachedInstructions;
		}
		this.prefetch0 = compiled;
		if (!next || next.execMode != this.MODE_THUMB) {
			var instruction = this.mmu.load16(address + this.WORD_SIZE_THUMB);
			next = this.compileThumb(instruction);
			block[offset + 1] = next;
			++mmu.memoryView[memoryRegion].cachedInstructions;
		}
		this.prefetch1 = next;
	}
};

ARMCore.prototype.prefetchNext = function(address) {
	var next = null;
	var memoryRegion = address >> this.mmu.BASE_OFFSET;
	if (this.execMode == this.MODE_ARM) {
		var block = this.mmu.icache[memoryRegion];
		var offset = (address & this.mmu.OFFSET_MASK) >> 1;
		next = block[offset];
		if (!next) {
			var instruction = this.mmu.load32(address) >>> 0;
			next = this.compile(instruction);
			block[offset] = next;
			++mmu.memoryView[memoryRegion].cachedInstructions;
		}
		this.prefetch1 = next;
	} else {
		var block = this.mmu.icache[memoryRegion];
		var offset = (address & this.mmu.OFFSET_MASK) >> 1;
		next = block[offset];
		if (!next) {
			var instruction = this.mmu.load16(address);
			next = this.compileThumb(instruction);
			block[offset] = next;
			++mmu.memoryView[memoryRegion].cachedInstructions;
		}
		this.prefetch1 = next;
	}
};

ARMCore.prototype.step = function() {
	var instruction = this.prefetch0;
	this.prefetch0 = this.prefetch1;
	this.gprs[this.PC] += this.instructionWidth;
	this.prefetchNext(this.gprs[this.PC]);
	this.conditionPassed = true;
	instruction();

	if (instruction.writesPC && this.conditionPassed) {;
		this.gprs[this.PC] &= 0xFFFFFFFE;
		var pc = this.gprs[this.PC];
		this.prefetch(pc);
		if (this.execMode == this.MODE_ARM) {
			this.instructionWidth = this.WORD_SIZE_ARM;
			this.mmu.wait32(pc);
			this.mmu.waitSeq32(pc);
		} else {
			this.instructionWidth = this.WORD_SIZE_THUMB;
			this.mmu.wait(pc);
			this.mmu.waitSeq(pc);
		}
		this.gprs[this.PC] += this.instructionWidth;
	}
	this.irq.updateTimers();
};

ARMCore.prototype.selectBank = function(mode) {
	switch (mode) {
	case this.MODE_USER:
	case this.MODE_SYSTEM:
		// No banked registers
		return this.BANK_NONE;
	case this.MODE_FIQ:
		return this.BANK_FIQ;
	case this.MODE_IRQ:
		return this.BANK_IRQ;
	case this.MODE_SUPERVISOR:
		return this.BANK_SUPERVISOR;
	case this.MODE_ABORT:
		return this.BANK_ABORT;
	case this.MODE_UNDEFINED:
		return this.BANK_UNDEFINED;
	default:
		throw "Invalid user mode passed to selectBank";
	}
};

ARMCore.prototype.switchMode = function(newMode) {
	if (newMode == this.mode) {
		// Not switching modes after all
		return;
	}
	if (newMode != this.MODE_USER || newMode != this.MODE_SYSTEM) {
		// Switch banked registers
		var newBank = this.selectBank(newMode);
		var oldBank = this.selectBank(this.mode);
		if (newBank != oldBank) {
			// TODO: support FIQ
			if (newMode == this.FIQ || this.mode == this.FIQ) {
				this.log('FIQ mode switching is unimplemented');
			}
			oldBank[0] = this.gprs[this.SP];
			oldBank[1] = this.gprs[this.LR];
			this.gprs[this.SP] = newBank[0];
			this.gprs[this.LR] = newBank[1];

			// TODO: support SPSR
			this.log('SPSR switching is unimplemented');
		}
	}
	this.mode = newMode;
};

ARMCore.prototype.raiseIRQ = function() {
	throw "Interrupts are not yet implemented";
};

ARMCore.prototype.badOp = function(instruction) {
	var func = function() {
		throw "Illegal instruction: 0x" + instruction.toString(16);
	};
	func.writesPC = true;
	return func;
};

ARMCore.prototype.generateCond = function(cond) {
	var cpu = this;
	switch (cond) {
	case 0x0:
		// EQ
		return function() {
			return cpu.conditionPassed = cpu.cpsrZ;
		};
	case 0x1:
		// NE
		return function() {
			return cpu.conditionPassed = !cpu.cpsrZ;
		};
	case 0x2:
		// CS
		return function() {
			return cpu.conditionPassed = cpu.cpsrC;
		};
	case 0x3:
		// CC
		return function() {
			return cpu.conditionPassed = !cpu.cpsrC;
		};
	case 0x4:
		// MI
		return function() {
			return cpu.conditionPassed = cpu.cpsrN;
		};
	case 0x5:
		// PL
		return function() {
			return cpu.conditionPassed = !cpu.cpsrN;
		};
	case 0x6:
		// VS
		return function() {
			return cpu.conditionPassed = cpu.cpsrV;
		};
	case 0x7:
		// VC
		return function() {
			return cpu.conditionPassed = !cpu.cpsrV;
		};
	case 0x8:
		// HI
		return function () {
			return cpu.conditionPassed = cpu.cpsrC && !cpu.cpsrZ;
		};
	case 0x9:
		// LS
		return function () {
			return cpu.conditionPassed = !cpu.cpsrC || cpu.cpsrZ;
		};
	case 0xA:
		// GE
		return function () {
			return cpu.conditionPassed = !cpu.cpsrN == !cpu.cpsrV;
		};
	case 0xB:
		// LT
		return function () {
			return cpu.conditionPassed = !cpu.cpsrN != !cpu.cpsrV;
		};
	case 0xC:
		// GT
		return function () {
			return cpu.conditionPassed = !cpu.cpsrZ && !cpu.cpsrN == !cpu.cpsrV;
		};
	case 0xD:
		// LE
		return function () {
			return cpu.conditionPassed = cpu.cpsrZ || !cpu.cpsrN != !cpu.cpsrV;
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
				cpu.mmu.waitSeq32(cpu.gprs[cpu.PC]);
				return;
			}
			cpu.execMode = cpu.gprs[rm] & 0x00000001;
			cpu.gprs[cpu.PC] = cpu.gprs[rm] & 0xFFFFFFFE;
			cpu.mmu.waitSeq32(cpu.gprs[cpu.PC]);
			cpu.mmu.wait32(cpu.gprs[cpu.PC]);
		};
		op.writesPC = true;
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
					cpu.mmu.waitSeq32(cpu.gprs[cpu.PC]);
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
				op.writesPC = false;
			}
		} else {
			// Data processing/FSR transfer
			var rn = (instruction & 0x000F0000) >> 16;
			var rd = (instruction & 0x0000F000) >> 12;

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
				shiftsRs = true;
				switch (shiftType) {
				case 0:
					// LSL
					shiftOp = function() {
						++cpu.cycles;
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
						++cpu.cycles;
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
						++cpu.cycles;
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
						++cpu.cycles;
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
					cpu.mmu.waitSeq32(cpu.gprs[cpu.PC]);
					if (condOp && !condOp()) {
						return;
					}
					shiftOp();
					cpu.gprs[rd] = cpu.gprs[rn] & cpu.shifterOperand;
					if (s) {
						cpu.cpsrN = cpu.gprs[rd] & 0x80000000;
						cpu.cpsrZ = !(cpu.gprs[rd] & 0xFFFFFFFF);
						cpu.cpsrC = cpu.shifterCarryOut;
					}
				};
				break;
			case 0x00200000:
				// EOR
				op = function() {
					cpu.mmu.waitSeq32(cpu.gprs[cpu.PC]);
					if (condOp && !condOp()) {
						return;
					}
					shiftOp();
					cpu.gprs[rd] = cpu.gprs[rn] ^ cpu.shifterOperand;
					if (s) {
						cpu.cpsrN = cpu.gprs[rd] & 0x80000000;
						cpu.cpsrZ = !(cpu.gprs[rd] & 0xFFFFFFFF);
						cpu.cpsrC = cpu.shifterCarryOut;
					}
				};
				break;
			case 0x00400000:
				// SUB
				op = function() {
					cpu.mmu.waitSeq32(cpu.gprs[cpu.PC]);
					if (condOp && !condOp()) {
						return;
					}
					shiftOp();
					var d = cpu.gprs[rn] - cpu.shifterOperand;
					if (s) {
						cpu.cpsrN = d & 0x80000000;
						cpu.cpsrZ = !(d & 0xFFFFFFFF);
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
					cpu.mmu.waitSeq32(cpu.gprs[cpu.PC]);
					if (condOp && !condOp()) {
						return;
					}
					shiftOp();
					var d = cpu.shifterOperand - cpu.gprs[rn];
					if (s) {
						cpu.cpsrN = d & 0x80000000;
						cpu.cpsrZ = !(d & 0xFFFFFFFF);
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
					cpu.mmu.waitSeq32(cpu.gprs[cpu.PC]);
					if (condOp && !condOp()) {
						return;
					}
					shiftOp();
					var d = (cpu.gprs[rn] >>> 0) + (cpu.shifterOperand >>> 0);
					if (s) {
						cpu.cpsrN = d & 0x80000000;
						cpu.cpsrZ = !(d & 0xFFFFFFFF);
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
					cpu.mmu.waitSeq32(cpu.gprs[cpu.PC]);
					if (condOp && !condOp()) {
						return;
					}
					shiftOp();
					var shifterOperand = (cpu.shifterOperand >>> 0) + !!cpu.cpsrC;
					var d = (cpu.gprs[rn] >>> 0) + shifterOperand;
					if (s) {
						cpu.cpsrN = d & 0x80000000;
						cpu.cpsrZ = !(d & 0xFFFFFFFF);
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
					cpu.mmu.waitSeq32(cpu.gprs[cpu.PC]);
					if (condOp && !condOp()) {
						return;
					}
					shiftOp();
					var shifterOperand = (cpu.shifterOperand >>> 0) + !cpu.cpsrC;
					var d = (cpu.gprs[rn] >>> 0) - shifterOperand;
					if (s) {
						cpu.cpsrN = d & 0x80000000;
						cpu.cpsrZ = !(d & 0xFFFFFFFF);
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
					cpu.mmu.waitSeq32(cpu.gprs[cpu.PC]);
					if (condOp && !condOp()) {
						return;
					}
					shiftOp();
					var n = (cpu.gprs[rn] >>> 0) + !cpu.cpsrC;
					var d = (cpu.shifterOperand >>> 0) - n;
					if (s) {
						cpu.cpsrN = d & 0x80000000;
						cpu.cpsrZ = !(d & 0xFFFFFFFF);
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
					cpu.mmu.waitSeq32(cpu.gprs[cpu.PC]);
					if (condOp && !condOp()) {
						return;
					}
					shiftOp();
					var aluOut = cpu.gprs[rn] & cpu.shifterOperand;
					cpu.cpsrN = aluOut & 0x80000000;
					cpu.cpsrZ = !(aluOut & 0xFFFFFFFF);
					cpu.cpsrC = cpu.shifterCarryOut;
				};
				break;
			case 0x01200000:
				// TEQ
				op = function() {
					cpu.mmu.waitSeq32(cpu.gprs[cpu.PC]);
					if (condOp && !condOp()) {
						return;
					}
					shiftOp();
					var aluOut = cpu.gprs[rn] ^ cpu.shifterOperand;
					cpu.cpsrN = aluOut & 0x80000000;
					cpu.cpsrZ = !(aluOut & 0xFFFFFFFF);
					cpu.cpsrC = cpu.shifterCarryOut;
				};
				break;
			case 0x01400000:
				// CMP
				op = function() {
					cpu.mmu.waitSeq32(cpu.gprs[cpu.PC]);
					if (condOp && !condOp()) {
						return;
					}
					shiftOp();
					var aluOut = cpu.gprs[rn] - cpu.shifterOperand;
					cpu.cpsrN = aluOut & 0x80000000;
					cpu.cpsrZ = !(aluOut & 0xFFFFFFFF);
					cpu.cpsrC = (cpu.gprs[rn] >>> 0) >= (cpu.shifterOperand >>> 0);
					cpu.cpsrV = cpu.gprs[rn] & 0x80000000 != cpu.shifterOperand & 0x800000000 &&
								cpu.gprs[rn] & 0x80000000 != aluOut & 0x80000000;
				};
				break;
			case 0x01600000:
				// CMN
				op = function() {
					cpu.mmu.waitSeq32(cpu.gprs[cpu.PC]);
					if (condOp && !condOp()) {
						return;
					}
					shiftOp();
					var aluOut = (cpu.gprs[rn] >>> 0) + (cpu.shifterOperand >>> 0);
					cpu.cpsrN = aluOut & 0x80000000;
					cpu.cpsrZ = !(aluOut & 0xFFFFFFFF);
					cpu.cpsrC = aluOut > 0xFFFFFFFF;
					cpu.cpsrV = cpu.gprs[rn] & 0x80000000 == cpu.shifterOperand & 0x800000000 &&
								cpu.gprs[rn] & 0x80000000 != aluOut & 0x80000000 &&
								cpu.shifterOperand & 0x80000000 != aluOut & 0x80000000;
				};
				break;
			case 0x01800000:
				// ORR
				op = function() {
					cpu.mmu.waitSeq32(cpu.gprs[cpu.PC]);
					if (condOp && !condOp()) {
						return;
					}
					shiftOp();
					cpu.gprs[rd] = cpu.gprs[rn] | cpu.shifterOperand;
					if (s) {
						cpu.cpsrN = cpu.gprs[rd] & 0x80000000;
						cpu.cpsrZ = !(cpu.gprs[rd] & 0xFFFFFFFF);
					}
				};
				break;
			case 0x01A00000:
				// MOV
				op = function() {
					cpu.mmu.waitSeq32(cpu.gprs[cpu.PC]);
					if (condOp && !condOp()) {
						return;
					}
					shiftOp();
					cpu.gprs[rd] = cpu.shifterOperand;
					if (s) {
						cpu.cpsrN = cpu.gprs[rd] & 0x80000000;
						cpu.cpsrZ = !(cpu.gprs[rd] & 0xFFFFFFFF);
						cpu.cpsrC = cpu.shifterCarryOut;
					}
				};
				break;
			case 0x01C00000:
				// BIC
				op = function() {
					cpu.mmu.waitSeq32(cpu.gprs[cpu.PC]);
					if (condOp && !condOp()) {
						return;
					}
					shiftOp();
					cpu.gprs[rd] = cpu.gprs[rn] & ~cpu.shifterOperand;
					if (s) {
						cpu.cpsrN = cpu.gprs[rd] & 0x80000000;
						cpu.cpsrZ = !(cpu.gprs[rd] & 0xFFFFFFFF);
						cpu.cpsrC = cpu.shifterCarryOut;
					}
				};
				break;
			case 0x01E00000:
				// MVN
				op = function() {
					cpu.mmu.waitSeq32(cpu.gprs[cpu.PC]);
					if (condOp && !condOp()) {
						return;
					}
					shiftOp();
					cpu.gprs[rd] = ~cpu.shifterOperand;
					if (s) {
						cpu.cpsrN = cpu.gprs[rd] & 0x80000000;
						cpu.cpsrZ = !(cpu.gprs[rd] & 0xFFFFFFFF);
						cpu.cpsrC = aluOut > cpu.shifterCarryOut;
					}
				};
				break;
			}
			op.writesPC = rd == this.PC;
		}
	} else if ((instruction & 0x0FB00FF0) == 0x01000090) {
		// Single data swap
	} else {
		switch (i) {
		case 0x00000000:
			if ((instruction & 0x010000F0) == 0x00000090) {
				// Multiplies
				var s = instruction & 0x00100000;
				var rd = (instruction & 0x000F0000) >> 16;
				var rn = (instruction & 0x0000F000) >> 12;
				var rs = (instruction & 0x00000F00) >> 8;
				var rm = instruction & 0x0000000F;
				switch (instruction & 0x00E00000) {
				case 0x00000000:
					// MUL
					op = function() {
						// TODO: timings
						if ((cpu.gprs[rm] & 0xFFFF0000) && (cpu.gprs[rs] & 0xFFFF0000)) {
							// Our data type is a double--we'll lose bits if we do it all at once!
							var hi = ((cpu.gprs[rm] & 0xFFFF0000) * cpu.gprs[rs]) & 0xFFFFFFFF;
							var lo = ((cpu.gprs[rm] & 0x0000FFFF) * cpu.gprs[rs]) & 0xFFFFFFFF;
							cpu.gprs[rd] = (hi + lo) & 0xFFFFFFFF;
						} else {
							cpu.gprs[rd] = cpu.gprs[rm] * cpu.gprs[rs];
						}
						if (s) {
							cpu.cpsrN = cpu.gprs[rd] & 0x80000000;
							cpu.cpsrZ = !(cpu.gprs[rd] & 0xFFFFFFFF);
						}
					};
					break;
				}
				op.touchesPC = rd == this.PC;
			} else {
				// Halfword and signed byte data transfer
				var load = instruction & 0x00100000;
				var rn = (instruction & 0x000F0000) >> 16;
				var rd = (instruction & 0x0000F000) >> 12;
				var hiOffset = (instruction & 0x00000F00) >> 4;
				var loOffset = rm = instruction & 0x0000000F;
				var h = instruction & 0x00000020;
				var s = instruction & 0x00000040;
				var w = instruction & 0x00200000;
				var i = instruction & 0x00400000;
				var u = instruction & 0x00800000;
				var p = instruction & 0x01000000;

				var address;
				if (i) {
					var immediate = loOffset | hiOffset;
					if (p) {
						if (u) {
							address = function() {
								var addr = cpu.gprs[rn] + immediate;
								if (w && (!condOp || condOp())) {
									cpu.gprs[rn] = addr;
								}
								return addr;
							};
						} else {
							address = function() {
								var addr = cpu.gprs[rn] - immediate;
								if (w && (!condOp || condOp())) {
									cpu.gprs[rn] = addr;
								}
								return addr;
							};
						}
					} else {
						if (u) {
							address = function() {
								var addr = cpu.gprs[rn];
								if (w && (!condOp || condOp())) {
									cpu.gprs[rn] += immediate;
								}
								return addr;
							};
						} else {
							address = function() {
								var addr = cpu.gprs[rn];
								if (w && (!condOp || condOp())) {
									cpu.gprs[rn] -= immediate;
								}
								return addr;
							};
						}
					}
				} else {
					var rn = (instruction & 0x000F0000) >> 16;
					if (p) {
						if (u) {
							address = function() {
								var addr = cpu.gprs[rn] + cpu.gprs[rm];
								if (w && (!condOp || condOp())) {
									cpu.gprs[rn] = addr;
								}
								return addr;
							};
						} else {
							address = function() {
								var addr = cpu.gprs[rn] - cpu.gprs[rm];
								if (w && (!condOp || condOp())) {
									cpu.gprs[rn] = addr;
								}
								return addr;
							};
						}
					} else {
						if (u) {
							address = function() {
								var addr = cpu.gprs[rn];
								if (w && (!condOp || condOp())) {
									cpu.gprs[rn] += cpu.gprs[rm];
								}
								return addr;
							};
						} else {
							address = function() {
								var addr = cpu.gprs[rn];
								if (w && (!condOp || condOp())) {
									cpu.gprs[rn] -= cpu.gprs[rm];
								}
								return addr;
							};
						}
					}
				}
				address.writesPC = w && rn == this.PC;

				if ((instruction & 0x00000090) == 0x00000090) {
					if (load) {
						// Load [signed] halfword/byte
						if (h) {
							if (s) {
								op = function() {
									cpu.mmu.waitSeq32(cpu.gprs[cpu.PC]);
									if (condOp && !condOp()) {
										return;
									}
									var addr = address();
									cpu.mmu.wait32(addr);
									++cpu.cycles;
									cpu.gprs[rd] = cpu.mmu.load16(addr);
								};
							} else {
								op = function() {
									cpu.mmu.waitSeq32(cpu.gprs[cpu.PC]);
									if (condOp && !condOp()) {
										return;
									}
									var addr = address();
									cpu.mmu.wait32(addr);
									++cpu.cycles;
									cpu.gprs[rd] = cpu.mmu.loadU16(addr);
								};
							}
						} else {
							if (s) {
								op = function() {
									cpu.mmu.waitSeq32(cpu.gprs[cpu.PC]);
									if (condOp && !condOp()) {
										return;
									}
									var addr = address();
									cpu.mmu.wait32(addr);
									++cpu.cycles;
									cpu.gprs[rd] = cpu.mmu.load8(addr);
								};
							}
						}
					} else if (!s && h) {
						// Store halfword
						op = function() {
							if (condOp && !condOp()) {
								cpu.mmu.waitSeq32(cpu.gprs[cpu.PC]);
								return;
							}
							var addr = address();
							cpu.mmu.wait32(addr);
							cpu.mmu.wait32(cpu.gprs[cpu.PC]);
							cpu.gprs[rd] = cpu.mmu.store16(addr, cpu.gprs[rd]);
						};
					}
				}
				op.writesPC = rd == this.PC || address.writesPC;
			}
			break;
		case 0x04000000:
		case 0x06000000:
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
				// Register offset
				var rm = instruction & 0x0000000F;
				var shiftType = instruction & 0x00000060;
				var shiftImmediate = instruction & 0x00000F80;
				if (p) {
					if (shiftType || shiftImmediate) {
					} else {
						if (u) {
							address = function() {
								var addr = cpu.gprs[rn] + cpu.gprs[rm];
								if (w && (!condOp || condOp())) {
									cpu.gprs[rn] = addr;
								}
								return addr;
							};
						} else {
							address = function() {
								var addr = cpu.gprs[rn] - cpu.gprs[rm];
								if (w && (!condOp || condOp())) {
									cpu.gprs[rn] = addr;
								}
								return addr;
							};
						}
						address.writesPC = w && rn == this.PC;
					}
				} else {
					if (shiftType || shiftImmediate) {
					} else {
						if (u) {
							address = function() {
								var addr = cpu.gprs[rn];
								if (!condOp || condOp()) {
									cpu.gprs[rn] += cpu.gprs[rm];
								}
								return addr;
							};
						} else {
							address = function() {
								var addr = cpu.gprs[rn];
								if (!condOp || condOp()) {
									cpu.gprs[rn] -= cpu.gprs[rm];
								}
								return addr;
							};
						}
						address.writesPC = rn == this.PC;
					}
				}
			} else {
				// Immediate
				var offset = instruction & 0x00000FFF;
				if (p) {
					if (u) {
						address = function() {
							var addr = cpu.gprs[rn] + offset;
							if (w && (!condOp || condOp())) {
								cpu.gprs[rn] = addr;
							}
							return addr;
						};
					} else {
						address = function() {
							var addr = cpu.gprs[rn] - offset;
							if (w && (!condOp || condOp())) {
								cpu.gprs[rn] = addr;
							}
							return addr;
						};
					}
					address.writesPC = w && rn == this.PC;
				} else if (!w) {
					if (u) {
						address = function() {
							var addr = cpu.gprs[rn];
							if (!condOp || condOp()) {
								cpu.gprs[rn] += offset;
							}
							return addr;
						};
					} else {
						address = function() {
							var addr = cpu.gprs[rn];
							if (!condOp || condOp()) {
								cpu.gprs[rn] -= offset;
							}
							return addr;
						};
					}
					address.writesPC = rn == this.PC;
				}
			}
			if (load) {
				if (b) {
					// LDRB
					op = function() {
						cpu.mmu.waitSeq32(cpu.gprs[cpu.PC]);
						if (condOp && !condOp()) {
							return;
						}
						var addr = address();
						cpu.mmu.wait32(addr);
						++cpu.cycles;
						cpu.gprs[rd] = cpu.mmu.loadU8(addr);
					};
				} else {
					// LDR
					op = function() {
						if (condOp && !condOp()) {
							cpu.mmu.waitSeq32(cpu.gprs[cpu.PC]);
							return;
						}
						var addr = address();
						cpu.mmu.wait32(addr);
						cpu.mmu.wait32(cpu.gprs[cpu.PC]);
						cpu.gprs[rd] = cpu.mmu.load32(addr);
					};
				}
			} else {
				if (b) {
					// STRB
					op = function() {
						if (condOp && !condOp()) {
							cpu.mmu.waitSeq32(cpu.gprs[cpu.PC]);
							return;
						}
						var addr = address();
						cpu.mmu.wait32(addr);
						cpu.mmu.wait32(cpu.gprs[cpu.PC]);
						cpu.mmu.store8(addr, cpu.gprs[rd]);
					};
				} else {
					// STR
					op = function() {
						if (condOp && !condOp()) {
							cpu.mmu.waitSeq32(cpu.gprs[cpu.PC]);
							return;
						}
						var addr = address();
						cpu.mmu.wait32(addr);
						cpu.mmu.wait32(cpu.gprs[cpu.PC]);
						cpu.mmu.store32(addr, cpu.gprs[rd]);
					};
				}
			}
			op.writesPC = rd == this.PC || address.writesPC;
			break;
		case 0x08000000:
			// Block data transfer
			var load = instruction & 0x00100000;
			var w = instruction & 0x00200000;
			var user = instruction & 0x00400000;
			var u = instruction & 0x00800000;
			var p = instruction & 0x01000000;
			var rs = instruction & 0x0000FFFF;
			var rn = (instruction & 0x000F0000) >> 16;

			var address;
			if (u) {
				if (p) {
					address = function() {
						return cpu.gprs[rn] - 4;
					}
				} else {
					address = function() {
						return cpu.gprs[rn];
					}
				}
			} else {
				var immediate = 4;
				if (p) {
					immediate = 0;
				}
				for (var m = 0x01, i = 0; i < 8; m <<= 1, ++i) {
					if (rs & m) {
						immediate -= 4;
					}
				}
				address = function() {
					return cpu.gprs[rn] + immediate;
				}
			}
			if (load) {
				// LDM
				op = function() {
					cpu.mmu.waitSeq32(cpu.gprs[cpu.PC]);
					if (condOp && !condOp()) {
						return;
					}
					var addr = address();
					var m, i;
					for (m = 0x01, i = 0; i < 16; m <<= 1, ++i) {
						if (rs & m) {
							cpu.mmu.waitSeq32(addr);
							cpu.gprs[i] = cpu.mmu.load32(addr);
							addr += 4;
						}
					}
					if (w) {
						cpu.gprs[rn] = addr;
					}
					++cpu.cycles;
				};
			} else {
				// STM
				op = function() {
					if (condOp && !condOp()) {
						cpu.mmu.waitSeq32(cpu.gprs[cpu.PC]);
						return;
					}
					var addr = address();
					var m, i;
					for (m = 0x01, i = 0; i < 16; m <<= 1, ++i) {
						if (rs & m) {
							cpu.mmu.wait32(addr);
							cpu.mmu.store32(addr, cpu.gprs[i]);
							addr += 4;
							break;
						}
					}
					for (m <<= 1, ++i; i < 16; m <<= 1, ++i) {
						if (rs & m) {
							cpu.mmu.waitSeq32(addr);
							cpu.mmu.store32(addr, cpu.gprs[i]);
							addr += 4;
						}
					}
					if (w) {
						cpu.gprs[rn] = addr;
					}
					cpu.mmu.wait32(cpu.gprs[cpu.PC]);
				}
			}
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
					cpu.mmu.waitSeq32(cpu.gprs[cpu.PC]);
					return;
				}
				if (link) {
					cpu.gprs[cpu.LR] = cpu.gprs[cpu.PC] - 4;
				}
				cpu.gprs[cpu.PC] += immediate;
				cpu.mmu.waitSeq32(cpu.gprs[cpu.PC]);
				cpu.mmu.wait32(cpu.gprs[cpu.PC]);
			};
			op.writesPC = true;
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

	op.execMode = this.MODE_ARM;
	return op;
};

ARMCore.prototype.compileThumb = function(instruction) {
	var op = this.badOp(instruction & 0xFFFF);
	var cpu = this;
	if ((instruction & 0xFC00) == 0x4000) {
		// Data-processing register
		var rm = (instruction & 0x0038) >> 3;
		var rd = instruction & 0x0007;
		switch (instruction & 0x03C0) {
		case 0x0000:
			// AND
			op = function() {
				cpu.mmu.waitSeq(cpu.gprs[cpu.PC]);
				cpu.gprs[rd] = cpu.gprs[rd] & cpu.gprs[rm];
				cpu.cpsrN = cpu.gprs[rd] & 0x80000000;
				cpu.cpsrZ = !(cpu.gprs[rd] & 0xFFFFFFFF);
			};
			break;
		case 0x0040:
			// EOR
			op = function() {
				cpu.mmu.waitSeq(cpu.gprs[cpu.PC]);
				cpu.gprs[rd] = cpu.gprs[rd] ^ cpu.gprs[rm];
				cpu.cpsrN = cpu.gprs[rd] & 0x80000000;
				cpu.cpsrZ = !(cpu.gprs[rd] & 0xFFFFFFFF);
			};
			break;
		case 0x0080:
			// LSL(2)
			op = function() {
				cpu.mmu.waitSeq(cpu.gprs[cpu.PC]);
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
				cpu.cpsrZ = !(cpu.gprs[rd] & 0xFFFFFFFF);
			};
			break;
		case 0x00C0:
			// LSR(2)
			op = function() {
				cpu.mmu.waitSeq(cpu.gprs[cpu.PC]);
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
				cpu.cpsrZ = !(cpu.gprs[rd] & 0xFFFFFFFF);
			};
			break;
		case 0x0100:
			// ASR(2)
			op = function() {
				cpu.mmu.waitSeq(cpu.gprs[cpu.PC]);
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
				cpu.cpsrZ = !(cpu.gprs[rd] & 0xFFFFFFFF);
			};
			break;
		case 0x0140:
			// ADC
			op = function() {
				cpu.mmu.waitSeq(cpu.gprs[cpu.PC]);
				var m = (cpu.gprs[rm] >>> 0) + !!cpu.cpsrC;
				var oldD = cpu.gprs[rd];
				var d = (oldD >>> 0) + m;
				var oldDn = oldD & 0x80000000;
				var dn = d & 0x80000000;
				var mn = m & 0x80000000;
				cpu.cpsrN = dn;
				cpu.cpsrZ = !(d & 0xFFFFFFFF);
				cpu.cpsrC = d > 0xFFFFFFFF;
				cpu.cpsrV = oldDn == mn && oldDn != dn && mn != dn;
				cpu.gprs[rd] = d;
			};
			break;
		case 0x0180:
			// SBC
			op = function() {
				cpu.mmu.waitSeq(cpu.gprs[cpu.PC]);
				var m = (cpu.gprs[rm] >>> 0) + !cpu.cpsrC;
				var d = (cpu.gprs[rd] >>> 0) - m;
				cpu.cpsrN = d & 0x80000000;
				cpu.cpsrZ = !(d & 0xFFFFFFFF);
				cpu.cpsrC = d > 0xFFFFFFFF;
				cpu.cpsrV = cpu.gprs[rd] & 0x80000000 != m & 0x800000000 &&
							cpu.gprs[rd] & 0x80000000 != d & 0x80000000;
				cpu.gprs[rd] = d;
			};
			break;
		case 0x01C0:
			// ROR
			op = function() {
				cpu.mmu.waitSeq(cpu.gprs[cpu.PC]);
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
				cpu.cpsrZ = !(cpu.gprs[rd] & 0xFFFFFFFF);
			};
			break;
		case 0x0200:
			// TST
			op = function() {
				cpu.mmu.waitSeq(cpu.gprs[cpu.PC]);
				var aluOut = cpu.gprs[rd] & cpu.gprs[rm];
				cpu.cpsrN = aluOut & 0x80000000;
				cpu.cpsrZ = !(aluOut & 0xFFFFFFFF);
			}
			break;
		case 0x0240:
			// NEG
			op = function() {
				cpu.mmu.waitSeq(cpu.gprs[cpu.PC]);
				cpu.gprs[rd] = -cpu.gprs[rm];
				cpu.cpsrN = cpu.gprs[rd] & 0x80000000;
				cpu.cpsrZ = !(cpu.gprs[rd] & 0xFFFFFFFF);
				cpu.cpsrC = 0 >= (cpu.gprs[rd] >>> 0);
				cpu.cpsrV = cpu.gprs[rm] & 0x800000000 && cpu.gprs[rd] & 0x80000000;
			};
			break;
		case 0x0280:
			// CMP(2)
			op = function() {
				cpu.mmu.waitSeq(cpu.gprs[cpu.PC]);
				var aluOut = cpu.gprs[rd] - cpu.gprs[rm];
				cpu.cpsrN = aluOut & 0x80000000;
				cpu.cpsrZ = !(aluOut & 0xFFFFFFFF);
				cpu.cpsrC = (cpu.gprs[rd] >>> 0) >= (cpu.gprs[rm] >>> 0);
				cpu.cpsrV = cpu.gprs[rd] & 0x80000000 != cpu.gprs[rm] & 0x800000000 &&
					        cpu.gprs[rd] & 0x80000000 != aluOut & 0x80000000;
			};
			break;
		case 0x02C0:
			// CMN
			op = function() {
				cpu.mmu.waitSeq(cpu.gprs[cpu.PC]);
				var aluOut = (cpu.gprs[rd] >>> 0) + (cpu.gprs[rm] >>> 0);
				cpu.cpsrN = aluOut & 0x80000000;
				cpu.cpsrZ = !(aluOut & 0xFFFFFFFF);
				cpu.cpsrC = aluOut > 0xFFFFFFFF;
				cpu.cpsrV = cpu.gprs[rd] & 0x80000000 == cpu.gprs[rm] & 0x800000000 &&
					        cpu.gprs[rd] & 0x80000000 != aluOut & 0x80000000 &&
					        cpu.gprs[rm] & 0x80000000 != aluOut & 0x80000000;
			};
			break;
		case 0x0300:
			// ORR
			op = function() {
				cpu.mmu.waitSeq(cpu.gprs[cpu.PC]);
				cpu.gprs[rd] = cpu.gprs[rd] | cpu.gprs[rm];
				cpu.cpsrN = cpu.gprs[rd] & 0x80000000;
				cpu.cpsrZ = !(cpu.gprs[rd] & 0xFFFFFFFF);
			};
			break;
		case 0x0340:
			// MUL
			op = function() {
				// TODO: implement timings
				if ((cpu.gprs[rs] & 0xFFFF0000) && (cpu.gprs[rd] & 0xFFFF0000)) {
					// Our data type is a double--we'll lose bits if we do it all at once!
					var hi = ((cpu.gprs[rd] & 0xFFFF0000) * cpu.gprs[rs]) & 0xFFFFFFFF;
					var lo = ((cpu.gprs[rd] & 0x0000FFFF) * cpu.gprs[rs]) & 0xFFFFFFFF;
					cpu.gprs[rd] = (hi + lo) & 0xFFFFFFFF;
				} else {
					cpu.gprs[rd] *= cpu.gprs[rs];
				}
				cpu.cpsrN = cpu.gprs[rd] & 0x80000000;
				cpu.cpsrZ = !(cpu.gprs[rd] & 0xFFFFFFFF);
			};
			break;
		case 0x0380:
			// BIC
			op = function() {
				cpu.mmu.waitSeq(cpu.gprs[cpu.PC]);
				cpu.gprs[rd] = cpu.gprs[rd] & ~cpu.gprs[rm];
				cpu.cpsrN = cpu.gprs[rd] & 0x80000000;
				cpu.cpsrZ = !(cpu.gprs[rd] & 0xFFFFFFFF);
			};
			break;
		case 0x03C0:
			// MVN
			op = function() {
				cpu.mmu.waitSeq(cpu.gprs[cpu.PC]);
				cpu.gprs[rd] = ~cpu.gprs[rm];
				cpu.cpsrN = cpu.gprs[rd] & 0x80000000;
				cpu.cpsrZ = !(cpu.gprs[rd] & 0xFFFFFFFF);
			};
			break;
		}
		op.writesPC = false;
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
				cpu.mmu.waitSeq(cpu.gprs[cpu.PC]);
				cpu.gprs[rd] += cpu.gprs[rm];
			};
			op.writesPC = rd == this.PC;
			break;
		case 0x0100:
			// CMP(3)
			op = function() {
				cpu.mmu.waitSeq(cpu.gprs[cpu.PC]);
				var aluOut = cpu.gprs[rd] - cpu.gprs[rm];
				cpu.cpsrN = aluOut & 0x80000000;
				cpu.cpsrZ = !(aluOut & 0xFFFFFFFF);
				cpu.cpsrC = (cpu.gprs[rd] >>> 0) >= (cpu.gprs[rm] >>> 0);
				cpu.cpsrV = cpu.gprs[rd] & 0x80000000 != cpu.gprs[rm] & 0x800000000 &&
					        cpu.gprs[rd] & 0x80000000 != aluOut & 0x80000000;
			}
			op.writesPC = false;
			break;
		case 0x0200:
			// MOV(3)
			op = function() {
				cpu.mmu.waitSeq(cpu.gprs[cpu.PC]);
				cpu.gprs[rd] = cpu.gprs[rm];
			};
			op.writesPC = rd == this.PC;
			break;
		case 0x0300:
			// BX
			op = function() {
				// TODO: implement timings
				cpu.execMode = cpu.gprs[rm] & 0x00000001;
				cpu.gprs[cpu.PC] = cpu.gprs[rm] & 0xFFFFFFFE;
			};
			op.writesPC = true;
			break;
		}
	} else if ((instruction & 0xF800) == 0x1800) {
		// Add/subtract
		var rm = (instruction & 0x01C0) >> 6;
		var rn = (instruction & 0x0038) >> 3;
		var rd = instruction & 0x0007;
		switch (instruction & 0x0600) {
		case 0x0000:
			// ADD(3)
			op = function() {
				cpu.mmu.waitSeq(cpu.gprs[cpu.PC]);
				var d = (cpu.gprs[rn] >>> 0) + (cpu.gprs[rm] >>> 0);
				cpu.cpsrN = d & 0x80000000;
				cpu.cpsrZ = !(d & 0xFFFFFFFF);
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
				cpu.mmu.waitSeq(cpu.gprs[cpu.PC]);
				var d = cpu.gprs[rn] - cpu.gprs[rm];
				cpu.cpsrN = d & 0x80000000;
				cpu.cpsrZ = !(d & 0xFFFFFFFF);
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
					cpu.mmu.waitSeq(cpu.gprs[cpu.PC]);
					var d = (cpu.gprs[rn] >>> 0) + immediate;
					cpu.cpsrN = d & 0x80000000;
					cpu.cpsrZ = !(d & 0xFFFFFFFF);
					cpu.cpsrC = d > 0xFFFFFFFF;
					cpu.cpsrV = (cpu.gprs[rn] & 0x80000000) == (immediate & 0x800000000) &&
								(cpu.gprs[rn] & 0x80000000) != (d & 0x80000000) &&
								(immediate & 0x80000000) != (d & 0x80000000);
					cpu.gprs[rd] = d;
				};
			} else {
				// MOV(2)
				op = function() {
					cpu.mmu.waitSeq(cpu.gprs[cpu.PC]);
					var d = (cpu.gprs[rn] >>> 0);
					cpu.cpsrN = d & 0x80000000;
					cpu.cpsrZ = !(d & 0xFFFFFFFF);
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
				cpu.mmu.waitSeq(cpu.gprs[cpu.PC]);
				var d = cpu.gprs[rn] - immediate;
				cpu.cpsrN = d & 0x80000000;
				cpu.cpsrZ = !(d & 0xFFFFFFFF);
				cpu.cpsrC = (cpu.gprs[rn] >>> 0) >= immediate;
				cpu.cpsrV = cpu.gprs[rn] & 0x80000000 != immediate & 0x800000000 &&
				            cpu.gprs[rn] & 0x80000000 != d & 0x80000000;
				cpu.gprs[rd] = d;
			};
			break;
		}
		op.writesPC = false;
	} else if (!(instruction & 0xE000)) {
		// Shift by immediate
		var rd = instruction & 0x0007;
		var rm = (instruction & 0x0038) >> 3;
		var immediate = (instruction & 0x07C0) >> 6;
		switch (instruction & 0x1800) {
		case 0x0000:
			// LSL(1)
			op = function() {
				cpu.mmu.waitSeq(cpu.gprs[cpu.PC]);
				if (immediate == 0) {
					cpu.gprs[rd] = cpu.gprs[rm];
				} else {
					cpu.cpsrC = cpu.gprs[rm] & (1 << (32 - immediate));
					cpu.gprs[rd] = cpu.gprs[rm] << immediate;
				}
				cpu.cpsrN = cpu.gprs[rd] & 0x80000000;
				cpu.cpsrZ = !(cpu.gprs[rd] & 0xFFFFFFFF);
			};
			break;
		case 0x0800:
			// LSR(1)
			op = function() {
				cpu.mmu.waitSeq(cpu.gprs[cpu.PC]);
				if (immediate == 0) {
					cpu.cpsrC = cpu.gprs[rm] & 0x80000000;
					cpu.gprs[rd] = 0;
				} else {
					cpu.cpsrC = cpu.gprs[rm] & (1 << (immediate - 1));
					cpu.gprs[rd] = cpu.gprs[rm] >>> immediate;
				}
				cpu.cpsrN = 0;
				cpu.cpsrZ = !(cpu.gprs[rd] & 0xFFFFFFFF);
			};
			break;
		case 0x1000:
			// ASR(1)
			op = function() {
				cpu.mmu.waitSeq(cpu.gprs[cpu.PC]);
				if (immediate == 0) {
					cpu.cpsrC = cpu.gprs[rm] & 0x80000000;
					if (cpu.cpsrC) {
						cpu.gprs[rd] = 0xFFFFFFFF;
					} else {
						cpu.gprs[rd] = 0;
					}
				} else {
					cpu.cpsrC = cpu.gprs[rm] & (1 << (immediate - 1));
					cpu.gprs[rd] = cpu.gprs[rm] >> immediate;
				}
				cpu.cpsrN = cpu.gprs[rd] & 0x80000000;
				cpu.cpsrZ = !(cpu.gprs[rd] & 0xFFFFFFFF);
			};
			break;
		case 0x1800:
			break;
		}
		op.writesPC = false;
	} else if ((instruction & 0xE000) == 0x2000) {
		// Add/subtract/compare/move immediate
		var immediate = instruction & 0x00FF;
		var rn = (instruction & 0x0700) >> 8;
		switch (instruction & 0x1800) {
		case 0x0000:
			// MOV(1)
			op = function() {
				cpu.mmu.waitSeq(cpu.gprs[cpu.PC]);
				cpu.gprs[rn] = immediate;
				cpu.cpsrN = immediate & 0x80000000;
				cpu.cpsrZ = !(immediate & 0xFFFFFFFF);
			};
			break;
		case 0x0800:
			// CMP(1)
			op = function() {
				cpu.mmu.waitSeq(cpu.gprs[cpu.PC]);
				var aluOut = cpu.gprs[rn] - immediate;
				cpu.cpsrN = aluOut & 0x80000000;
				cpu.cpsrZ = !(aluOut & 0xFFFFFFFF);
				cpu.cpsrC = (cpu.gprs[rn] >>> 0) >= immediate;
				cpu.cpsrV = cpu.gprs[rn] & 0x80000000 != immediate & 0x800000000 &&
				            cpu.gprs[rn] & 0x80000000 != aluOut & 0x80000000;
			};
			break;
		case 0x1000:
			// ADD(2)
			op = function() {
				cpu.mmu.waitSeq(cpu.gprs[cpu.PC]);
				var d = (cpu.gprs[rn] >>> 0) + immediate;
				cpu.cpsrN = d & 0x80000000;
				cpu.cpsrZ = !(d & 0xFFFFFFFF);
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
				cpu.mmu.waitSeq(cpu.gprs[cpu.PC]);
				var d = cpu.gprs[rn] - immediate;
				cpu.cpsrN = d & 0x80000000;
				cpu.cpsrZ = !(d & 0xFFFFFFFF);
				cpu.cpsrC = (cpu.gprs[rn] >>> 0) >= immediate;
				cpu.cpsrV = cpu.gprs[rn] & 0x80000000 != immediate &&
							cpu.gprs[rn] & 0x80000000 != d & 0x80000000;
				cpu.gprs[rn] = d;
			};
			break;
		}
		op.writesPC = false;
	} else if ((instruction & 0xF800) == 0x4800) {
		// LDR(3)
		var rd = (instruction & 0x0700) >> 8;
		var immediate = (instruction & 0x00FF) << 2;
		op = function() {
			cpu.mmu.waitSeq(cpu.gprs[cpu.PC]);
			cpu.mmu.wait32(cpu.gprs[cpu.PC]);
			cpu.gprs[rd] = cpu.mmu.load32((cpu.gprs[cpu.PC] & 0xFFFFFFFC) + immediate);
		};
		op.writesPC = false;
	} else if ((instruction & 0xF000) == 0x5000) {
		// Load and store with relative offset
		var rd = instruction & 0x0007;
		var rn = (instruction & 0x0038) >> 3;
		var rm = (instruction & 0x01C0) >> 6;
		var opcode = instruction & 0x0E00;
		switch (opcode) {
		case 0x0000:
			// STR(2)
			op = function() {
				cpu.mmu.wait(cpu.gprs[cpu.PC]);
				cpu.mmu.wait32(cpu.gprs[rn] + cpu.gprs[rm]);
				cpu.mmu.store32(cpu.gprs[rn] + cpu.gprs[rm], cpu.gprs[rd]);
			}
			break;
		case 0x0200:
			// STRH(2)
			op = function() {
				cpu.mmu.wait(cpu.gprs[cpu.PC]);
				cpu.mmu.wait(cpu.gprs[rn] + cpu.gprs[rm]);
				cpu.mmu.store16(cpu.gprs[rn] + cpu.gprs[rm], cpu.gprs[rd]);
			}
			break;
		case 0x0400:
			// STRB(2)
			op = function() {
				cpu.mmu.wait(cpu.gprs[cpu.PC]);
				cpu.mmu.wait(cpu.gprs[rn] + cpu.gprs[rm]);
				cpu.mmu.store8(cpu.gprs[rn] + cpu.gprs[rm], cpu.gprs[rd]);
			}
			break;
		case 0x0600:
			// LDRSB
			op = function() {
				cpu.mmu.waitSeq(cpu.gprs[cpu.PC]);
				cpu.mmu.wait(cpu.gprs[rn] + cpu.gprs[rm]);
				++cpu.cycles;
				cpu.gprs[rd] = cpu.mmu.load8(cpu.gprs[rn] + cpu.gprs[rm]);
			}
			break;
		case 0x0800:
			// LDR(2)
			op = function() {
				cpu.mmu.waitSeq(cpu.gprs[cpu.PC]);
				cpu.mmu.wait32(cpu.gprs[rn] + cpu.gprs[rm]);
				++cpu.cycles;
				cpu.gprs[rd] = cpu.mmu.load32(cpu.gprs[rn] + cpu.gprs[rm]);
			}
			break;
		case 0x0A00:
			// LDRH(2)
			op = function() {
				cpu.mmu.waitSeq(cpu.gprs[cpu.PC]);
				cpu.mmu.wait(cpu.gprs[rn] + cpu.gprs[rm]);
				++cpu.cycles;
				cpu.gprs[rd] = cpu.mmu.loadU16(cpu.gprs[rn] + cpu.gprs[rm]);
			}
			break;
		case 0x0C00:
			// LDRB(2)
			op = function() {
				cpu.mmu.waitSeq(cpu.gprs[cpu.PC]);
				cpu.mmu.wait(cpu.gprs[rn] + cpu.gprs[rm]);
				++cpu.cycles;
				cpu.gprs[rd] = cpu.mmu.loadU8(cpu.gprs[rn] + cpu.gprs[rm]);
			}
			break;
		case 0x0E00:
			// LDRSH
			op = function() {
				cpu.mmu.waitSeq(cpu.gprs[cpu.PC]);
				cpu.mmu.wait(cpu.gprs[rn] + cpu.gprs[rm]);
				++cpu.cycles;
				cpu.gprs[rd] = cpu.mmu.load16(cpu.gprs[rn] + cpu.gprs[rm]);
			}
			break;
		}
	} else if ((instruction & 0xE000) == 0x6000) {
		// Load and store with immediate offset
		var rd = instruction & 0x0007;
		var rn = (instruction & 0x0038) >> 3;
		var immediate = (instruction & 0x07C0) >> 4;
		var b = instruction & 0x1000;
		if (b) {
			immediate >>= 2;
		}
		var load = instruction & 0x0800;
		if (load) {
			if (b) {
				// LDRB(1)
				op = function() {
					cpu.mmu.waitSeq(cpu.gprs[cpu.PC]);
					cpu.mmu.wait(cpu.gprs[rn] + immediate);
					++cpu.cycles;
					cpu.gprs[rd] = cpu.mmu.loadU8(cpu.gprs[rn] + immediate);
				}
			} else {
				// LDR(1)
				op = function() {
					cpu.mmu.waitSeq(cpu.gprs[cpu.PC]);
					cpu.mmu.wait32(cpu.gprs[rn] + immediate);
					++cpu.cycles;
					cpu.gprs[rd] = cpu.mmu.load32(cpu.gprs[rn] + immediate);
				}
			}
		} else {
			if (b) {
				// STRB(1)
				op = function() {
					cpu.mmu.wait(cpu.gprs[cpu.PC]);
					cpu.mmu.wait(cpu.gprs[rn] + immediate);
					cpu.mmu.store8(cpu.gprs[rn] + immediate, cpu.gprs[rd]);
				};
			} else {
				// STR(1)
				op = function() {
					cpu.mmu.wait(cpu.gprs[cpu.PC]);
					cpu.mmu.wait32(cpu.gprs[rn] + immediate);
					cpu.mmu.store32(cpu.gprs[rn] + immediate, cpu.gprs[rd]);
				}
			}
		}
		op.writesPC = false;
	} else if ((instruction & 0xF600) == 0xB400) {
		// Push and pop registers
		var r = instruction & 0x0100;
		var rs = instruction & 0x00FF;
		if (instruction & 0x0800) {
			// POP
			op = function() {
				cpu.mmu.waitSeq(cpu.gprs[cpu.PC]);
				var address = cpu.gprs[cpu.SP];
				var m, i;
				for (m = 0x01, i = 0; i < 8; m <<= 1, ++i) {
					if (rs & m) {
						cpu.mmu.waitSeq32(address);
						cpu.gprs[i] = cpu.mmu.load32(address);
						address += 4;
					}
				}
				if (r) {
					cpu.mmu.waitSeq32(address);
					cpu.gprs[cpu.PC] = cpu.mmu.load32(address) & 0xFFFFFFFE;
					address += 4;
				}
				cpu.gprs[cpu.SP] = address;
				++cpu.cycles;
			};
			op.writesPC = r;
		} else {
			// PUSH
			op = function() {
				cpu.mmu.waitSeq(cpu.gprs[cpu.PC]);
				var address = cpu.gprs[cpu.SP] - 4;
				if (r) {
					cpu.mmu.waitSeq32(address);
					cpu.mmu.store32(address, cpu.gprs[cpu.LR]);
					address -= 4;
				}
				var m, i;
				for (m = 0x80, i = 7; m; m >>= 1, --i) {
					if (rs & m) {
						cpu.mmu.wait32(address);
						cpu.mmu.store32(address, cpu.gprs[i]);
						address -= 4;
						break;
					}
				}
				for (m >>= 1, --i; m; m >>= 1, --i) {
					if (rs & m) {
						cpu.mmu.waitSeq32(address);
						cpu.mmu.store32(address, cpu.gprs[i]);
						address -= 4;
					}
				}
				cpu.gprs[cpu.SP] = address + 4;
			};
			op.writesPC = false;
		}
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
					cpu.mmu.waitSeq(cpu.gprs[cpu.PC]);
					cpu.mmu.wait32(cpu.gprs[rn] + immediate);
					cpu.gprs[rd] = cpu.mmu.loadU16(cpu.gprs[rn] + immediate);
					++cpu.cycles;
				};
			} else {
				// STRH(1)
				op = function() {
					cpu.mmu.wait(cpu.gprs[cpu.PC]);
					cpu.mmu.wait32(cpu.gprs[rn] + immediate);
					cpu.mmu.store16(cpu.gprs[rn] + immediate, cpu.gprs[rd]);
				};
			}
			op.writesPC = false;
			break;
		case 0x1000:
			// SP-relative load and store
			var rd = (instruction & 0x0700) >> 8;
			var immediate = (instruction & 0x00FF) << 2;
			var load = instruction & 0x0800;
			if (load) {
				// LDR(4)
				op = function() {
					cpu.mmu.waitSeq(cpu.gprs[cpu.PC]);
					cpu.mmu.wait32(cpu.gprs[cpu.SP] + immediate);
					cpu.gprs[rd] = cpu.mmu.load32(cpu.gprs[cpu.SP] + immediate);
					++cpu.cycles;
				}
			} else {
				// STR(3)
				op = function() {
					cpu.mmu.wait(cpu.gprs[cpu.PC]);
					cpu.mmu.wait32(cpu.gprs[cpu.SP] + immediate);
					cpu.mmu.store32(cpu.gprs[cpu.SP] + immediate, cpu.gprs[rd]);
				}
			}
			op.writesPC = false;
			break;
		case 0x2000:
			// Load address
			var rd = (instruction & 0x0700) >> 8;
			var immediate = (instruction & 0x00FF) << 2;
			if (instruction & 0x0800) {
				// ADD(6)
				op = function() {
					cpu.mmu.waitSeq(cpu.gprs[cpu.PC]);
					cpu.gprs[rd] = cpu.gprs[cpu.SP] + immediate;
				};
			} else {
				// ADD(5)
				op = function() {
					cpu.mmu.waitSeq(cpu.gprs[cpu.PC]);
					cpu.gprs[rd] = cpu.gprs[cpu.PC] + immediate;
				};
			}
			op.writesPC = false;
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
					cpu.mmu.waitSeq(cpu.gprs[cpu.PC]);
					cpu.gprs[cpu.SP] += immediate;
				};
				op.writesPC = false;
			}
			break;
		case 0x4000:
			// Multiple load and store
			var rn = (instruction & 0x0700) >> 8;
			var rs = instruction & 0x00FF;
			if (instruction & 0x0800) {
				// LDMIA
				op = function() {
					
					cpu.mmu.waitSeq(cpu.gprs[cpu.PC]);
					var address = cpu.gprs[rn];
					var m, i;
					for (m = 0x01, i = 0; i < 8; m <<= 1, ++i) {
						if (rs & m) {
							cpu.mmu.waitSeq32(address);
							cpu.gprs[i] = cpu.mmu.load32(address);
							address += 4;
						}
					}
					cpu.gprs[rn] = address;
				};
			} else {
				// STMIA
				op = function() {
					cpu.mmu.waitSeq(cpu.gprs[cpu.PC]);
					var address = cpu.gprs[rn];
					var m, i;
					for (m = 0x01, i = 0; i < 8; m <<= 1, ++i) {
						if (rs & m) {
							cpu.mmu.wait32(address);
							cpu.mmu.store32(address, cpu.gprs[i]);
							address += 4;
						}
					}
					for (m <<= 1, ++i; i < 8; m <<= 1, ++i) {
						if (rs & m) {
							cpu.mmu.waitSeq32(address);
							cpu.mmu.store32(address, cpu.gprs[i]);
							address -= 4;
						}
					}
					cpu.gprs[rn] = address;
				};
			}
			op.writesPC = false;
			break;
		case 0x5000:
			// Conditional branch
			var cond = (instruction & 0x0F00) >> 8;
			var immediate = (instruction & 0x00FF);
			if (cond == 0xF) {
				// SWI
				op = function() {
					cpu.mmu.waitSeq(cpu.gprs[cpu.PC]);
					// Additional +1S+1N handled in BIOS
					cpu.irq.swi(immediate);
				}
				op.writesPC = false;
			} else {
				// B(1)
				if (instruction & 0x0080) {
					immediate |= 0xFFFFFF00;
				}
				immediate <<= 1;
				var condOp = this.generateCond(cond);
				op = function() {
					cpu.mmu.waitSeq(cpu.gprs[cpu.PC]);
					if (condOp()) {
						cpu.gprs[cpu.PC] += immediate;
					}
				}
				op.writesPC = true;
			}
			break;
		case 0x6000:
		case 0x7000:
			// BL(X)
			var immediate = instruction & 0x07FF;
			var h = instruction & 0x1800;
			switch (h) {
			case 0x0000:
				// B(2)
				if (immediate & 0x0400) {
					immediate |= 0xFFFFF800;
				}
				immediate <<= 1;
				op = function() {
					cpu.mmu.waitSeq(cpu.gprs[cpu.PC]);
					cpu.gprs[cpu.PC] += immediate;
				};
				op.writesPC = true;
				break;
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
					cpu.mmu.waitSeq(cpu.gprs[cpu.PC]);
					cpu.gprs[cpu.LR] = cpu.gprs[cpu.PC] + immediate;
				}
				op.writesPC = false;
				break;
			case 0x1800:
				// BL(2)
				op = function() {
					cpu.mmu.waitSeq(cpu.gprs[cpu.PC]);
					var pc = cpu.gprs[cpu.PC];
					cpu.gprs[cpu.PC] = cpu.gprs[cpu.LR] + (immediate << 1);
					cpu.gprs[cpu.LR] = pc - 1;
				}
				op.writesPC = true;
				break;
			}
			break;
		default:
			this.WARN("Undefined instruction: 0x" + instruction.toString(16));
		}
	} else {
		this.ASSERT_UNREACHED("Bad opcode: 0x" + instruction.toString(16));
	}

	op.execMode = this.MODE_THUMB;
	return op;
};
