GameBoyAdvanceInterruptHandler = function() {
	this.FREQUENCY = 16780000;

	this.cpu = null;
	this.enable = false;

	this.enableVblank = false;
	this.enableHblank = false;
	this.enableVcounter = false;
	this.enableTimer0 = false;
	this.enableTimer1 = false;
	this.enableTimer2 = false;
	this.enableTimer3 = false;
	this.enableSio = false;
	this.enableDma0 = false;
	this.enableDma1 = false;
	this.enableDma2 = false;
	this.enableDma3 = false;
	this.enableKeypad = false;
	this.enableGamepak = false;

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

	this.timersEnabled = 0;
	this.timers = new Array();
	for (var i = 0; i < 4; ++i) {
		this.timers.push({
			reload: 0,
			prescale: 0,
			countUp: 0,
			doIrq: 0,
			enable: 0,
			lastEvent: 0
		});
	}

	this.nextInterrupt = 0;
};

GameBoyAdvanceInterruptHandler.prototype.setCPU = function(cpu) {
	this.cpu = cpu;
}

GameBoyAdvanceInterruptHandler.prototype.setVideo = function(video) {
	this.video = video;
}

GameBoyAdvanceInterruptHandler.prototype.updateTimers = function() {
	this.video.updateTimers(this.cpu);
	if (this.timersEnabled) {
		// TODO: add timer IRQs
		// TODO: check for overflow
		if (this.timersEnabled & 0x1) {
			var timer = this.timers[0];
			if (this.cpu.cycles - timer.lastEvent >= timer.prescale) {
				timer.lastEvent += timer.prescale;
				++this.cpu.mmu.io.registers[this.cpu.io.TM0CNT_LO];
			}
		}
		if (this.timersEnabled & 0x2) {
			var timer = this.timers[1];
			if (this.cpu.cycles - timer.lastEvent >= timer.prescale) {
				timer.lastEvent += timer.prescale;
				++this.cpu.mmu.io.registers[this.cpu.io.TM1CNT_LO];
			}
		}
		if (this.timersEnabled & 0x4) {
			var timer = this.timers[2];
			if (this.cpu.cycles - timer.lastEvent >= timer.prescale) {
				timer.lastEvent += timer.prescale;
				++this.cpu.mmu.io.registers[this.cpu.io.TM2CNT_LO];
			}
		}
		if (this.timersEnabled & 0x8) {
			var timer = this.timers[3];
			if (this.cpu.cycles - timer.lastEvent >= timer.prescale) {
				timer.lastEvent += timer.prescale;
				++this.cpu.mmu.io.registers[this.cpu.io.TM3CNT_LO];
			}
		}
	}
}

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
	case 0x0C:
		// FastCpuSet
		var source = this.cpu.gprs[0];
		var dest = this.cpu.gprs[1];
		var mode = this.cpu.gprs[2];
		var count = mode & 0x000FFFFF;
		var fill = mode & 0x01000000;
		if (fill) {
			var word = this.cpu.mmu.load32(source);
			for (var i = 0; i < count; ++i) {
				this.cpu.mmu.store32(dest + (i << 2), word);
			}
		} else {
			for (var i = 0; i < count; ++i) {
				var word = this.cpu.mmu.load32(source + (i << 2));
				this.cpu.mmu.store32(dest + (i << 2), word);
			}
		}
		return;
	default:
		throw "Unimplemented software interrupt: 0x" + opcode.toString(16);
	}
};

GameBoyAdvanceInterruptHandler.prototype.masterEnable = function(value) {
	this.enable = value;

	if (this.enable) {
		this.poll();
	}
};

GameBoyAdvanceInterruptHandler.prototype.setInterruptsEnabled = function(value) {
	this.enableVblank = value & 0x0001;
	this.enableHblank = value & 0x0002;
	this.enableVcounter = value & 0x0004;
	this.enableTimer0 = value & 0x0008;
	this.enableTimer1 = value & 0x0010;
	this.enableTimer2 = value & 0x0020;
	this.enableTimer3 = value & 0x0040;
	this.enableSio = value & 0x0080;
	this.enableDma0 = value & 0x0100;
	this.enableDma1 = value & 0x0200;
	this.enableDma2 = value & 0x0400;
	this.enableDma3 = value & 0x0800;
	this.enableKeypad = value & 0x1000;
	this.enableGamepak = value & 0x2000;

	if (this.enable) {
		this.poll();
	}
};

GameBoyAdvanceInterruptHandler.prototype.poll = function() {
	if (this.enableHblank && this.video.hblankIRQ) {
		var next = this.video.nextHblank();
		if (next && (next < this.nextInterrupt || !this.nextInterrupt)) {
			this.nextInterrupt = next;
		}
	}
	if (this.enableVblank && this.video.vblankIRQ) {
		var next = this.video.nextVblank();
		if (next && (next < this.nextInterrupt || !this.nextInterrupt)) {
			this.nextInterrupt = next;
		}
	}
	if (this.enableVcounter && this.video.vcounterIRQ) {
		var next = this.video.nextVcounter();
		if (next && (next < this.nextInterrupt || !this.nextInterrupt)) {
			this.nextInterrupt = next;
		}
	}

	if (this.enableTimer0 || this.enableTimer1 || this.enableTimer2 || this.enableTimer3) {
		this.cpu.log('Timing interrupts not implemented');
	}

	if (this.enableSio) {
		this.cpu.log('Serial I/O interrupts not implemented');
	}

	if (this.enableDma0 || this.enableDma1 || this.enableDma2 || this.enableDma3) {
		this.cpu.log('DMA interrupts not implemented');
	}

	if (this.enableKeypad) {
		this.cpu.log('Keypad interrupts not implemented');
	}

	if (this.enableGamepak) {
		this.cpu.log('Gamepak interrupts not implemented');
	}
};

GameBoyAdvanceInterruptHandler.prototype.dmaSetSourceAddress = function(dma, address) {
	this.dma[dma].source = address & 0xFFFFFFFE;
};

GameBoyAdvanceInterruptHandler.prototype.dmaSetDestAddress = function(dma, address) {
	this.dma[dma].dest = address & 0xFFFFFFFE;
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

	if (currentDma.repeat) {
		this.cpu.log('DMA repeat not implemented');
	}
	if (currentDma.drq) {
		this.cpu.log('DRQ not implemented');
	}
	if (currentDma.timing) {
		this.cpu.log('DMA start timing other than immediate not implemented');
	}
	if (currentDma.doIrq) {
		this.cpu.log('DMA IRQ not implemented');
	}

	if (!currentDma.timing && currentDma.enable) {
		this.cpu.mmu.serviceDma(dma, currentDma);
	}
};

GameBoyAdvanceInterruptHandler.prototype.timerSetReload = function(timer, reload) {
	this.timers[timer].reload = reload;
};

GameBoyAdvanceInterruptHandler.prototype.timerWriteControl = function(timer, control) {
	var currentTimer = this.timers[timer];
	switch (control & 0x0003) {
	case 0x0000:
		currentTimer.prescale = this.FREQUENCY;
		break;
	case 0x0001:
		currentTimer.prescale = this.FREQUENCY / 64;
		break;
	case 0x0002:
		currentTimer.prescale = this.FREQUENCY / 256;
		break;
	case 0x0003:
		currentTimer.prescale = this.FREQUENCY / 1024;
		break;
	}
	currentTimer.countUp = control & 0x0004;
	currentTimer.doIrq = control & 0x0040;
	currentTimer.enable = ((control & 0x0080) >> 7) << timer;
	var wasEnabled = currentTimer.enable;
	this.timersEnabled = (this.timersEnabled & ~(1 << timer)) | currentTimer.enable;
	if (!wasEnabled && currentTimer.enable) {
		currentTimer.lastEvent = this.cpu.cycles;
		this.cpu.mmu.io.registers[this.cpu.mmu.io.TM0CNT_LO + (timer << 2)] = currentTimer.reload;
	}

	if (currentTimer.countUp) {
		this.cpu.log('Timer count up not implemented');
	}
	if (currentTimer.doIrq) {
		this.cpu.log('Timer IRQ not implemented');
	}
};
