ARMCoreArm = function (cpu) {
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
