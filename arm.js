ARMCoreArm = function (cpu) {
	this.constructB = function(immediate, condOp) {
		var gprs = cpu.gprs;
		return function() {
			if (condOp && !condOp()) {
				cpu.mmu.waitSeq32(gprs[cpu.PC]);
				return;
			}
			gprs[cpu.PC] += immediate;
			cpu.mmu.waitSeq32(gprs[cpu.PC]);
			cpu.mmu.wait32(gprs[cpu.PC]);
		};
	};

	this.constructBX = function(rm, condOp) {
		var gprs = cpu.gprs;
		return function() {
			if (condOp && !condOp()) {
				cpu.mmu.waitSeq32(gprs[cpu.PC]);
				return;
			}
			cpu.switchExecMode(gprs[rm] & 0x00000001);
			gprs[cpu.PC] = gprs[rm] & 0xFFFFFFFE;
			cpu.mmu.waitSeq32(gprs[cpu.PC]);
			cpu.mmu.wait32(gprs[cpu.PC]);
		};
	};

	this.constructBL = function(immediate, condOp) {
		var gprs = cpu.gprs;
		return function() {
			if (condOp && !condOp()) {
				cpu.mmu.waitSeq32(gprs[cpu.PC]);
				return;
			}
			gprs[cpu.LR] = gprs[cpu.PC] - 4;
			gprs[cpu.PC] += immediate;
			cpu.mmu.waitSeq32(gprs[cpu.PC]);
			cpu.mmu.wait32(gprs[cpu.PC]);
		};
	};

	this.constructLDM = function(rs, address, condOp) {
		var gprs = cpu.gprs;
		var mmu = cpu.mmu;
		return function() {
			mmu.waitSeq32(gprs[cpu.PC]);
			if (condOp && !condOp()) {
				return;
			}
			var addr = address();
			var m, i;
			for (m = 0x01, i = 0; i < 16; m <<= 1, ++i) {
				if (rs & m) {
					mmu.waitSeq32(addr);
					gprs[i] = mmu.load32(addr);
					addr += 4;
				}
			}
			++cpu.cycles;
		};
	};

	this.constructMLA = function(rd, rn, rs, rm, s, condOp) {
		var gprs = cpu.gprs;
		return function() {
			cpu.mmu.waitSeq32(gprs[cpu.PC]);
			if (condOp && !condOp()) {
				return;
			}
			cpu.cycles += 5; // TODO: better timing
			if ((gprs[rm] & 0xFFFF0000) && (gprs[rs] & 0xFFFF0000)) {
				// Our data type is a double--we'll lose bits if we do it all at once!
				var hi = ((gprs[rm] & 0xFFFF0000) * gprs[rs]) & 0xFFFFFFFF;
				var lo = ((gprs[rm] & 0x0000FFFF) * gprs[rs]) & 0xFFFFFFFF;
				gprs[rd] = (hi + lo + gprs[rn]) & 0xFFFFFFFF;
			} else {
				gprs[rd] = gprs[rm] * gprs[rs] + gprs[rn];
			}
			if (s) {
				cpu.cpsrN = gprs[rd] & 0x80000000;
				cpu.cpsrZ = !(gprs[rd] & 0xFFFFFFFF);
			}
		};
	};

	this.constructMRS = function(rd, r, condOp) {
		var gprs = cpu.gprs;
		return function() {
					if (r) {
				gprs[rd] = cpu.spsr;
			} else {
				gprs[rd] = cpu.packCPSR();
			}
		};
	};

	this.constructMSR = function(rm, r, instruction, immediate, condOp) {
		var gprs = cpu.gprs;
		var c = instruction & 0x00010000;
		//var x = instruction & 0x00020000;
		//var s = instruction & 0x00040000;
		var f = instruction & 0x00080000;
		return function() {
			cpu.mmu.waitSeq32(gprs[cpu.PC]);
			if (condOp && !condOp()) {
				return;
			}
			var operand;
			if (instruction & 0x02000000) {
				operand = immediate;
			} else {
				operand = gprs[rm];
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
					cpu.cpsrI = operand & 0x00000080;
					cpu.cpsrF = operand & 0x00000040;
				}
			}
		};
	};

	this.constructMUL = function(rd, rs, rm, s, condOp) {
		var gprs = cpu.gprs;
		return function() {
			cpu.mmu.waitSeq32(gprs[cpu.PC]);
			if (condOp && !condOp()) {
				return;
			}
			cpu.cycles += 4; // TODO: better timing
			if ((gprs[rm] & 0xFFFF0000) && (gprs[rs] & 0xFFFF0000)) {
				// Our data type is a double--we'll lose bits if we do it all at once!
				var hi = ((gprs[rm] & 0xFFFF0000) * gprs[rs]) & 0xFFFFFFFF;
				var lo = ((gprs[rm] & 0x0000FFFF) * gprs[rs]) & 0xFFFFFFFF;
				gprs[rd] = (hi + lo) & 0xFFFFFFFF;
			} else {
				gprs[rd] = gprs[rm] * gprs[rs];
			}
			if (s) {
				cpu.cpsrN = gprs[rd] & 0x80000000;
				cpu.cpsrZ = !(gprs[rd] & 0xFFFFFFFF);
			}
		};
	};

	this.constructSTM = function(rs, address, condOp) {
		var gprs = cpu.gprs;
		var mmu = cpu.mmu;
		return function() {
			if (condOp && !condOp()) {
				mmu.waitSeq32(gprs[cpu.PC]);
				return;
			}
			var addr = address();
			var m, i;
			for (m = 0x01, i = 0; i < 16; m <<= 1, ++i) {
				if (rs & m) {
					mmu.wait32(addr);
					mmu.store32(addr, gprs[i]);
					addr += 4;
					break;
				}
			}
			for (m <<= 1, ++i; i < 16; m <<= 1, ++i) {
				if (rs & m) {
					mmu.waitSeq32(addr);
					mmu.store32(addr, gprs[i]);
					addr += 4;
				}
			}
			cpu.mmu.wait32(gprs[cpu.PC]);
		};
	};
};
