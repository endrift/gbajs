ARMCoreArm = function (cpu) {
	this.constructAddressingMode1ASR = function(rs, rm) {
		var gprs = cpu.gprs;
		return function() {
			++cpu.cycles;
			var shift = gprs[rs] & 0xFF;
			if (shift == 0) {
				cpu.shifterOperand = gprs[rm];
				cpu.shifterCarryOut = cpu.cpsrC;
			} else if (shift < 32) {
				cpu.shifterOperand = gprs[rm] >> shift;
				cpu.shifterCarryOut = gprs[rm] & (1 << (shift - 1));
			} else if (gprs[rm] & 0x80000000) {
				cpu.shifterOperand = 0xFFFFFFFF;
				cpu.shifterCarryOut = 0x80000000;
			} else {
				cpu.shifterOperand = 0;
				cpu.shifterCarryOut = 0;
			}
		};
	};

	this.constructAddressingMode1Immediate = function(immediate) {
		return function() {
			cpu.shifterOperand = immediate;
			cpu.shifterCarryOut = cpu.cpsrC;
		};
	};

	this.constructAddressingMode1ImmediateRotate = function(immediate, rotate) {
		return function() {
			cpu.shifterOperand = (immediate >> rotate) | (immediate << (32 - rotate));
			cpu.shifterCarryOut = cpu.shifterOperand & 0x80000000;
		}
	};

	this.constructAddressingMode1LSL = function(rs, rm) {
		var gprs = cpu.gprs;
		return function() {
			++cpu.cycles;
			var shift = gprs[rs] & 0xFF;
			if (shift == 0) {
				cpu.shifterOperand = gprs[rm];
				cpu.shifterCarryOut = cpu.cpsrC;
			} else if (shift < 32) {
				cpu.shifterOperand = gprs[rm] << shift;
				cpu.shifterCarryOut = gprs[rm] & (1 << (32 - shift));
			} else if (shift == 32) {
				cpu.shifterOperand = 0;
				cpu.shifterCarryOut = gprs[rm] & 1;
			} else {
				cpu.shifterOperand = 0;
				cpu.shifterCarryOut = 0;
			}
		};
	};

	this.constructAddressingMode1LSR = function(rs, rm) {
		var gprs = cpu.gprs;
		return function() {
			++cpu.cycles;
			var shift = gprs[rs] & 0xFF;
			if (shift == 0) {
				cpu.shifterOperand = gprs[rm];
				cpu.shifterCarryOut = cpu.cpsrC;
			} else if (shift < 32) {
				cpu.shifterOperand = gprs[rm] >>> shift;
				cpu.shifterCarryOut = gprs[rm] & (1 << (shift - 1));
			} else if (shift == 32) {
				cpu.shifterOperand = 0;
				cpu.shifterCarryOut = gprs[rm] & 0x80000000;
			} else {
				cpu.shifterOperand = 0;
				cpu.shifterCarryOut = 0;
			}
		};
	};

	this.constructAddressingMode1ROR = function(rs, rm) {
		var gprs = cpu.gprs;
		return function() {
			++cpu.cycles;
			var shift = gprs[rs] & 0xFF;
			var rotate = shift & 0x1F;
			if (shift == 0) {
				cpu.shifterOperand = gprs[rm];
				cpu.shifterCarryOut = cpu.cpsrC;
			} else if (rotate) {
				cpu.shifterOperand = (gprs[rm] >>> rotate) | (gprs[rm] << (32 - rotate));
				cpu.shifterCarryOut = gprs[rm] & (1 << (rotate - 1));
			} else {
				cpu.shifterOperand = gprs[rm];
				cpu.shifterCarryOut = gprs[rm] & 0x80000000;
			}
		};
	};

	this.addressingMode23Immediate = [
		// 000x0
		function(rn, offset, condOp) {
			var gprs = cpu.gprs;
			var address = function() {
				var addr = gprs[rn];
				if (!condOp || condOp()) {
					gprs[rn] -= offset;
				}
				return addr;
			};
			address.writesPC = rn == cpu.PC;
			return address;
		},

		// 000xW
		null,

		null,
		null,

		// 00Ux0
		function(rn, offset, condOp) {
			var gprs = cpu.gprs;
			var address = function() {
				var addr = gprs[rn];
				if (!condOp || condOp()) {
					gprs[rn] += offset;
				}
				return addr;
			};
			address.writesPC = rn == cpu.PC;
			return address;
		},

		// 00UxW
		null,

		null,
		null,

		// 0P0x0
		function(rn, offset, condOp) {
			var gprs = cpu.gprs;
			var address = function() {
				return addr = gprs[rn] - offset;
			};
			address.writesPC = false;
			return address;
		},

		// 0P0xW
		function(rn, offset, condOp) {
			var gprs = cpu.gprs;
			var address = function() {
				var addr = gprs[rn] - offset;
				if (!condOp || condOp()) {
					gprs[rn] = addr;
				}
				return addr;
			};
			address.writesPC = rn == cpu.PC;
			return address;
		},

		null,
		null,

		// 0PUx0
		function(rn, offset, condOp) {
			var gprs = cpu.gprs;
			var address = function() {
				return addr = gprs[rn] + offset;
			};
			address.writesPC = false;
			return address;
		},

		// 0PUxW
		function(rn, offset, condOp) {
			var gprs = cpu.gprs;
			var address = function() {
				var addr = gprs[rn] + offset;
				if (!condOp || condOp()) {
					gprs[rn] = addr;
				}
				return addr;
			};
			address.writesPC = rn == cpu.PC;
			return address;
		},

		null,
		null,
	];

	this.addressingMode23Register = [
		// I00x0
		function(rn, rm, condOp) {
			var gprs = cpu.gprs;
			var address = function() {
				var addr = gprs[rn];
				if (!condOp || condOp()) {
					gprs[rn] -= gprs[rm];
				}
				return addr;
			};
			address.writesPC = rn == cpu.PC;
			return address;
		},

		// I00xW
		null,

		null,
		null,

		// I0Ux0
		function(rn, rm, condOp) {
			var gprs = cpu.gprs;
			var address = function() {
				var addr = gprs[rn];
				if (!condOp || condOp()) {
					gprs[rn] += gprs[rm];
				}
				return addr;
			};
			address.writesPC = rn == cpu.PC;
			return address;
		},

		// I0UxW
		null,

		null,
		null,

		// IP0x0
		function(rn, rm, condOp) {
			var gprs = cpu.gprs;
			var address = function() {
				return gprs[rn] - gprs[rm];
			};
			address.writesPC = false;
			return address;
		},

		// IP0xW
		function(rn, rm, condOp) {
			var gprs = cpu.gprs;
			var address = function() {
				var addr = gprs[rn] - gprs[rm];
				if (!condOp || condOp()) {
					gprs[rn] = addr;
				}
				return addr;
			};
			address.writesPC = rn == cpu.PC;
			return address;
		},

		null,
		null,

		// IPUx0
		function(rn, rm, condOp) {
			var gprs = cpu.gprs;
			var address = function() {
				var addr = gprs[rn] + gprs[rm];
				return addr;
			};
			address.writesPC = false;
			return address;
		},

		// IPUxW
		function(rn, rm, condOp) {
			var gprs = cpu.gprs;
			var address = function() {
				var addr = gprs[rn] + gprs[rm];
				if (!condOp || condOp()) {
					gprs[rn] = addr;
				}
				return addr;
			};
			address.writesPC = rn == cpu.PC;
			return address;
		},

		null,
		null
	];

	this.addressingMode2RegisterShifted = [
		// I00x0
		function(rn, shiftOp, condOp) {
			var gprs = cpu.gprs;
			var address = function() {
				var addr = gprs[rn];
				if (!condOp || condOp()) {
					shiftOp();
					gprs[rn] -= cpu.shifterOperand;
				}
				return addr;
			};
			address.writesPC = rn == cpu.PC;
			return address;
		},

		// I00xW
		null,

		null,
		null,

		// I0Ux0
		function(rn, shiftOp, condOp) {
			var gprs = cpu.gprs;
			var address = function() {
				var addr = gprs[rn];
				if (!condOp || condOp()) {
					shiftOp();
					gprs[rn] += cpu.shifterOperand;
				}
				return addr;
			};
			address.writesPC = rn == cpu.PC;
			return address;
		},
		// I0UxW
		null,

		null,
		null,

		// IP0x0
		function(rn, shiftOp, condOp) {
			var gprs = cpu.gprs;
			var address = function() {
				shiftOp();
				return gprs[rn] - cpu.shifterOperand;
			};
			address.writesPC = false;
			return address;
		},

		// IP0xW
		function(rn, shiftOp, condOp) {
			var gprs = cpu.gprs;
			var address = function() {
				shiftOp();
				var addr = gprs[rn] - cpu.shifterOperand;
				if (!condOp || condOp()) {
					gprs[rn] = addr;
				}
				return addr;
			};
			address.writesPC = rn == cpu.PC;
			return address;
		},

		null,
		null,

		// IPUx0
		function(rn, shiftOp, condOp) {
			var gprs = cpu.gprs;
			var address = function() {
				shiftOp();
				return gprs[rn] + cpu.shifterOperand;
			};
			address.writesPC = false;
			return address;
		},

		// IPUxW
		function(rn, shiftOp, condOp) {
			var gprs = cpu.gprs;
			var address = function() {
				shiftOp();
				var addr = gprs[rn] + cpu.shifterOperand;
				if (!condOp || condOp()) {
					gprs[rn] = addr;
				}
				return addr;
			};
			address.writePC = rn == cpu.PC;
			return address;
		},

		null,
		null,
	];

	this.constructAddressingMode23Immediate = function(instruction, immediate, condOp) {
		var rn = (instruction & 0x000F0000) >> 16;
		return this.addressingMode23Immediate[(instruction & 0x01A00000) >> 21](rn, immediate, condOp);
	};

	this.constructAddressingMode23Register = function(instruction, rm, condOp) {
		var rn = (instruction & 0x000F0000) >> 16;
		return this.addressingMode23Register[(instruction & 0x01A00000) >> 21](rn, rm, condOp);
	};

	this.constructAddressingMode2RegisterShifted = function(instruction, shiftOp, condOp) {
		var rn = (instruction & 0x000F0000) >> 16;
		return this.addressingMode2RegisterShifted[(instruction & 0x01A00000) >> 21](rn, shiftOp, condOp);
	};

	this.constructAddressingMode4 = function(immediate, rn) {
		var gprs = cpu.gprs;
		return function() {
			var addr = gprs[rn] + immediate;
			return addr;
		}
	};

	this.constructAddressingMode4Writeback = function(immediate, offset, rn) {
		var gprs = cpu.gprs;
		return function() {
			var addr = gprs[rn] + immediate;
			gprs[rn] += offset;
			return addr;
		}
	};

	this.constructADC = function(rd, rn, shiftOp, condOp) {
		var gprs = cpu.gprs;
		return function() {
			cpu.mmu.waitSeq32(gprs[cpu.PC]);
			if (condOp && !condOp()) {
				return;
			}
			shiftOp();
			var shifterOperand = (cpu.shifterOperand >>> 0) + !!cpu.cpsrC;
			gprs[rd] = (gprs[rn] >>> 0) + shifterOperand;
		};
	};

	this.constructADCS = function(rd, rn, shiftOp, condOp) {
		var gprs = cpu.gprs;
		return function() {
			cpu.mmu.waitSeq32(gprs[cpu.PC]);
			if (condOp && !condOp()) {
				return;
			}
			shiftOp();
			var shifterOperand = (cpu.shifterOperand >>> 0) + !!cpu.cpsrC;
			var d = (gprs[rn] >>> 0) + shifterOperand;
			if (rd == cpu.PC && cpu.hasSPSR()) {
				cpu.unpackCPSR(cpu.spsr);
			} else {
				cpu.cpsrN = d & 0x80000000;
				cpu.cpsrZ = !(d & 0xFFFFFFFF);
				cpu.cpsrC = d > 0xFFFFFFFF;
				cpu.cpsrV = (gprs[rn] & 0x80000000) == (shifterOperand & 0x80000000) &&
							(gprs[rn] & 0x80000000) != (d & 0x80000000) &&
							(shifterOperand & 0x80000000) != (d & 0x80000000);
			}
			gprs[rd] = d;
		};
	};

	this.constructADD = function(rd, rn, shiftOp, condOp) {
		var gprs = cpu.gprs;
		return function() {
			cpu.mmu.waitSeq32(gprs[cpu.PC]);
			if (condOp && !condOp()) {
				return;
			}
			shiftOp();
			gprs[rd] = (gprs[rn] >>> 0) + (cpu.shifterOperand >>> 0);
		};
	};

	this.constructADDS = function(rd, rn, shiftOp, condOp) {
		var gprs = cpu.gprs;
		return function() {
			cpu.mmu.waitSeq32(gprs[cpu.PC]);
			if (condOp && !condOp()) {
				return;
			}
			shiftOp();
			var d = (gprs[rn] >>> 0) + (cpu.shifterOperand >>> 0);
			if (rd == cpu.PC && cpu.hasSPSR()) {
				cpu.unpackCPSR(cpu.spsr);
			} else {
				cpu.cpsrN = d & 0x80000000;
				cpu.cpsrZ = !(d & 0xFFFFFFFF);
				cpu.cpsrC = d > 0xFFFFFFFF;
				cpu.cpsrV = (gprs[rn] & 0x80000000) == (cpu.shifterOperand & 0x80000000) &&
							(gprs[rn] & 0x80000000) != (d & 0x80000000) &&
							(cpu.shifterOperand & 0x80000000) != (d & 0x80000000);
			}
			gprs[rd] = d;
		};
	};

	this.constructAND = function(rd, rn, shiftOp, condOp) {
		var gprs = cpu.gprs;
		return function() {
			cpu.mmu.waitSeq32(gprs[cpu.PC]);
			if (condOp && !condOp()) {
				return;
			}
			shiftOp();
			gprs[rd] = gprs[rn] & cpu.shifterOperand;
		};
	};

	this.constructANDS = function(rd, rn, shiftOp, condOp) {
		var gprs = cpu.gprs;
		return function() {
			cpu.mmu.waitSeq32(gprs[cpu.PC]);
			if (condOp && !condOp()) {
				return;
			}
			shiftOp();
			gprs[rd] = gprs[rn] & cpu.shifterOperand;
			if (rd == cpu.PC && cpu.hasSPSR()) {
				cpu.unpackCPSR(cpu.spsr);
			} else {
				cpu.cpsrN = gprs[rd] & 0x80000000;
				cpu.cpsrZ = !(gprs[rd] & 0xFFFFFFFF);
				cpu.cpsrC = cpu.shifterCarryOut;
			}
		};
	};

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

	this.constructBIC = function(rd, rn, shiftOp, condOp) {
		var gprs = cpu.gprs;
		return function() {
			cpu.mmu.waitSeq32(gprs[cpu.PC]);
			if (condOp && !condOp()) {
				return;
			}
			shiftOp();
			gprs[rd] = gprs[rn] & ~cpu.shifterOperand;
		};
	};

	this.constructBICS = function(rd, rn, shiftOp, condOp) {
		var gprs = cpu.gprs;
		return function() {
			cpu.mmu.waitSeq32(gprs[cpu.PC]);
			if (condOp && !condOp()) {
				return;
			}
			shiftOp();
			gprs[rd] = gprs[rn] & ~cpu.shifterOperand;
			if (rd == cpu.PC && cpu.hasSPSR()) {
				cpu.unpackCPSR(cpu.spsr);
			} else {
				cpu.cpsrN = gprs[rd] & 0x80000000;
				cpu.cpsrZ = !(gprs[rd] & 0xFFFFFFFF);
				cpu.cpsrC = cpu.shifterCarryOut;
			}
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

	this.constructCMN = function(rn, shiftOp, condOp) {
		var gprs = cpu.gprs;
		return function() {
			cpu.mmu.waitSeq32(gprs[cpu.PC]);
			if (condOp && !condOp()) {
				return;
			}
			shiftOp();
			var aluOut = (gprs[rn] >>> 0) + (cpu.shifterOperand >>> 0);
			cpu.cpsrN = aluOut & 0x80000000;
			cpu.cpsrZ = !(aluOut & 0xFFFFFFFF);
			cpu.cpsrC = aluOut > 0xFFFFFFFF;
			cpu.cpsrV = (gprs[rn] & 0x80000000) == (cpu.shifterOperand & 0x80000000) &&
						(gprs[rn] & 0x80000000) != (aluOut & 0x80000000) &&
						(cpu.shifterOperand & 0x80000000) != (aluOut & 0x80000000);
		};
	};

	this.constructCMP = function(rn, shiftOp, condOp) {
		var gprs = cpu.gprs;
		return function() {
			cpu.mmu.waitSeq32(gprs[cpu.PC]);
			if (condOp && !condOp()) {
				return;
			}
			shiftOp();
			var aluOut = gprs[rn] - cpu.shifterOperand;
			cpu.cpsrN = aluOut & 0x80000000;
			cpu.cpsrZ = !(aluOut & 0xFFFFFFFF);
			cpu.cpsrC = (gprs[rn] >>> 0) >= (cpu.shifterOperand >>> 0);
			cpu.cpsrV = (gprs[rn] & 0x80000000) != (cpu.shifterOperand & 0x80000000) &&
						(gprs[rn] & 0x80000000) != (aluOut & 0x80000000);
		};
	};

	this.constructEOR = function(rd, rn, shiftOp, condOp) {
		var gprs = cpu.gprs;
		return function() {
			cpu.mmu.waitSeq32(gprs[cpu.PC]);
			if (condOp && !condOp()) {
				return;
			}
			shiftOp();
			gprs[rd] = gprs[rn] ^ cpu.shifterOperand;
		};
	};

	this.constructEORS = function(rd, rn, shiftOp, condOp) {
		var gprs = cpu.gprs;
		return function() {
			cpu.mmu.waitSeq32(gprs[cpu.PC]);
			if (condOp && !condOp()) {
				return;
			}
			shiftOp();
			gprs[rd] = gprs[rn] ^ cpu.shifterOperand;
			if (rd == cpu.PC && cpu.hasSPSR()) {
				cpu.unpackCPSR(cpu.spsr);
			} else {
				cpu.cpsrN = gprs[rd] & 0x80000000;
				cpu.cpsrZ = !(gprs[rd] & 0xFFFFFFFF);
				cpu.cpsrC = cpu.shifterCarryOut;
			}
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
			for (m = rs, i = 0; m; m >>= 1, ++i) {
				if (m & 1) {
					mmu.waitSeq32(addr);
					gprs[i] = mmu.load32(addr);
					addr += 4;
				}
			}
			++cpu.cycles;
		};
	};

	this.constructLDR = function(rd, address, condOp) {
		var gprs = cpu.gprs;
		return function() {
			if (condOp && !condOp()) {
				cpu.mmu.waitSeq32(gprs[cpu.PC]);
				return;
			}
			var addr = address();
			cpu.mmu.wait32(addr);
			cpu.mmu.wait32(gprs[cpu.PC]);
			gprs[rd] = cpu.mmu.load32(addr);
		};
	};

	this.constructLDRB = function(rd, address, condOp) {
		var gprs = cpu.gprs;
		return function() {
			cpu.mmu.waitSeq32(gprs[cpu.PC]);
			if (condOp && !condOp()) {
				return;
			}
			var addr = address();
			cpu.mmu.wait32(addr);
			++cpu.cycles;
			gprs[rd] = cpu.mmu.loadU8(addr);
		};
	};

	this.constructLDRH = function(rd, address, condOp) {
		var gprs = cpu.gprs;
		return function() {
			cpu.mmu.waitSeq32(gprs[cpu.PC]);
			if (condOp && !condOp()) {
				return;
			}
			var addr = address();
			cpu.mmu.wait32(addr);
			++cpu.cycles;
			gprs[rd] = cpu.mmu.loadU16(addr);
		};
	};

	this.constructLDRSB = function(rd, address, condOp) {
		var gprs = cpu.gprs;
		return function() {
			cpu.mmu.waitSeq32(gprs[cpu.PC]);
			if (condOp && !condOp()) {
				return;
			}
			var addr = address();
			cpu.mmu.wait32(addr);
			++cpu.cycles;
			gprs[rd] = cpu.mmu.load8(addr);
		};
	};

	this.constructLDRSH = function(rd, address, condOp) {
		var gprs = cpu.gprs;
		return function() {
			cpu.mmu.waitSeq32(gprs[cpu.PC]);
			if (condOp && !condOp()) {
				return;
			}
			var addr = address();
			cpu.mmu.wait32(addr);
			++cpu.cycles;
			gprs[rd] = cpu.mmu.load16(addr);
		};
	};

	this.constructMLA = function(rd, rn, rs, rm, condOp) {
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
		};
	};

	this.constructMLAS = function(rd, rn, rs, rm, condOp) {
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
			cpu.cpsrN = gprs[rd] & 0x80000000;
			cpu.cpsrZ = !(gprs[rd] & 0xFFFFFFFF);
		};
	};

	this.constructMOV = function(rd, rn, shiftOp, condOp) {
		var gprs = cpu.gprs;
		return function() {
			cpu.mmu.waitSeq32(gprs[cpu.PC]);
			if (condOp && !condOp()) {
				return;
			}
			shiftOp();
			gprs[rd] = cpu.shifterOperand;
		};
	};

	this.constructMOVS = function(rd, rn, shiftOp, condOp) {
		var gprs = cpu.gprs;
		return function() {
			cpu.mmu.waitSeq32(gprs[cpu.PC]);
			if (condOp && !condOp()) {
				return;
			}
			shiftOp();
			gprs[rd] = cpu.shifterOperand;
			if (rd == cpu.PC && cpu.hasSPSR()) {
				cpu.unpackCPSR(cpu.spsr);
			} else {
				cpu.cpsrN = gprs[rd] & 0x80000000;
				cpu.cpsrZ = !(gprs[rd] & 0xFFFFFFFF);
				cpu.cpsrC = cpu.shifterCarryOut;
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

	this.constructMUL = function(rd, rs, rm, condOp) {
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
		};
	};

	this.constructMULS = function(rd, rs, rm, condOp) {
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
			cpu.cpsrN = gprs[rd] & 0x80000000;
			cpu.cpsrZ = !(gprs[rd] & 0xFFFFFFFF);
		};
	};

	this.constructMVN = function(rd, rn, shiftOp, condOp) {
		var gprs = cpu.gprs;
		return function() {
			cpu.mmu.waitSeq32(gprs[cpu.PC]);
			if (condOp && !condOp()) {
				return;
			}
			shiftOp();
			gprs[rd] = ~cpu.shifterOperand;
		};
	};

	this.constructMVNS = function(rd, rn, shiftOp, condOp) {
		var gprs = cpu.gprs;
		return function() {
			cpu.mmu.waitSeq32(gprs[cpu.PC]);
			if (condOp && !condOp()) {
				return;
			}
			shiftOp();
			gprs[rd] = ~cpu.shifterOperand;
			if (rd == cpu.PC && cpu.hasSPSR()) {
				cpu.unpackCPSR(cpu.spsr);
			} else {
				cpu.cpsrN = gprs[rd] & 0x80000000;
				cpu.cpsrZ = !(gprs[rd] & 0xFFFFFFFF);
				cpu.cpsrC = cpu.shifterCarryOut;
			}
		};
	};

	this.constructORR = function(rd, rn, shiftOp, condOp) {
		var gprs = cpu.gprs;
		return function() {
			cpu.mmu.waitSeq32(gprs[cpu.PC]);
			if (condOp && !condOp()) {
				return;
			}
			shiftOp();
			gprs[rd] = gprs[rn] | cpu.shifterOperand;
		}
	};

	this.constructORRS = function(rd, rn, shiftOp, condOp) {
		var gprs = cpu.gprs;
		return function() {
			cpu.mmu.waitSeq32(gprs[cpu.PC]);
			if (condOp && !condOp()) {
				return;
			}
			shiftOp();
			gprs[rd] = gprs[rn] | cpu.shifterOperand;
			if (rd == cpu.PC && cpu.hasSPSR()) {
				cpu.unpackCPSR(cpu.spsr);
			} else {
				cpu.cpsrN = gprs[rd] & 0x80000000;
				cpu.cpsrZ = !(gprs[rd] & 0xFFFFFFFF);
				cpu.cpsrC = cpu.shifterCarryOut;
			}
		};
	};

	this.constructRSB = function(rd, rn, shiftOp, condOp) {
		var gprs = cpu.gprs;
		return function() {
			cpu.mmu.waitSeq32(gprs[cpu.PC]);
			if (condOp && !condOp()) {
				return;
			}
			shiftOp();
			gprs[rd] = cpu.shifterOperand - gprs[rn];
		};
	};

	this.constructRSBS = function(rd, rn, shiftOp, condOp) {
		var gprs = cpu.gprs;
		return function() {
			cpu.mmu.waitSeq32(gprs[cpu.PC]);
			if (condOp && !condOp()) {
				return;
			}
			shiftOp();
			var d = cpu.shifterOperand - gprs[rn];
			if (rd == cpu.PC && cpu.hasSPSR()) {
				cpu.unpackCPSR(cpu.spsr);
			} else {
				cpu.cpsrN = d & 0x80000000;
				cpu.cpsrZ = !(d & 0xFFFFFFFF);
				cpu.cpsrC = (cpu.shifterOperand >>> 0) >= (gprs[rn] >>> 0);
				cpu.cpsrV = (cpu.shifterOperand & 0x80000000) != (gprs[rn] & 0x80000000) &&
							(cpu.shifterOperand & 0x80000000) != (d & 0x80000000);
			}
			gprs[rd] = d;
		};
	};

	this.constructRSC = function(rd, rn, shiftOp, condOp) {
		var gprs = cpu.gprs;
		return function() {
			cpu.mmu.waitSeq32(gprs[cpu.PC]);
			if (condOp && !condOp()) {
				return;
			}
			shiftOp();
			var n = (gprs[rn] >>> 0) + !cpu.cpsrC;
			gprs[rd] = (cpu.shifterOperand >>> 0) - n;
		};
	};

	this.constructRSCS = function(rd, rn, shiftOp, condOp) {
		var gprs = cpu.gprs;
		return function() {
			cpu.mmu.waitSeq32(gprs[cpu.PC]);
			if (condOp && !condOp()) {
				return;
			}
			shiftOp();
			var n = (gprs[rn] >>> 0) + !cpu.cpsrC;
			var d = (cpu.shifterOperand >>> 0) - n;
			if (rd == cpu.PC && cpu.hasSPSR()) {
				cpu.unpackCPSR(cpu.spsr);
			} else {
				cpu.cpsrN = d & 0x80000000;
				cpu.cpsrZ = !(d & 0xFFFFFFFF);
				cpu.cpsrC = d > 0xFFFFFFFF;
				cpu.cpsrV = (cpu.shifterOperand & 0x80000000) != (n & 0x80000000) &&
							(cpu.shifterOperand & 0x80000000) != (d & 0x80000000);
			}
			gprs[rd] = d;
		};
	};

	this.constructSBC = function(rd, rn, shiftOp, condOp) {
		var gprs = cpu.gprs;
		return function() {
			cpu.mmu.waitSeq32(gprs[cpu.PC]);
			if (condOp && !condOp()) {
				return;
			}
			shiftOp();
			var shifterOperand = (cpu.shifterOperand >>> 0) + !cpu.cpsrC;
			gprs[rd] = (gprs[rn] >>> 0) - shifterOperand;
		};
	};

	this.constructSBCS = function(rd, rn, shiftOp, condOp) {
		var gprs = cpu.gprs;
		return function() {
			cpu.mmu.waitSeq32(gprs[cpu.PC]);
			if (condOp && !condOp()) {
				return;
			}
			shiftOp();
			var shifterOperand = (cpu.shifterOperand >>> 0) + !cpu.cpsrC;
			var d = (gprs[rn] >>> 0) - shifterOperand;
			if (rd == cpu.PC && cpu.hasSPSR()) {
				cpu.unpackCPSR(cpu.spsr);
			} else {
				cpu.cpsrN = d & 0x80000000;
				cpu.cpsrZ = !(d & 0xFFFFFFFF);
				cpu.cpsrC = d > 0xFFFFFFFF;
				cpu.cpsrV = (gprs[rn] & 0x80000000) != (shifterOperand & 0x80000000) &&
							(gprs[rn] & 0x80000000) != (d & 0x80000000);
			}
			gprs[rd] = d;
		};
	};

	this.constructSMLAL = function(rd, rn, rs, rm, condOp) {
		var SHIFT_32 = 1/0x100000000;
		var gprs = cpu.gprs;
		return function() {
			cpu.mmu.waitSeq32(gprs[cpu.PC]);
			if (condOp && !condOp()) {
				return;
			}
			cpu.cycles += 6; // TODO: better timing
			var hi = ((gprs[rm] & 0xFFFF0000) >> 0) * (gprs[rs] >> 0);
			var lo = ((gprs[rm] & 0x0000FFFF) >> 0) * (gprs[rs] >> 0);
			var mid = (hi & 0xFFFFFFFF) + (lo & 0xFFFFFFFF);
			gprs[rn] += mid & 0xFFFFFFFF;
			gprs[rd] += Math.floor(hi * SHIFT_32 + lo * SHIFT_32 + mid * SHIFT_32);
		};
	};

	this.constructSMLALS = function(rd, rn, rs, rm, condOp) {
		var SHIFT_32 = 1/0x100000000;
		var gprs = cpu.gprs;
		return function() {
			cpu.mmu.waitSeq32(gprs[cpu.PC]);
			if (condOp && !condOp()) {
				return;
			}
			cpu.cycles += 6; // TODO: better timing
			var hi = ((gprs[rm] & 0xFFFF0000) >> 0) * (gprs[rs] >> 0);
			var lo = ((gprs[rm] & 0x0000FFFF) >> 0) * (gprs[rs] >> 0);
			var mid = (hi & 0xFFFFFFFF) + (lo & 0xFFFFFFFF);
			gprs[rn] += mid & 0xFFFFFFFF;
			gprs[rd] += Math.floor(hi * SHIFT_32 + lo * SHIFT_32 + mid * SHIFT_32);
			cpu.cpsrN = gprs[rd] & 0x80000000;
			cpu.cpsrZ = !((gprs[rd] & 0xFFFFFFFF) || (gprs[rn] & 0xFFFFFFFF));
		};
	};

	this.constructSMULL = function(rd, rn, rs, rm, condOp) {
		var SHIFT_32 = 1/0x100000000;
		var gprs = cpu.gprs;
		return function() {
			cpu.mmu.waitSeq32(gprs[cpu.PC]);
			if (condOp && !condOp()) {
				return;
			}
			cpu.cycles += 5; // TODO: better timing
			var hi = ((gprs[rm] & 0xFFFF0000) >> 0) * (gprs[rs] >> 0);
			var lo = ((gprs[rm] & 0x0000FFFF) >> 0) * (gprs[rs] >> 0);
			gprs[rn] = ((hi & 0xFFFFFFFF) + (lo & 0xFFFFFFFF)) & 0xFFFFFFFF;
			gprs[rd] = Math.floor(hi * SHIFT_32 + lo * SHIFT_32);
		};
	};

	this.constructSMULLS = function(rd, rn, rs, rm, condOp) {
		var SHIFT_32 = 1/0x100000000;
		var gprs = cpu.gprs;
		return function() {
			cpu.mmu.waitSeq32(gprs[cpu.PC]);
			if (condOp && !condOp()) {
				return;
			}
			cpu.cycles += 5; // TODO: better timing
			var hi = ((gprs[rm] & 0xFFFF0000) >> 0) * (gprs[rs] >> 0);
			var lo = ((gprs[rm] & 0x0000FFFF) >> 0) * (gprs[rs] >> 0);
			gprs[rn] = ((hi & 0xFFFFFFFF) + (lo & 0xFFFFFFFF)) & 0xFFFFFFFF;
			gprs[rd] = Math.floor(hi * SHIFT_32 + lo * SHIFT_32);
			cpu.cpsrN = gprs[rd] & 0x80000000;
			cpu.cpsrZ = !((gprs[rd] & 0xFFFFFFFF) || (gprs[rn] & 0xFFFFFFFF));
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
			for (m = rs, i = 0; m; m >>= 1, ++i) {
				if (m & 1) {
					mmu.wait32(addr);
					mmu.store32(addr, gprs[i]);
					addr += 4;
					break;
				}
			}
			for (m >>= 1, ++i; m; m >>= 1, ++i) {
				if (m & 1) {
					mmu.waitSeq32(addr);
					mmu.store32(addr, gprs[i]);
					addr += 4;
				}
			}
			cpu.mmu.wait32(gprs[cpu.PC]);
		};
	};

	this.constructSTR = function(rd, address, condOp) {
		var gprs = cpu.gprs;
		return function() {
			if (condOp && !condOp()) {
				cpu.mmu.waitSeq32(gprs[cpu.PC]);
				return;
			}
			var addr = address();
			cpu.mmu.store32(addr, gprs[rd]);
			cpu.mmu.wait32(addr);
			cpu.mmu.wait32(gprs[cpu.PC]);
		};
	};

	this.constructSTRB = function(rd, address, condOp) {
		var gprs = cpu.gprs;
		return function() {
			if (condOp && !condOp()) {
				cpu.mmu.waitSeq32(gprs[cpu.PC]);
				return;
			}
			var addr = address();
			cpu.mmu.store8(addr, gprs[rd]);
			cpu.mmu.wait32(addr);
			cpu.mmu.wait32(gprs[cpu.PC]);
		};
	};

	this.constructSTRH = function(rd, address, condOp) {
		var gprs = cpu.gprs;
		return function() {
			if (condOp && !condOp()) {
				cpu.mmu.waitSeq32(gprs[cpu.PC]);
				return;
			}
			var addr = address();
			cpu.mmu.store16(addr, gprs[rd]);
			cpu.mmu.wait32(addr);
			cpu.mmu.wait32(gprs[cpu.PC]);
		};
	};

	this.constructSUB = function(rd, rn, shiftOp, condOp) {
		var gprs = cpu.gprs;
		return function() {
			cpu.mmu.waitSeq32(gprs[cpu.PC]);
			if (condOp && !condOp()) {
				return;
			}
			shiftOp();
			gprs[rd] = gprs[rn] - cpu.shifterOperand;
		};
	};

	this.constructSUBS = function(rd, rn, shiftOp, condOp) {
		var gprs = cpu.gprs;
		return function() {
			cpu.mmu.waitSeq32(gprs[cpu.PC]);
			if (condOp && !condOp()) {
				return;
			}
			shiftOp();
			var d = gprs[rn] - cpu.shifterOperand;
			if (rd == cpu.PC && cpu.hasSPSR()) {
				cpu.unpackCPSR(cpu.spsr);
			} else {
				cpu.cpsrN = d & 0x80000000;
				cpu.cpsrZ = !(d & 0xFFFFFFFF);
				cpu.cpsrC = (gprs[rn] >>> 0) >= (cpu.shifterOperand >>> 0);
				cpu.cpsrV = (gprs[rn] & 0x80000000) != (cpu.shifterOperand & 0x80000000) &&
							(gprs[rn] & 0x80000000) != (d & 0x80000000);
			}
			gprs[rd] = d;
		};
	};

	this.constructSWI = function(immediate) {
		var gprs = cpu.gprs;
		return function() {
			if (condOp && !condOp()) {
				cpu.mmu.waitSeq32(gprs[cpu.PC]);
				return;
			}
			cpu.irq.swi32(immediate);
			cpu.mmu.waitSeq32(gprs[cpu.PC]);
			// Wait on BIOS
			cpu.mmu.wait32(0);
			cpu.mmu.waitSeq32(0);
		};
	};

	this.constructTEQ = function(rn, shiftOp, condOp) {
		var gprs = cpu.gprs;
		return function() {
			cpu.mmu.waitSeq32(gprs[cpu.PC]);
			if (condOp && !condOp()) {
				return;
			}
			shiftOp();
			var aluOut = gprs[rn] ^ cpu.shifterOperand;
			cpu.cpsrN = aluOut & 0x80000000;
			cpu.cpsrZ = !(aluOut & 0xFFFFFFFF);
			cpu.cpsrC = cpu.shifterCarryOut;
		};
	};

	this.constructTST = function(rn, shiftOp, condOp) {
		var gprs = cpu.gprs;
		return function() {
			cpu.mmu.waitSeq32(gprs[cpu.PC]);
			if (condOp && !condOp()) {
				return;
			}
			shiftOp();
			var aluOut = gprs[rn] & cpu.shifterOperand;
			cpu.cpsrN = aluOut & 0x80000000;
			cpu.cpsrZ = !(aluOut & 0xFFFFFFFF);
			cpu.cpsrC = cpu.shifterCarryOut;
		};
	};

	this.constructUMLAL = function(rd, rn, rs, rm, condOp) {
		var SHIFT_32 = 1/0x100000000;
		var gprs = cpu.gprs;
		return function() {
			cpu.mmu.waitSeq32(gprs[cpu.PC]);
			if (condOp && !condOp()) {
				return;
			}
			cpu.cycles += 6; // TODO: better timing
			var hi = ((gprs[rm] & 0xFFFF0000) >>> 0) * (gprs[rs] >>> 0);
			var lo = ((gprs[rm] & 0x0000FFFF) >>> 0) * (gprs[rs] >>> 0);
			var mid = (hi & 0xFFFFFFFF) + (lo & 0xFFFFFFFF);
			gprs[rn] += mid & 0xFFFFFFFF;
			gprs[rd] += (hi * SHIFT_32 + lo * SHIFT_32 + mid * SHIFT_32) >>> 0;
			cpu.cpsrN = gprs[rd] & 0x80000000;
			cpu.cpsrZ = !((gprs[rd] & 0xFFFFFFFF) || (gprs[rn] & 0xFFFFFFFF));
		};
	};

	this.constructUMLALS = function(rd, rn, rs, rm, s, condOp) {
		var SHIFT_32 = 1/0x100000000;
		var gprs = cpu.gprs;
		return function() {
			cpu.mmu.waitSeq32(gprs[cpu.PC]);
			if (condOp && !condOp()) {
				return;
			}
			cpu.cycles += 6; // TODO: better timing
			var hi = ((gprs[rm] & 0xFFFF0000) >>> 0) * (gprs[rs] >>> 0);
			var lo = ((gprs[rm] & 0x0000FFFF) >>> 0) * (gprs[rs] >>> 0);
			var mid = (hi & 0xFFFFFFFF) + (lo & 0xFFFFFFFF);
			gprs[rn] += mid & 0xFFFFFFFF;
			gprs[rd] += (hi * SHIFT_32 + lo * SHIFT_32 + mid * SHIFT_32) >>> 0;
			cpu.cpsrN = gprs[rd] & 0x80000000;
			cpu.cpsrZ = !((gprs[rd] & 0xFFFFFFFF) || (gprs[rn] & 0xFFFFFFFF));
		};
	};

	this.constructUMULL = function(rd, rn, rs, rm, s, condOp) {
		var SHIFT_32 = 1/0x100000000;
		var gprs = cpu.gprs;
		return function() {
			cpu.mmu.waitSeq32(gprs[cpu.PC]);
			if (condOp && !condOp()) {
				return;
			}
			cpu.cycles += 5; // TODO: better timing
			var hi = ((gprs[rm] & 0xFFFF0000) >>> 0) * (gprs[rs] >>> 0);
			var lo = ((gprs[rm] & 0x0000FFFF) >>> 0) * (gprs[rs] >>> 0);
			gprs[rn] = ((hi & 0xFFFFFFFF) + (lo & 0xFFFFFFFF)) & 0xFFFFFFFF;
			gprs[rd] = (hi * SHIFT_32 + lo * SHIFT_32) >>> 0;
			if (s) {
				cpu.cpsrN = gprs[rd] & 0x80000000;
				cpu.cpsrZ = !((gprs[rd] & 0xFFFFFFFF) || (gprs[rn] & 0xFFFFFFFF));
			}
		};
	};
};
