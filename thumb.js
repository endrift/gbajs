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

	this.constructADD2 = function(rn, immediate) {
		var gprs = cpu.gprs;
		return function() {
			cpu.mmu.waitSeq(gprs[cpu.PC]);
			var d = (gprs[rn] >>> 0) + immediate;
			cpu.cpsrN = d & 0x80000000;
			cpu.cpsrZ = !(d & 0xFFFFFFFF);
			cpu.cpsrC = d > 0xFFFFFFFF;
			cpu.cpsrV = !(gprs[rn] & 0x80000000) && ((gprs[rn] ^ d) & 0x80000000) && ((immediate ^ d) & 0x80000000);
			gprs[rn] = d;
		};
	};

	this.constructADD3 = function(rd, rn, rm) {
		var gprs = cpu.gprs;
		return function() {
			cpu.mmu.waitSeq(gprs[cpu.PC]);
			var d = (gprs[rn] >>> 0) + (gprs[rm] >>> 0);
			cpu.cpsrN = d & 0x80000000;
			cpu.cpsrZ = !(d & 0xFFFFFFFF);
			cpu.cpsrC = d > 0xFFFFFFFF;
			cpu.cpsrV = !((gprs[rn] ^ gprs[rm]) & 0x80000000) && ((gprs[rn] ^ d) & 0x80000000) && ((gprs[rm] ^ d) & 0x80000000);
			gprs[rd] = d;
		};
	};

	this.constructADD4 = function(rd, rm) {
		var gprs = cpu.gprs;
		return function() {
			cpu.mmu.waitSeq(gprs[cpu.PC]);
			gprs[rd] += gprs[rm];
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

	this.constructASR1 = function(rd, rm, immediate) {
		var gprs = cpu.gprs;
		return function() {
			cpu.mmu.waitSeq(gprs[cpu.PC]);
			if (immediate == 0) {
				cpu.cpsrC = gprs[rm] & 0x80000000;
				if (cpu.cpsrC) {
					gprs[rd] = 0xFFFFFFFF;
				} else {
					gprs[rd] = 0;
				}
			} else {
				cpu.cpsrC = gprs[rm] & (1 << (immediate - 1));
				gprs[rd] = gprs[rm] >> immediate;
			}
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

	this.constructBX = function(rd, rm) {
		var gprs = cpu.gprs;
		return function() {
			// TODO: implement timings
			cpu.switchExecMode(gprs[rm] & 0x00000001);
			gprs[cpu.PC] = gprs[rm] & 0xFFFFFFFE;
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

	this.constructCMP1 = function(rn, immediate) {
		var gprs = cpu.gprs;
		return function() {
			cpu.mmu.waitSeq(gprs[cpu.PC]);
			var aluOut = gprs[rn] - immediate;
			cpu.cpsrN = aluOut & 0x80000000;
			cpu.cpsrZ = !(aluOut & 0xFFFFFFFF);
			cpu.cpsrC = (gprs[rn] >>> 0) >= immediate;
			cpu.cpsrV = (gprs[rn] & 0x80000000) && ((gprs[rn] ^ aluOut) & 0x80000000);
		};
	}

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

	this.constructCMP3 = function(rd, rm) {
		var gprs = cpu.gprs;
		return function() {
			cpu.mmu.waitSeq(gprs[cpu.PC]);
			var aluOut = gprs[rd] - gprs[rm];
			cpu.cpsrN = aluOut & 0x80000000;
			cpu.cpsrZ = !(aluOut & 0xFFFFFFFF);
			cpu.cpsrC = (gprs[rd] >>> 0) >= (gprs[rm] >>> 0);
			cpu.cpsrV = ((gprs[rd] ^ gprs[rm]) & 0x80000000) && ((gprs[rd] ^ aluOut) & 0x80000000);
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

	this.constructLDR1 = function(rd, rn, immediate) {
		var gprs = cpu.gprs;
		return function() {
			var n = gprs[rn] + immediate;
			cpu.mmu.waitSeq(gprs[cpu.PC]);
			cpu.mmu.wait32(n);
			++cpu.cycles;
			gprs[rd] = cpu.mmu.load32(n);
		};
	};

	this.constructLDRB1 = function(rd, rn, immediate) {
		var gprs = cpu.gprs;
		return function() {
			var n = gprs[rn] + immediate;
			cpu.mmu.waitSeq(gprs[cpu.PC]);
			cpu.mmu.wait(n);
			++cpu.cycles;
			gprs[rd] = cpu.mmu.loadU8(n);
		};
	};

	this.constructLSL1 = function(rd, rm, immediate) {
		var gprs = cpu.gprs;
		return function() {
			cpu.mmu.waitSeq(gprs[cpu.PC]);
			if (immediate == 0) {
				gprs[rd] = gprs[rm];
			} else {
				cpu.cpsrC = gprs[rm] & (1 << (32 - immediate));
				gprs[rd] = gprs[rm] << immediate;
			}
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

	this.constructLSR1 = function(rd, rm, immediate) {
		var gprs = cpu.gprs;
		return function() {
			cpu.mmu.waitSeq(gprs[cpu.PC]);
			if (immediate == 0) {
				cpu.cpsrC = gprs[rm] & 0x80000000;
				gprs[rd] = 0;
			} else {
				cpu.cpsrC = gprs[rm] & (1 << (immediate - 1));
				gprs[rd] = gprs[rm] >>> immediate;
			}
			cpu.cpsrN = 0;
			cpu.cpsrZ = !(gprs[rd] & 0xFFFFFFFF);
		};
	}

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

	this.constructMOV1 = function(rn, immediate) {
		var gprs = cpu.gprs;
		return function() {
			cpu.mmu.waitSeq(gprs[cpu.PC]);
			gprs[rn] = immediate;
			cpu.cpsrN = immediate & 0x80000000;
			cpu.cpsrZ = !(immediate & 0xFFFFFFFF);
		};
	};

	this.constructMOV2 = function(rd, rn, rm) {
		var gprs = cpu.gprs;
		return function() {
			cpu.mmu.waitSeq(gprs[cpu.PC]);
			var d = gprs[rn];
			cpu.cpsrN = d & 0x80000000;
			cpu.cpsrZ = !(d & 0xFFFFFFFF);
			cpu.cpsrC = 0;
			cpu.cpsrV = 0;
			gprs[rd] = d;
		};
	};

	this.constructMOV3 = function(rd, rm) {
		var gprs = cpu.gprs;
		return function() {
			cpu.mmu.waitSeq(gprs[cpu.PC]);
			gprs[rd] = gprs[rm];
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

	this.constructSTR1 = function(rd, rn, immediate) {
		var gprs = cpu.gprs;
		return function() {
			var n = gprs[rn] + immediate;
			cpu.mmu.store32(n, gprs[rd]);
			cpu.mmu.wait(gprs[cpu.PC]);
			cpu.mmu.wait32(n);
		};
	};

	this.constructSTRB1 = function(rd, rn, immediate) {
		var gprs = cpu.gprs;
		return function() {
			var n = gprs[rn] + immediate;
			cpu.mmu.store8(n, gprs[rd]);
			cpu.mmu.wait(gprs[cpu.PC]);
			cpu.mmu.wait(n);
		};
	};

	this.constructSUB1 = function(rd, rn, immediate) {
		var gprs = cpu.gprs;
		return function() {
			cpu.mmu.waitSeq(gprs[cpu.PC]);
			var d = gprs[rn] - immediate;
			cpu.cpsrN = d & 0x80000000;
			cpu.cpsrZ = !(d & 0xFFFFFFFF);
			cpu.cpsrC = (gprs[rn] >>> 0) >= immediate;
			cpu.cpsrV = (gprs[rn] & 0x80000000) && ((gprs[rn] ^ d) & 0x80000000);
			gprs[rd] = d;
		};
	}

	this.constructSUB2 = function(rn, immediate) {
		var gprs = cpu.gprs;
		return function() {
			cpu.mmu.waitSeq(gprs[cpu.PC]);
			var d = gprs[rn] - immediate;
			cpu.cpsrN = d & 0x80000000;
			cpu.cpsrZ = !(d & 0xFFFFFFFF);
			cpu.cpsrC = (gprs[rn] >>> 0) >= immediate;
			cpu.cpsrV = (gprs[rn] & 0x80000000) && ((gprs[rn] ^ d) & 0x80000000);
			gprs[rn] = d;
		};
	};

	this.constructSUB3 = function(rd, rn, rm) {
		var gprs = cpu.gprs;
		return function() {
			cpu.mmu.waitSeq(gprs[cpu.PC]);
			var d = gprs[rn] - gprs[rm];
			cpu.cpsrN = d & 0x80000000;
			cpu.cpsrZ = !(d & 0xFFFFFFFF);
			cpu.cpsrC = (gprs[rn] >>> 0) >= (gprs[rm] >>> 0);
			cpu.cpsrV = (gprs[rn] & 0x80000000) != (gprs[rm] & 0x80000000) &&
						(gprs[rn] & 0x80000000) != (d & 0x80000000);
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
