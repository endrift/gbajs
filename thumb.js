ARMCoreThumb = function (cpu) {
	this.constructADC = function(rd, rm) {
		var gprs = cpu.gprs;
		return function() {
			cpu.mmu.waitSeq(gprs[cpu.PC]);
			var m = (gprs[rm] >>> 0) + !!cpu.cpsrC;
			var oldD = gprs[rd];
			var d = (oldD >>> 0) + m;
			var oldDn = oldD & 0x80000000;
			var dn = d & 0x80000000;
			var mn = m & 0x80000000;
			cpu.cpsrN = dn;
			cpu.cpsrZ = !(d & 0xFFFFFFFF);
			cpu.cpsrC = d > 0xFFFFFFFF;
			cpu.cpsrV = oldDn == mn && oldDn != dn && mn != dn;
			gprs[rd] = d;
		};
	};

	this.constructADD1 = function(rd, rn, immediate) {
		var gprs = cpu.gprs;
		return function() {
			cpu.mmu.waitSeq(gprs[cpu.PC]);
			var d = (gprs[rn] >>> 0) + immediate;
			cpu.cpsrN = d & 0x80000000;
			cpu.cpsrZ = !(d & 0xFFFFFFFF);
			cpu.cpsrC = d > 0xFFFFFFFF;
			cpu.cpsrV = !(gprs[rn] & 0x80000000) && ((gprs[rn] & 0x80000000 ^ d) & 0x80000000) && (d & 0x80000000);
			gprs[rd] = d;
		};
	};

	this.constructAND = function(rd, rm) {
		var gprs = cpu.gprs;
		return function() {
			cpu.mmu.waitSeq(gprs[cpu.PC]);
			gprs[rd] = gprs[rd] & gprs[rm];
			cpu.cpsrN = gprs[rd] & 0x80000000;
			cpu.cpsrZ = !(gprs[rd] & 0xFFFFFFFF);
		};
	};

	this.constructASR2 = function(rd, rm) {
		var gprs = cpu.gprs;
		return function() {
			cpu.mmu.waitSeq(gprs[cpu.PC]);
			var rs = gprs[rm] & 0xFF;
			if (rs) {
				if (rs < 32) {
					cpu.cpsrC = gprs[rd] & (1 << (rs - 1));
					gprs[rd] >>= rs;
				} else {
					cpu.cpsrC = gprs[rd] & 0x80000000;
					if (cpu.cpsrC) {
						gprs[rd] = 0xFFFFFFFF;
					} else {
						gprs[rd] = 0;
					}
				}
			}
			cpu.cpsrN = gprs[rd] & 0x80000000;
			cpu.cpsrZ = !(gprs[rd] & 0xFFFFFFFF);
		};
	};

	this.constructB1 = function(immediate, condOp) {
		var gprs = cpu.gprs;
		return function() {
			cpu.mmu.waitSeq(gprs[cpu.PC]);
			if (condOp()) {
				gprs[cpu.PC] += immediate;
			}
		};
	};

	this.constructBIC = function(rd, rm) {
		var gprs = cpu.gprs;
		return function() {
			cpu.mmu.waitSeq(gprs[cpu.PC]);
			gprs[rd] = gprs[rd] & ~gprs[rm];
			cpu.cpsrN = gprs[rd] & 0x80000000;
			cpu.cpsrZ = !(gprs[rd] & 0xFFFFFFFF);
		};
	};

	this.constructCMN = function(rd, rm) {
		var gprs = cpu.gprs;
		return function() {
			cpu.mmu.waitSeq(gprs[cpu.PC]);
			var aluOut = (gprs[rd] >>> 0) + (gprs[rm] >>> 0);
			cpu.cpsrN = aluOut & 0x80000000;
			cpu.cpsrZ = !(aluOut & 0xFFFFFFFF);
			cpu.cpsrC = aluOut > 0xFFFFFFFF;
			cpu.cpsrV = (gprs[rd] & 0x80000000) == (gprs[rm] & 0x80000000) &&
			            (gprs[rd] & 0x80000000) != (aluOut & 0x80000000) &&
			            (gprs[rm] & 0x80000000) != (aluOut & 0x80000000);
		};
	};

	this.constructCMP2 = function(rd, rm) {
		var gprs = cpu.gprs;
		return function() {
			cpu.mmu.waitSeq(gprs[cpu.PC]);
			var d = gprs[rd];
			var m = gprs[rm];
			var aluOut = d - m;
			var an = aluOut & 0x80000000;
			var dn = d & 0x80000000;
			cpu.cpsrN = an;
			cpu.cpsrZ = !(aluOut & 0xFFFFFFFF);
			cpu.cpsrC = (d >>> 0) >= (m >>> 0);
			cpu.cpsrV = dn != (m & 0x80000000) && dn != an;
		};
	};

	this.constructEOR = function(rd, rm) {
		var gprs = cpu.gprs;
		return function() {
			cpu.mmu.waitSeq(gprs[cpu.PC]);
			gprs[rd] = gprs[rd] ^ gprs[rm];
			cpu.cpsrN = gprs[rd] & 0x80000000;
			cpu.cpsrZ = !(gprs[rd] & 0xFFFFFFFF);
		};
	};

	this.constructLSL2 = function(rd, rm) {
		var gprs = cpu.gprs;
		return function() {
			cpu.mmu.waitSeq(gprs[cpu.PC]);
			var rs = gprs[rm] & 0xFF;
			if (rs) {
				if (rs < 32) {
					cpu.cpsrC = gprs[rd] & (1 << (32 - rs));
					gprs[rd] <<= rs;
				} else {
					if (rs > 32) {
						cpu.cpsrC = 0;
					} else {
						cpu.cpsrC = gprs[rd] & 0x00000001;
					}
					gprs[rd] = 0;
				}
			}
			cpu.cpsrN = gprs[rd] & 0x80000000;
			cpu.cpsrZ = !(gprs[rd] & 0xFFFFFFFF);
		};
	};

	this.constructLSR2 = function(rd, rm) {
		var gprs = cpu.gprs;
		return function() {
			cpu.mmu.waitSeq(gprs[cpu.PC]);
			var rs = gprs[rm] & 0xFF;
			if (rs) {
				if (rs < 32) {
					cpu.cpsrC = gprs[rd] & (1 << (rs - 1));
					gprs[rd] >>>= rs;
				} else {
					if (rs > 32) {
						cpu.cpsrC = 0;
					} else {
						cpu.cpsrC = gprs[rd] & 0x80000000;
					}
					gprs[rd] = 0;
				}
			}
			cpu.cpsrN = gprs[rd] & 0x80000000;
			cpu.cpsrZ = !(gprs[rd] & 0xFFFFFFFF);
		};
	};

	this.constructMUL = function(rd, rm) {
		var gprs = cpu.gprs;
		return function() {
			// TODO: implement timings
			if ((gprs[rm] & 0xFFFF0000) && (gprs[rd] & 0xFFFF0000)) {
				// Our data type is a double--we'll lose bits if we do it all at once!
				var hi = ((gprs[rd] & 0xFFFF0000) * gprs[rm]) & 0xFFFFFFFF;
				var lo = ((gprs[rd] & 0x0000FFFF) * gprs[rm]) & 0xFFFFFFFF;
				gprs[rd] = (hi + lo) & 0xFFFFFFFF;
			} else {
				gprs[rd] *= gprs[rm];
			}
			cpu.cpsrN = gprs[rd] & 0x80000000;
			cpu.cpsrZ = !(gprs[rd] & 0xFFFFFFFF);
		};
	};

	this.constructMVN = function(rd, rm) {
		var gprs = cpu.gprs;
		return function() {
			cpu.mmu.waitSeq(gprs[cpu.PC]);
			gprs[rd] = ~gprs[rm];
			cpu.cpsrN = gprs[rd] & 0x80000000;
			cpu.cpsrZ = !(gprs[rd] & 0xFFFFFFFF);
		};
	};

	this.constructNEG = function(rd, rm) {
		var gprs = cpu.gprs;
		return function() {
			cpu.mmu.waitSeq(gprs[cpu.PC]);
			var d = -gprs[rm];
			cpu.cpsrN = d & 0x80000000;
			cpu.cpsrZ = !(d & 0xFFFFFFFF);
			cpu.cpsrC = 0 >= (d >>> 0);
			cpu.cpsrV = (gprs[rm] & 0x80000000) && (d & 0x80000000);
			gprs[rd] = d;
		};
	};

	this.constructORR = function(rd, rm) {
		var gprs = cpu.gprs;
		return function() {
			cpu.mmu.waitSeq(gprs[cpu.PC]);
			gprs[rd] = gprs[rd] | gprs[rm];
			cpu.cpsrN = gprs[rd] & 0x80000000;
			cpu.cpsrZ = !(gprs[rd] & 0xFFFFFFFF);
		};
	};

	this.constructROR = function(rd, rm) {
		var gprs = cpu.gprs;
		return function() {
			cpu.mmu.waitSeq(gprs[cpu.PC]);
			var rs = gprs[rm] & 0xFF;
			if (rs) {
				var r4 = rs & 0x0F;
				if (r4 > 0) {
					cpu.cpsrC = gprs[rd] & (1 << (r4 - 1));
					gprs[rd] = (gprs[rd] >>> r4) | (gprs[rd] << (32 - r4));
				} else {
					cpu.cpsrC = gprs[rd] & 0x80000000;
				}
			}
			cpu.cpsrN = gprs[rd] & 0x80000000;
			cpu.cpsrZ = !(gprs[rd] & 0xFFFFFFFF);
		};
	};

	this.constructSBC = function(rd, rm) {
		var gprs = cpu.gprs;
		return function() {
			cpu.mmu.waitSeq(gprs[cpu.PC]);
			var m = (gprs[rm] >>> 0) + !cpu.cpsrC;
			var d = (gprs[rd] >>> 0) - m;
			cpu.cpsrN = d & 0x80000000;
			cpu.cpsrZ = !(d & 0xFFFFFFFF);
			cpu.cpsrC = d > 0xFFFFFFFF;
			cpu.cpsrV = ((gprs[rd] ^ m) & 0x80000000) && ((gprs[rd] ^ d) & 0x80000000);
			gprs[rd] = d;
		};
	};

	this.constructTST = function(rd, rm) {
		var gprs = cpu.gprs;
		return function() {
			cpu.mmu.waitSeq(gprs[cpu.PC]);
			var aluOut = gprs[rd] & gprs[rm];
			cpu.cpsrN = aluOut & 0x80000000;
			cpu.cpsrZ = !(aluOut & 0xFFFFFFFF);
		};
	};
};
