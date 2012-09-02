function GameBoyAdvanceAudio() {
	if (webkitAudioContext) {
		var self = this;
		this.context = new webkitAudioContext();
		this.bufferSize = 0;
		if (this.context.sampleRate >= 44100) {
			this.bufferSize = 1024;
		} else {
			this.bufferSize = 512;
		}
		this.buffers = [new Float32Array(this.bufferSize << 2), new Float32Array(this.bufferSize << 2)];
		this.sampleMask = (this.bufferSize << 2) - 1;
		this.jsAudio = this.context.createJavaScriptNode(this.bufferSize);
		this.jsAudio.onaudioprocess = function(e) { GameBoyAdvanceAudio.audioProcess(self, e) };
		this.jsAudio.connect(this.context.destination);
	} else {
		this.context = null;
	}
};

GameBoyAdvanceAudio.prototype.clear = function() {
	this.fifoA = [ 0, 0, 0, 0, 0, 0, 0, 0 ];
	this.fifoB = [ 0, 0, 0, 0, 0, 0, 0, 0 ];

	this.enabled = false;

	this.enableChannel1 = false;
	this.enableChannel2 = false;
	this.enableChannel3 = false;
	this.enableChannel4 = false;
	this.enableChannelA = false;
	this.enableChannelB = false;
	this.enableRightChannelA = false;
	this.enableLeftChannelA = false;
	this.enableRightChannelB = false;
	this.enableLeftChannelB = false;

	this.masterVolumeLeft = 0;
	this.masterVolumeRight = 0;

	this.dmaA = -1;
	this.dmaB = -1;
	this.soundTimerA = 0;
	this.soundTimerB = 0;

	this.soundRatio = 1;

	this.channel1Sample = 0;

	this.channel2Sample = 0;
	this.channel2Duty = 0.5;
	this.channel2Increment = 0;
	this.channel2Step = 0;
	this.channel2InitialVolume = 0;
	this.channel2Volume = 0;
	this.channel2Interval = 0;

	this.channel2Raise = 0;
	this.channel2Lower = 0;
	this.channel2NextStep = 0;

	this.nextEvent = 0;

	this.nextSample = 0;
	this.outputPointer = 0;
	this.samplePointer = 0;

	this.cpuFrequency = this.core.irq.FREQUENCY;
	this.sampleInterval = this.cpuFrequency / this.context.sampleRate;

	this.writeChannel2FC(0);
};

GameBoyAdvanceAudio.prototype.updateTimers = function() {
	var cycles = this.cpu.cycles;
	if (!this.enabled || cycles < this.nextEvent) {
		return;
	}

	this.nextEvent += this.sampleInterval;

	if (this.enableChannel2) {
		this.updateChannel2(cycles);
	}

	if (cycles >= this.nextSample) {
		this.sample();
		this.nextSample += this.sampleInterval;
	}

	this.nextEvent = Math.ceil(this.nextEvent);
};

GameBoyAdvanceAudio.prototype.writeEnable = function(value) {
	this.enabled = value;
	this.nextEvent = this.cpu.cycles;
	this.nextSample = this.nextEvent;
	this.updateTimers();
	this.core.irq.pollNextEvent();
};

GameBoyAdvanceAudio.prototype.writeSoundControlLo = function(value) {
	this.masterVolumeLeft = value & 0x7;
	this.masterVolumeRight = (value >> 4) & 0x7;
	var enabledLeft = (value >> 8) & 0xF;
	var enabledRight = (value >> 12) & 0xF;

	this.enableChannel1 = (enabledLeft | enabledRight) & 0x1;
	this.setChannel2Enabled((enabledLeft | enabledRight) & 0x2);
	this.enableChannel3 = (enabledLeft | enabledRight) & 0x4;
	this.enableChannel4 = (enabledLeft | enabledRight) & 0x8;

	this.updateTimers();
	this.core.irq.pollNextEvent();
};

GameBoyAdvanceAudio.prototype.writeSoundControlHi = function(value) {
	this.soundRatio = ((value & 0x0003) + 1) * 0.25;
	this.ratioChannelA = (((value & 0x0004) >> 2) + 1) * 0.5;
	this.ratioChannelB = (((value & 0x0008) >> 3) + 1) * 0.5;

	this.enableRightChannelA = value & 0x0100;
	this.enableLeftChannelA = value & 0x0200;
	this.enableChannelA  = value & 0x0300;
	this.soundTimerA = value & 0x0400;
	if (value & 0x0800) {
		this.fifoA = [ 0, 0, 0, 0, 0, 0, 0, 0 ];
	}
	this.enableRightChannelB = value & 0x1000;
	this.enableLeftChannelB = value & 0x2000;
	this.enableChannelB  = value & 0x3000;
	this.soundTimerB = value & 0x4000;
	if (value & 0x8000) {
		this.fifoB = [ 0, 0, 0, 0, 0, 0, 0, 0 ];
	}
};

GameBoyAdvanceAudio.prototype.resetChannel2 = function() {
	if (this.channel2Step) {
		this.channel2NextStep = this.cpu.cycles + this.channel2Step;
		this.updateTimers();
		this.core.irq.pollNextEvent();
	}
};

GameBoyAdvanceAudio.prototype.setChannel2Enabled = function(enable) {
	if (!this.enableChannel2 && enable) {
		this.channel2Raise = this.cpu.cycles;
		this.channel2Lower = this.channel2Raise + this.channel2Duty * this.channel2Interval;
		this.nextEvent = this.cpu.cycles;
		this.updateTimers();
		this.core.irq.pollNextEvent();
	}

	this.enableChannel2 = enable;
};

GameBoyAdvanceAudio.prototype.writeChannel2DLE = function(value) {
	var duty = (value >> 6) & 0x3;
	switch (duty) {
	case 0:
		this.channel2Duty = 0.125;
		break;
	case 1:
		this.channel2Duty = 0.25;
		break;
	case 2:
		this.channel2Duty = 0.5;
		break;
	case 3:
		this.channel2Duty = 0.75;
		break;
	}
	if (value & 0x0800) {
		this.channel2Increment = 1 / 15;
	} else {
		this.channel2Increment = -1 / 15;
	}
	this.channel2InitialVolume = ((value >> 12) & 0xF) / 15;

	this.channel2Step = this.cpuFrequency * (((value >> 8) & 0x7) / 64);
	this.resetChannel2();
};

GameBoyAdvanceAudio.prototype.writeChannel2FC = function(value) {
	var frequency = 131072 / (2048 - (value & 2047));
	this.channel2Interval = this.cpuFrequency / frequency;

	if (value & 0x8000) {
		this.resetChannel2();
		this.channel2Volume = this.channel2InitialVolume;
	}
};

GameBoyAdvanceAudio.prototype.updateChannel2 = function(cycles) {
	if (cycles >= this.channel2Raise) {
		this.channel2Sample = this.channel2Volume;
		this.channel2Lower = this.channel2Raise + this.channel2Duty * this.channel2Interval;
		this.channel2Raise += this.channel2Interval;
	}
	if (cycles >= this.channel2Lower) {
		this.channel2Sample = -this.channel2Volume;
		this.channel2Lower += this.channel2Interval;
	}

	if (this.channel2Step) {
		if (cycles >= this.channel2NextStep) {
			this.channel2Volume += this.channel2Increment;
			if (this.channel2Volume > 1) {
				this.channel2Volume = 1;
			} else if (this.channel2Volume < 0) {
				this.channel2Volume = 0;
			}
			this.channel2NextStep += this.channel2Step;
		}

		if (this.nextEvent > this.channel2NextStep) {
			this.nextEvent = this.channel2NextStep;
		}
	}

	if (this.nextEvent > this.channel2Raise) {
		this.nextEvent = this.channel2Raise;
	}
	if (this.nextEvent > this.channel2Lower) {
		this.nextEvent = this.channel2Lower;
	}
};

GameBoyAdvanceAudio.prototype.appendToFifoA = function(value) {
	this.fifoA.push(value);
	this.fifoA.shift();
};

GameBoyAdvanceAudio.prototype.appendToFifoB = function(value) {
	this.fifoB.push(value);
	this.fifoB.shift();
};

GameBoyAdvanceAudio.prototype.scheduleFIFODma = function(number, info) {
	switch (info.dest) {
	case this.cpu.mmu.BASE_IO | this.cpu.irq.io.FIFO_A_LO:
		// FIXME: is this needed or a hack?
		info.dstControl = 2;
		this.dmaA = number;
		break;
	case this.cpu.mmu.BASE_IO | this.cpu.irq.io.FIFO_B_LO:
		info.dstControl = 2;
		this.dmaB = number;
		break;
	default:
		this.core.WARN('Tried to schedule FIFO DMA for non-FIFO destination');
		break;
	}
};

GameBoyAdvanceAudio.prototype.sample = function() {
	var sample = 0;
	if (this.enableChannel1) {
		sample += this.channel1Sample * this.soundRatio;
	}

	if (this.enableChannel2) {
		sample += this.channel2Sample * this.soundRatio;
	}
	var samplePointer = this.samplePointer;
	this.buffers[0][samplePointer] = sample;
	this.buffers[1][samplePointer] = sample;
	this.samplePointer = (samplePointer + 1) & this.sampleMask;
};

GameBoyAdvanceAudio.audioProcess = function(self, audioProcessingEvent) {
	var left = audioProcessingEvent.outputBuffer.getChannelData(0);
	var right = audioProcessingEvent.outputBuffer.getChannelData(1);
	var i;
	console.log(self.outputPointer, self.samplePointer, self.outputPointer - self.samplePointer);
	for (i = 0; i < self.bufferSize; ++i) {
		if (self.outputPointer == self.samplePointer) {
			break;
		}
		left[i] = self.buffers[0][self.outputPointer];
		right[i] = self.buffers[1][self.outputPointer];
		self.outputPointer = (self.outputPointer + 1) & self.sampleMask;
	}
	console.log(i);
	for (; i < self.bufferSize; ++i) {
		left[i] = 0;
		right[i] = 0;
	}
};
