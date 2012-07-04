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
	this.advancePC();
};

GBACore.prototype.noopThumb = function() {
	this.advancePCThumb();
};

GBACore.prototype.compile = function(instruction) {
	var cond = instruction & 0xF0000000;
	var op = this.noop;
	var i = instruction & 0x0E000000;

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
		var shiftOp = function() { return this.gprs[rm] };
		if (i) {
			var immediate = instruction & 0x000000FF;
			var rotate = (instruction & 0x00000F00) >> 7;
			shiftOp = function() {
				this.shifterOperand = (immediate >> rotate) | (immediate << (32 - rotate));
				if (rotate == 0) {
					this.shifterCarryOut = this.cpsrC;
				} else {
					this.shifterCarryOut = this.shifterOperand & 0x80000000;
				}
			}
		} else if (instruction & 0x00000010) {
			var rs = (instruction & 0x00000F00) >> 8;
			switch (shiftType) {
			case 0:
				// LSL
				shiftOp = function() {
					var shift = this.gprs[rs] & 0xFF;
					if (shift == 0) {
						this.shifterOperand = this.gprs[rm];
						this.shifterCarryOut = this.cpsrC;
					} else if (shift < 32) {
						this.shifterOperand = this.gprs[rm] << shift;
						this.shifterCarryOut = this.gprs[rm] & (1 << (32 - shift));
					} else if (shift == 32) {
						this.shifterOperand = 0;
						this.shifterCarryOut = this.gprs[rm] & 1;
					} else {
						this.shifterOperand = 0;
						this.shifterCarryOut = 0;
					}
				};
				break;
			case 1:
				// LSR
				shiftOp = function() {
					var shift = this.gprs[rs] & 0xFF;
					if (shift == 0) {
						this.shifterOperand = this.gprs[rm];
						this.shifterCarryOut = this.cpsrC;
					} else if (shift < 32) {
						this.shifterOperand = this.gprs[rm] >>> shift;
						this.shifterCarryOut = this.gprs[rm] & (1 << (shift - 1));
					} else if (shift == 32) {
						this.shifterOperand = 0;
						this.shifterCarryOut = this.gprs[rm] & 0x80000000;
					} else {
						this.shifterOperand = 0;
						this.shifterCarryOut = 0;
					}
				}
				break;
			case 2:
				// ASR
				shiftOp = function() {
					var shift = this.gprs[rs] & 0xFF;
					if (shift == 0) {
						this.shifterOperand = this.gprs[rm];
						this.shifterCarryOut = this.cpsrC;
					} else if (shift < 32) {
						this.shifterOperand = this.gprs[rm] >> shift;
						this.shifterCarryOut = this.gprs[rm] & (1 << (shift - 1));
					} else if (this.gprs[rm] & 0x80000000) {
						this.shifterOperand = 0xFFFFFFFF;
						this.shifterCarryOut = 0x80000000;
					} else {
						this.shifterOperand = 0;
						this.shifterCarryOut = 0;
					}
				}
				break;
			case 3:
				// ROR
				shiftOp = function() {
					var shift = this.gprs[rs] & 0xFF;
					var rotate = shift & 0x1F;
					if (shift == 0) {
						this.shifterOperand = this.gprs[rm];
						this.shifterCarryOut = this.cpsrC;
					} else if (rotate) {
						this.shifterOperand = (this.gprs[rm] >>> rotate) | (this.gprs[rm] << (32 - rotate));
						this.shifterCarryOut = this.gprs[rm] & (1 << (rotate - 1));
					} else {
						this.shifterOperand = this.gprs[rm];
						this.shifterCarryOut = this.gprs[rm] & 0x80000000;
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
						this.shifterOperand = this.gprs[rm] << immediate;
						this.shifterCarryOut = this.gprs[rm] & (1 << (32 - immediate));
					};
				} else {
					// This boils down to no shift
					shiftOp = function() {
						this.shifterOperand = this.gprs[rm];
						this.shifterCarryOut = this.cpsrC;
					};
				}
				break;
			case 1:
				// LSR
				if (immediate) {
					shiftOp = function() {
						this.shifterOperand = this.gprs[rm] >>> immediate;
						this.shifterCarryOut = this.gprs[rm] & (1 << (immediate - 1));
					};
				} else {
					shiftOp = function() {
						this.shifterOperand = 0;
						this.shifterCarryOut = this.gprs[rm] & 0x80000000;
					};
				}
				break;
			case 2:
				// ASR
				if (immediate) {
					shiftOp = function() {
						this.shifterOperand = this.gprs[rm] >> immediate;
						this.shifterCarryOut = this.gprs[rm] & (1 << (immediate - 1));
					};
				} else {
					shiftOp = function() {
						this.shifterCarryOut = this.gprs[rm] & 0x80000000;
						if (this.shifterCarryOut) {
							this.shifterOperand = 0xFFFFFFFF;
						} else {
							this.shifterOperand = 0;
						}
					};
				}
				break;
			case 3:
				// ROR
				if (immediate) {
					shiftOp = function() {
						this.shifterOperand = (this.gprs[rm] >>> immediate) | (this.gprs[rm] << (32 - immediate));
						this.shifterCarryOut = this.gprs[rm] & (1 << (immediate - 1));
					};
				} else {
					// RRX
					shiftOp = function() {
						this.shifterOperand = (!!this.cpsrC << 31) | (this.gprs[rm] >>> 1);
						this.shifterCarryOut =  this.gprs[rm] & 0x00000001;
					};
				}
				break;
			}
		}

		switch (opcode) {
		case 0x00000000:
			// AND
			op = function() {
				this.gprs[rd] = this.gprs[rn] & this.shifterOperand;
				if (s) {
					this.cpsrN = this.gprs[rd] & 0x80000000;
					this.cpsrZ = !this.gprs[rd];
					this.cpsrC = this.shifterCarryOut;
				}
			}
			break;
		case 0x00200000:
			// EOR
			op = function() {
				this.gprs[rd] = this.gprs[rn] ^ this.shifterOperand;
				if (s) {
					this.cpsrN = this.gprs[rd] & 0x80000000;
					this.cpsrZ = !this.gprs[rd];
					this.cpsrC = this.shifterCarryOut;
				}
			}
			break;
		case 0x00400000:
			// SUB
			op = function() {
				var d = this.gprs[rn] - this.shifterOperand;
				if (s) {
					this.cpsrN = d & 0x80000000;
					this.cpsrZ = !d;
					this.cpsrC = (this.gprs[rn] >>> 0) >= (this.shifterOperand >>> 0);
					this.cpsrV = this.gprs[rn] & 0x80000000 != this.shifterOperand & 0x800000000 &&
					             this.gprs[rn] & 0x80000000 != d & 0x80000000;
				}
				this.gprs[rd] = d;
			}
			break;
		case 0x00600000:
			// RSB
			op = function() {
				var d = this.shifterOperand - this.gprs[rn];
				if (s) {
					this.cpsrN = d & 0x80000000;
					this.cpsrZ = !d;
					this.cpsrC = (this.shifterOperand >>> 0) >= (this.gprs[rn] >>> 0);
					this.cpsrV = this.shifterOperand & 0x800000000 != this.gprs[rn] & 0x80000000 &&
					             this.shifterOperand & 0x800000000 != d & 0x80000000;
				}
				this.gprs[rd] = d;
			}
			break;
		case 0x00800000:
			// ADD
			op = function() {
				var d = (this.gprs[rn] >>> 0) + (this.shifterOperand >>> 0);
				if (s) {
					this.cpsrN = d & 0x80000000;
					this.cpsrZ = !d;
					this.cpsrC = d > 0xFFFFFFFF;
					this.cpsrV = this.gprs[rn] & 0x80000000 == this.shifterOperand & 0x800000000 &&
					             this.gprs[rn] & 0x80000000 != d & 0x80000000 &&
					             this.shifterOperand & 0x80000000 != d & 0x80000000;
				}
				this.gprs[rd] = d;
			}
			break;
		case 0x00A00000:
			// ADC
			op = function() {
				var shifterOperand = (this.shifterOperand >>> 0) + !!this.cpsrC;
				var d = (this.gprs[rn] >>> 0) + shifterOperand;
				if (s) {
					this.cpsrN = d & 0x80000000;
					this.cpsrZ = !d;
					this.cpsrC = d > 0xFFFFFFFF;
					this.cpsrV = this.gprs[rn] & 0x80000000 == shifterOperand & 0x800000000 &&
					             this.gprs[rn] & 0x80000000 != d & 0x80000000 &&
					             shifterOperand & 0x80000000 != d & 0x80000000;
				}
				this.gprs[rd] = d;
			}
			break;
		case 0x00C00000:
			// SBC
			op = function() {
				var shifterOperand = (this.shifterOperand >>> 0) + !this.cpsrC;
				var d = (this.gprs[rn] >>> 0) - shifterOperand;
				if (s) {
					this.cpsrN = d & 0x80000000;
					this.cpsrZ = !d;
					this.cpsrC = d > 0xFFFFFFFF;
					this.cpsrV = this.gprs[rn] & 0x80000000 != shifterOperand & 0x800000000 &&
					             this.gprs[rn] & 0x80000000 != d & 0x80000000;
				}
				this.gprs[rd] = d;
			}
			break;
		case 0x00E00000:
			// RSC
			op = function() {
				var n = (this.gprs[rn] >>> 0) + !this.cpsrC;
				var d = (this.shifterOperand >>> 0) - n;
				if (s) {
					this.cpsrN = d & 0x80000000;
					this.cpsrZ = !d;
					this.cpsrC = d > 0xFFFFFFFF;
					this.cpsrV = this.shifterOperand & 0x80000000 != n & 0x80000000 &&
					             this.shifterOperand & 0x80000000 != d & 0x80000000;
				}
				this.gprs[rd] = d;
			}
			break;
		case 0x01000000:
			// TST
			op = function() {
				var aluOut = this.gprs[rn] & this.shifterOperand;
				this.cpsrN = aluOut & 0x80000000;
				this.cpsrZ = !aluOut;
				this.cpsrC = this.shifterCarryOut;
			}
			break;
		case 0x01200000:
			// TEQ
			op = function() {
				var aluOut = this.gprs[rn] ^ this.shifterOperand;
				this.cpsrN = aluOut & 0x80000000;
				this.cpsrZ = !aluOut;
				this.cpsrC = this.shifterCarryOut;
			}
			break;
		case 0x01400000:
			// CMP
			op = function() {
				var aluOut = this.gprs[rn] - this.shifterOperand;
				this.cpsrN = aluOut & 0x80000000;
				this.cpsrZ = !aluOut;
				this.cpsrC = (this.gprs[rn] >>> 0) >= (this.shifterOperand >>> 0);
				this.cpsrV = this.gprs[rn] & 0x80000000 != this.shifterOperand & 0x800000000 &&
					         this.gprs[rn] & 0x80000000 != aluOut & 0x80000000;
			}
			break;
		case 0x01600000:
			// CMN
			op = function() {
				var aluOut = (this.gprs[rn] >>> 0) + (this.shifterOperand >>> 0);
				this.cpsrN = aluOut & 0x80000000;
				this.cpsrZ = !aluOut;
				this.cpsrC = aluOut > 0xFFFFFFFF;
				this.cpsrV = this.gprs[rn] & 0x80000000 == this.shifterOperand & 0x800000000 &&
					         this.gprs[rn] & 0x80000000 != aluOut & 0x80000000 &&
					         this.shifterOperand & 0x80000000 != aluOut & 0x80000000;
			}
			break;
		case 0x01800000:
			// ORR
			op = function() {
				this.gprs[rd] = this.gprs[rn] | this.shifterOperand;
				if (s) {
					this.cpsrN = this.gprs[rd] & 0x80000000;
					this.cpsrZ = !this.gprs[rd];
				}
			}
			break;
		case 0x01A00000:
			// MOV
			op = function() {
				this.gprs[rd] = this.shifterOperand;
				if (s) {
					this.cpsrN = this.gprs[rd] & 0x80000000;
					this.cpsrZ = !this.gprs[rd];
					this.cpsrC = this.shifterCarryOut;
				}
			}
			break;
		case 0x01C00000:
			// BIC
			op = function() {
				shiftOp();
				this.gprs[rd] = this.gprs[rn] & ~this.shifterOperand;
				if (s) {
					this.cpsrN = this.gprs[rd] & 0x80000000;
					this.cpsrZ = !this.gprs[rd];
					this.cpsrC = this.shifterCarryOut;
				}
			}
			break;
		case 0x01E00000:
			// MVN
			op = function() {
				this.gprs[rd] = ~this.shifterOperand;
				if (s) {
					this.cpsrN = this.gprs[rd] & 0x80000000;
					this.cpsrZ = !this.gprs[rd];
					this.cpsrC = aluOut > this.shifterCarryOut;
				}
			}
			break;
		}
		op = function() {
			shiftOp();
			innerOp();
			this.advancePC();
		}
	} else if (instruction & 0x0FFFFFF0 == 0x012FFF10) {
		// BX
		var rm = instruction & 0xF;
		op = function() {
			this.execMode = this.grps[rm] & 0x00000001;
			this.gprs[this.PC] = this.grps[rm] & 0xFFFFFFFE;
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

	// If cond is AL (or unpredictable), don't decorate the op
	if (cond == 0xE0000000 || cond == 0xF0000000) {
		return op;
	}

	var condOp;
	switch (cond) {
	case 0x00000000:
		// EQ
		condOp = function() {
			return this.cpsrZ;
		};
		break;
	case 0x10000000:
		// NE
		condOp = function() {
			return !this.cpsrZ;
		};
		break;
	case 0x20000000:
		// CS
		condOp = function() {
			return this.cpsrC;
		};
		break;
	case 0x30000000:
		// CC
		condOp = function() {
			return !this.cpsrC;
		};
		break;
	case 0x40000000:
		// MI
		condOp = function() {
			return this.cpsrN;
		};
		break;
	case 0x50000000:
		// PL
		condOp = function() {
			return !this.cpsrN;
		};
		break;
	case 0x60000000:
		// VS
		condOp = function() {
			return this.cpsrV;
		};
		break;
	case 0x70000000:
		// VC
		condOp = function() {
			return !this.cpsrV;
		};
		break;
	case 0x80000000:
		// HI
		condOp = function () {
			return this.csprC && !this.csprZ;
		};
		break;
	case 0x90000000:
		// LS
		condOp = function () {
			return !this.csprC || this.csprZ;
		};
		break;
	case 0xA0000000:
		// GE
		condOp = function () {
			return !this.csprN == !this.csprV;
		};
		break;
	case 0xB0000000:
		// LT
		condOp = function () {
			return !this.csprN != !this.csprV;
		};
		break;
	case 0xC0000000:
		// GT
		condOp = function () {
			return !this.csprZ && !this.csprN == !this.csprV;
		};
		break;
	case 0xD0000000:
		// LE
		condOp = function () {
			return this.csprZ || !this.csprN != !this.csprV;
		};
		break;
	}

	return function() {
		if (condOp()) {
			op();
		} else {
			this.noop();
		}
	};
};

GBACore.prototype.compileThumb = function(instruction) {
	return this.noopThumb;
};
