var GameBoyAdvanceInterruptHandler = function() {
	this.FREQUENCY = 16780000;

	this.cpu = null;
	this.enable = false;

	this.IRQ_VBLANK = 0x0;
	this.IRQ_HBLANK = 0x1;
	this.IRQ_VCOUNTER = 0x2;
	this.IRQ_TIMER0 = 0x3;
	this.IRQ_TIMER1 = 0x4;
	this.IRQ_TIMER2 = 0x5;
	this.IRQ_TIMER3 = 0x6;
	this.IRQ_SIO = 0x7;
	this.IRQ_DMA0 = 0x8;
	this.IRQ_DMA1 = 0x9;
	this.IRQ_DMA2 = 0xA;
	this.IRQ_DMA3 = 0xB;
	this.IRQ_KEYPAD = 0xC;
	this.IRQ_GAMEPAK = 0xD;

	this.MASK_VBLANK = 0x0001;
	this.MASK_HBLANK = 0x0002;
	this.MASK_VCOUNTER = 0x0004;
	this.MASK_TIMER0 = 0x0008;
	this.MASK_TIMER1 = 0x0010;
	this.MASK_TIMER2 = 0x0020;
	this.MASK_TIMER3 = 0x0040;
	this.MASK_SIO = 0x0080;
	this.MASK_DMA0 = 0x0100;
	this.MASK_DMA1 = 0x0200;
	this.MASK_DMA2 = 0x0400;
	this.MASK_DMA3 = 0x0800;
	this.MASK_KEYPAD = 0x1000;
	this.MASK_GAMEPAK = 0x2000;

	this.enabledIRQs = 0;
	this.interruptFlags = 0;

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
			prescaleBits: 0,
			countUp: 0,
			doIrq: 0,
			enable: 0,
			lastEvent: 0,
			overflowDuration: 1
		});
	}

	this.nextInterrupt = 0;
};

GameBoyAdvanceInterruptHandler.prototype.updateTimers = function() {
	this.video.updateTimers(this.cpu);
	if (this.timersEnabled) {
		// TODO: ensure incrementing only on read and overflow
		var timer = this.timers[0];
		if (timer.enable) {
			if (this.cpu.cycles >= timer.nextEvent) {
				timer.lastEvent = timer.nextEvent;
				timer.nextEvent += timer.overflowInterval;
				this.io.registers[this.io.TM0CNT_LO >> 1] = timer.reload;

				if (timer.doIrq) {
					this.raiseIRQ(this.IRQ_TIMER0);
				}

				if (this.audio.enabled) {
					if (this.audio.enableChannelA && !this.audio.soundTimerA) {
						this.cpu.mmu.serviceDma(this.audio.dmaA, this.dma[this.audio.dmaA]);
					}
	
					if (this.audio.enableChannelB && !this.audio.soundTimerB) {
						this.cpu.mmu.serviceDma(this.audio.dmaB, this.dma[this.audio.dmaB]);
					}
				}
			}
		}

		timer = this.timers[1];
		if (timer.enable) {
			if (this.cpu.cycles >= timer.nextEvent) {
				timer.lastEvent = timer.nextEvent;
				timer.nextEvent += timer.overflowInterval;
				this.io.registers[this.io.TM1CNT_LO >> 1] = timer.reload;

				if (timer.doIrq) {
					this.raiseIRQ(this.IRQ_TIMER1);
				}

				if (this.audio.enabled) {
					if (this.audio.enableChannelA && this.audio.soundTimerA) {
						this.cpu.mmu.serviceDma(this.audio.dmaA, this.dma[this.audio.dmaA]);
					}
	
					if (this.audio.enableChannelB && this.audio.soundTimerB) {
						this.cpu.mmu.serviceDma(this.audio.dmaB, this.dma[this.audio.dmaB]);
					}
				}
			}
		}

		timer = this.timers[2];
		if (timer.enable) {
			if (this.cpu.cycles >= timer.nextEvent) {
				timer.lastEvent = timer.nextEvent;
				timer.nextEvent += timer.overflowInterval;
				this.io.registers[this.io.TM2CNT_LO >> 1] = timer.reload;

				if (timer.doIrq) {
					this.raiseIRQ(this.IRQ_TIMER2);
				}
			}
		}

		timer = this.timers[3];
		if (timer.enable) {
			if (this.cpu.cycles >= timer.nextEvent) {
				timer.lastEvent = timer.nextEvent;
				timer.nextEvent += timer.overflowInterval;
				this.io.registers[this.io.TM3CNT_LO >> 1] = timer.reload;

				if (timer.doIrq) {
					this.raiseIRQ(this.IRQ_TIMER3);
				}
			}
		}
	}
}

GameBoyAdvanceInterruptHandler.prototype.swi = function(opcode) {
	switch (opcode) {
	case 0x02:
		// Halt
		if (!this.enable) {
			throw "Requested HALT when interrupts were disabled!";
		}
		if (!this.waitForIRQ()) {
			throw "Waiting on interrupt forever.";
		}
		break;
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

	if (this.enable && this.enabledIRQs && this.interruptFlags) {
		this.cpu.raiseIRQ();
	}
};

GameBoyAdvanceInterruptHandler.prototype.setInterruptsEnabled = function(value) {
	this.enabledIRQs = value;

	if (this.enabledIRQs & this.MASK_SIO) {
		this.cpu.log('Serial I/O interrupts not implemented');
	}

	if (this.enabledIRQs & this.MASK_KEYPAD) {
		this.cpu.log('Keypad interrupts not implemented');
	}

	if (this.enabledIRQs & this.MASK_GAMEPAK) {
		this.cpu.log('Gamepak interrupts not implemented');
	}

	if (this.enable && this.enabledIRQs && this.interruptFlags) {
		this.cpu.raiseIRQ();
	}
};

GameBoyAdvanceInterruptHandler.prototype.waitForIRQ = function() {
	var nextEvent = 0;
	var test;
	var timer;
	var irqPending = this.video.hblankIRQ || this.video.vblankIRQ;
	if (this.timersEnabled) {
		timer = this.timers[0];
		irqPending = irqPending || timer.doIrq;
		timer = this.timers[1];
		irqPending = irqPending || timer.doIrq;
		timer = this.timers[2];
		irqPending = irqPending || timer.doIrq;
		timer = this.timers[3];
		irqPending = irqPending || timer.doIrq;
	}
	if (!irqPending) {
		return false;
	}

	for (;;) {
		test = this.video.nextEvent;
		if (!nextEvent || test < nextEvent) {
			nextEvent = test;
		}

		timer = this.timers[0];
		test = timer.nextEvent;
		if (timer.enable && (!nextEvent || test < nextEvent)) {
			nextEvent = test;
		}

		timer = this.timers[1];
		test = timer.nextEvent;
		if (timer.enable && (!nextEvent || test < nextEvent)) {
			nextEvent = test;
		}
		timer = this.timers[2];
		test = timer.nextEvent;
		if (timer.enable && (!nextEvent || test < nextEvent)) {
			nextEvent = test;
		}
		timer = this.timers[3];
		test = timer.nextEvent;
		if (timer.enable && (!nextEvent || test < nextEvent)) {
			nextEvent = test;
		}

		if (!nextEvent || nextEvent < this.cpu.cycles) {
			return false;
		} else {
			this.cpu.cycles = nextEvent;
			this.updateTimers();
			if (this.interruptFlags) {
				return true;
			}
		}
	}
};

GameBoyAdvanceInterruptHandler.prototype.raiseIRQ = function(irqType) {
	this.interruptFlags |= 1 << irqType;
	this.io.registers[this.io.IF >> 1] = this.interruptFlags;

	if (this.enable && this.enabledIRQs & this.interruptFlags) {
		this.cpu.raiseIRQ();
	}
};

GameBoyAdvanceInterruptHandler.prototype.dismissIRQs = function(irqMask) {
	this.interruptFlags &= ~irqMask;
	this.io.registers[this.io.IF >> 1] = this.interruptFlags;
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
	currentDma.width = (control & 0x0400) ? 4 : 2;
	currentDma.drq = control & 0x0800;
	currentDma.timing = (control & 0x3000) >> 12;
	currentDma.doIrq = control & 0x4000;
	currentDma.enable = control & 0x8000;

	if (currentDma.drq) {
		this.cpu.log('DRQ not implemented');
	}

	if (currentDma.enable) {
		this.cpu.mmu.scheduleDma(dma, currentDma);
	}
};

GameBoyAdvanceInterruptHandler.prototype.timerSetReload = function(timer, reload) {
	this.timers[timer].reload = reload & 0xFFFF;
};

GameBoyAdvanceInterruptHandler.prototype.timerWriteControl = function(timer, control) {
	var currentTimer = this.timers[timer];
	switch (control & 0x0003) {
	case 0x0000:
		currentTimer.prescaleBits = 0;
		break;
	case 0x0001:
		currentTimer.prescaleBits = 6;
		break;
	case 0x0002:
		currentTimer.prescaleBits = 8;
		break;
	case 0x0003:
		currentTimer.prescaleBits = 10;
		break;
	}
	currentTimer.countUp = control & 0x0004;
	currentTimer.doIrq = control & 0x0040;
	currentTimer.overflowInterval = (0x10000 - currentTimer.reload) * (1 << currentTimer.prescaleBits);
	var wasEnabled = currentTimer.enable;
	currentTimer.enable = ((control & 0x0080) >> 7) << timer;
	if (!wasEnabled && currentTimer.enable) {
		currentTimer.lastEvent = this.cpu.cycles;
		currentTimer.nextEvent = this.cpu.cycles + currentTimer.overflowInterval;
		this.io.registers[(this.io.TM0CNT_LO + (timer << 2)) >> 1] = currentTimer.reload;
		++this.timersEnabled;
	} else if (wasEnabled && !currentTimer.enable) {
		--this.timersEnabled;
	}

	if (currentTimer.countUp) {
		this.cpu.log('Timer count up not implemented');
	}
};
