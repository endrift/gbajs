GameBoyAdvanceInterruptHandler = function() {
	this.cpu = null;
	this.irqProviders = new Array();
	this.enable = true;

	this.dma = new Array();
	for (var i = 0; i < 4; ++i) {
		this.dma.push({
			source: 0,
			dest: 0,
			count: 0,
			srcControl: 0,
			dstControl: 0,
			repeat: 0,
			width: 0,
			drq: 0,
			timing: 0,
			doIrq: 0,
			enable: 0
		});
	}
};

GameBoyAdvanceInterruptHandler.prototype.setCPU = function(cpu) {
	this.cpu = cpu;
}

GameBoyAdvanceInterruptHandler.prototype.addIrqProvider = function(irq) {
	this.irqProviders.push(irq);
};

GameBoyAdvanceInterruptHandler.prototype.runIrq = function() {
	// The GBA does not support FIQs, so let's just jump to IRQs
	for (var i = 0; i < this.irqProviders.length; ++i) {
		if (this.irqProviders[i].handleIrq(this.cpu)) {
			return true;
		}
	}
	return false;
};

GameBoyAdvanceInterruptHandler.prototype.swi = function(opcode) {
	switch (opcode) {
	case 0x0B:
		// CpuSet
		var source = this.cpu.gprs[0];
		var dest = this.cpu.gprs[1];
		var mode = this.cpu.gprs[2];
		var count = mode & 0x000FFFFF;
		var fill = mode & 0x01000000;
		var wordsize = (mode & 0x04000000) ? 4 : 2;
		if (fill) {
			if (wordsize == 4) {
				var word = this.cpu.mmu.load32(source);
				for (var i = 0; i < count; ++i) {
					this.cpu.mmu.store32(dest + (i << 2), word);
				}
			} else {
				var word = this.cpu.mmu.load16(source);
				for (var i = 0; i < count; ++i) {
					this.cpu.mmu.store16(dest + (i << 1), word);
				}
			}
		} else {
			if (wordsize == 4) {
				for (var i = 0; i < count; ++i) {
					var word = this.cpu.mmu.load32(source + (i << 2));
					this.cpu.mmu.store32(dest + (i << 2), word);
				}
			} else {
				var i = 0;
				var word;
				if (source & 0x00000002) {
					word = this.cpu.mmu.load16(source);
					this.cpu.mmu.store16(dest, word);
					++i;
				}
				for (; i + 1 < count; i += 2) {
					word = this.cpu.mmu.load32(source + (i << 1));
					this.cpu.mmu.store32(dest + (i << 1), word);
				}
				if (i < count) {
					word = this.cpu.mmu.load16(source + (i << 1));
					this.cpu.mmu.store16(dest + (i << 1), word);
				}
			}
		}
		return;
	default:
		throw "Unimplemented software interrupt: 0x" + opcode.toString(16);
	}
};

GameBoyAdvanceInterruptHandler.prototype.masterEnable = function(value) {
	this.enable = value;
};

GameBoyAdvanceInterruptHandler.prototype.setInterruptsEnabled = function(value) {
	// TODO
};

GameBoyAdvanceInterruptHandler.prototype.dmaSetSourceAddress = function(dma, address) {
	this.dma[dma].source = address;
};

GameBoyAdvanceInterruptHandler.prototype.dmaSetDestAddress = function(dma, address) {
	this.dma[dma].dest = address;
};

GameBoyAdvanceInterruptHandler.prototype.dmaSetWordCount = function(dma, count) {
	this.dma[dma].count = count ? count : (dma == 3 ? 0x10000 : 0x4000);
};

GameBoyAdvanceInterruptHandler.prototype.dmaWriteControl = function(dma, control) {
	var currentDma = this.dma[dma];
	currentDma.dstControl = (control & 0x0060) >> 5;
	currentDma.srcControl = (control & 0x0180) >> 7;
	currentDma.repeat = control & 0x0200;
	currentDma.width = control & 0x0400;
	currentDma.drq = control & 0x0800;
	currentDma.timing = control & 0x3000;
	currentDma.doIrq = control & 0x4000;
	currentDma.enable = control & 0x8000;

	if (!currentDma.timing && currentDma.enable) {
		this.cpu.mmu.serviceDma(dma, currentDma);
	}
};
