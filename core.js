GBACore = function() {
	this.resetCPU();

	this.WORKING_IRAM_SIZE = 0x8000;
	this.WORKING_RAM_SIZE = 0x40000;

	this.V = 0x10000000;
	this.C = 0x20000000;
	this.Z = 0x40000000;
	this.N = 0x80000000;
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
	this.cpsr = 0;

	this.shifterOperand = 0;
	this.shifterCarryOut = 0;

	this.iram = new ArrayBuffer(this.WORKING_IRAM_SIZE);
	this.wram = new ArrayBuffer(this.WORKING_RAM_SIZE);
};

GBACore.prototype.loadRom = function(rom) {
	this.resetCPU();
};

GBACore.prototype.compile = function(instruction) {
	var cond = instruction & 0xF0000000;
	var op = this.noop;
	var i = instruction & 0x0E000000;

	if (i == 0x02000000 || instruction & 0x00000090 != 0x00000090) {
		// Data processing/FSR transfer
		var opcode = instruction & 0x01E00000;
		var s = instruction & 0x00100000;
		var rn = (instruction & 0x000F0000) >> 16;
		var rd = (instruction & 0x0000F000) >> 12;

		// Parse shifter operand
		var shift = instruction & 0x00000060;
		// FIXME: this only applies if using non-immediate, which we always will be (?)
		var rm = instruction & 0x0000000F;
		var shiftOp = function() { return this.gprs[rm] };
		if (i) {
			var immediate = instruction & 0x000000FF;
			var rotate = (instruction & 0x00000F00) >> 7;
			shiftOp = function() {
				this.shifterOperand = (immediate >> rotate) | (immediate << (32 - rotate));
				if (rotate == 0) {
					this.shifterCarryOut = this.cpsr & this.C;
				} else {
					this.shifterCarryOut = this.shifterOperand & 0x80000000;
				}
			}
		} else if (instruction & 0x00000010) {
			var rs = (instruction & 0x00000F00) >> 8;
			switch (shift) {
			case 0:
				// LSL
				break;
			case 1:
				// LSR
				break;
			case 2:
				// ASR
				break;
			case 3:
				// ROR
				break;
			}
		} else {
			var immediate = (instruction & 0x00000F80) >> 8;
			switch (shift) {
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
						this.shifterCarryOut = this.cpsr & this.C;
					};
				}
				break;
			case 1:
				// LSR
				break;
			case 2:
				// ASR
				break;
			case 3:
				// ROR
				if (immediate) {
				} else {
					// RRX
				}
				break;
			}
		}

		switch (opcode) {
		case 0x00000000:
			// AND
			break;
		case 0x00200000:
			// EOR
			break;
		case 0x00400000:
			// SUB
			break;
		case 0x00600000:
			// RSB
			break;
		case 0x00800000:
			// ADD
			break;
		case 0x00A00000:
			// ADC
			break;
		case 0x00C00000:
			// SBC
			break;
		case 0x00E00000:
			// RSC
			break;
		case 0x01000000:
			// TST
			break;
		case 0x01200000:
			// TEQ
			break;
		case 0x01400000:
			// CMP
			break;
		case 0x01600000:
			// CMN
			break;
		case 0x01800000:
			// ORR
			break;
		case 0x01A00000:
			// MOV
			break;
		case 0x01C00000:
			// BIC
			break;
		case 0x01E00000:
			// MVN
			break;
		}
	} else if (instruction & 0x0FFFFFF0 == 0x012FFF10) {
		// BX
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
			return this.cpsr & this.Z;
		};
		break;
	case 0x10000000:
		// NE
		condOp = function() {
			return !(this.cpsr & this.Z);
		};
		break;
	case 0x20000000:
		// CS
		condOp = function() {
			return this.cpsr & this.C;
		};
		break;
	case 0x30000000:
		// CC
		condOp = function() {
			return !(this.cpsr & this.C);
		};
		break;
	case 0x40000000:
		// MI
		condOp = function() {
			return this.cpsr & this.N;
		};
		break;
	case 0x50000000:
		// PL
		condOp = function() {
			return !(this.cpsr & this.N);
		};
		break;
	case 0x60000000:
		// VS
		condOp = function() {
			return this.cpsr & this.V;
		};
		break;
	case 0x70000000:
		// VC
		condOp = function() {
			return !(this.cpsr & this.V);
		};
		break;
	case 0x80000000:
		// HI
		condOp = function () {
			return this.cspr & this.C && !(this.cspr & this.Z);
		};
		break;
	case 0x90000000:
		// LS
		condOp = function () {
			return !(this.cspr & this.C) || this.cspr & this.Z;
		};
		break;
	case 0xA0000000:
		// GE
		condOp = function () {
			return !(this.cspr & this.N) == !(this.cspr & this.V);
		};
		break;
	case 0xB0000000:
		// LT
		condOp = function () {
			return !(this.cspr & this.N) != !(this.cspr & this.V);
		};
		break;
	case 0xC0000000:
		// GT
		condOp = function () {
			return !(this.cspr & this.Z) && !(this.cspr & this.N) == !(this.cspr & this.V);
		};
		break;
	case 0xD0000000:
		// LE
		condOp = function () {
			return (this.cspr & this.Z) || !(this.cspr & this.N) != !(this.cspr & this.V);
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
	return this.tnoop;
};
