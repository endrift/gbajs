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

	this.squareChannels = new Array();
	for (var i = 0; i < 2; ++i) {
		this.squareChannels[i] = {
			enabled: 0,
			sample: 0,
			duty: 0.5,
			increment: 0,
			step: 0,
			initialVolume: 0,
			volume: 0,
			interval: 0,
			raise: 0,
			lower: 0,
			nextStep: 0,
			end: 0
		}
	}

	this.waveData = new Uint8Array(32);
	this.channel3Dimenstion = 0;
	this.channel3Bank = 0;
	this.channel3Volume = 0;
	this.channel3Interval = 0;
	this.channel3Next = 0;
	this.channel3Pointer =0;
	this.channel3Sample = 0;

	this.nextEvent = 0;

	this.nextSample = 0;
	this.outputPointer = 0;
	this.samplePointer = 0;

	this.cpuFrequency = this.core.irq.FREQUENCY;
	this.sampleInterval = this.cpuFrequency / this.context.sampleRate;

	this.writeSquareChannelFC(0, 0);
	this.writeSquareChannelFC(1, 0);
};

GameBoyAdvanceAudio.prototype.updateTimers = function() {
	var cycles = this.cpu.cycles;
	if (!this.enabled || cycles < this.nextEvent) {
		return;
	}

	this.nextEvent += this.sampleInterval;

	var channel = this.squareChannels[0];
	if (channel.enabled) {
		this.updateSquareChannel(channel, cycles);
	}

	channel = this.squareChannels[1];
	if (channel.enabled) {
		this.updateSquareChannel(channel, cycles);
	}

	if (this.enableChannel3 && cycles >= this.channel3Next) {
		var sample = this.waveData[this.channel3Pointer >> 1];
		this.channel3Sample = (((sample >> ((this.channel3Pointer & 1) << 2)) & 0xF) - 0x8) / 8;
		this.channel3Pointer = (this.channel3Pointer + 1);
		if (this.channel3Dimension && this.channel3Pointer >= 64) {
			this.channel3Pointer -= 64;
		} else if (!this.channel3Bank && this.channel3Pointer >= 32) {
			this.channel3Pointer -= 32;
		} else if (this.channel3Pointer >= 64) {
			this.channel3Pointer -= 32;
		}
		this.channel3Next += this.channel3Interval;
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

	this.setSquareChannelEnabled(this.squareChannels[0], (enabledLeft | enabledRight) & 0x1);
	this.setSquareChannelEnabled(this.squareChannels[1], (enabledLeft | enabledRight) & 0x2);
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

GameBoyAdvanceAudio.prototype.resetSquareChannel = function(channel) {
	if (channel.step) {
		channel.nextStep = this.cpu.cycles + channel.step;
	}
	this.updateTimers();
	this.core.irq.pollNextEvent();
};

GameBoyAdvanceAudio.prototype.setSquareChannelEnabled = function(channel, enable) {
	if (!channel.enabled && enable) {
		channel.raise = this.cpu.cycles;
		channel.lower = channel.raise + channel.duty * channel.interval;
		this.nextEvent = this.cpu.cycles;
		this.updateTimers();
		this.core.irq.pollNextEvent();
	}

	channel.enabled = enable;
};

GameBoyAdvanceAudio.prototype.writeSquareChannelDLE = function(channelId, value) {
	var channel = this.squareChannels[channelId];
	channel.end = this.cpu.cycles + this.cpuFrequency * ((value & 0x3F) / 256);

	var duty = (value >> 6) & 0x3;
	switch (duty) {
	case 0:
		channel.duty = 0.125;
		break;
	case 1:
		channel.duty = 0.25;
		break;
	case 2:
		channel.duty = 0.5;
		break;
	case 3:
		channel.duty = 0.75;
		break;
	}
	if (value & 0x0800) {
		channel.increment = 1 / 15;
	} else {
		channel.increment = -1 / 15;
	}
	channel.initialVolume = ((value >> 12) & 0xF) / 15;

	channel.step = this.cpuFrequency * (((value >> 8) & 0x7) / 64);
	this.resetSquareChannel(channel);
};

GameBoyAdvanceAudio.prototype.writeSquareChannelFC = function(channelId, value) {
	var channel = this.squareChannels[channelId];
	var frequency = 131072 / (2048 - (value & 2047));
	channel.interval = this.cpuFrequency / frequency;

	if (value & 0x8000) {
		this.resetSquareChannel(channel);
		channel.volume = channel.initialVolume;
	}
};

GameBoyAdvanceAudio.prototype.updateSquareChannel = function(channel, cycles) {
	if (cycles >= channel.raise) {
		channel.sample = channel.volume;
		channel.lower = channel.raise + channel.duty * channel.interval;
		channel.raise += channel.interval;
	}
	if (cycles >= channel.lower) {
		channel.sample = -channel.volume;
		channel.lower += channel.interval;
	}

	if (channel.step) {
		if (cycles >= channel.nextStep) {
			channel.volume += channel.increment;
			if (channel.volume > 1) {
				channel.volume = 1;
			} else if (channel.volume < 0) {
				channel.volume = 0;
			}
			channel.nextStep += channel.step;
		}

		if (this.nextEvent > channel.nextStep) {
			this.nextEvent = channel.nextStep;
		}
	}

	if (this.nextEvent > channel.raise) {
		this.nextEvent = channel.raise;
	}
	if (this.nextEvent > channel.lower) {
		this.nextEvent = channel.lower;
	}
};

GameBoyAdvanceAudio.prototype.writeChannel3Lo = function(value) {
	this.channel3Dimension = value & 0x20;
	this.channel3Bank = value & 0x40;
	this.enableChannel3 = value & 0x80;
};

GameBoyAdvanceAudio.prototype.writeChannel3Hi = function(value) {
	var length = value & 0xFF;
	var volume = (value >> 13) & 0x7;
	switch (volume) {
	case 0:
		this.channel3Volume = 0;
		break;
	case 1:
		this.channel3Volume = 1;
		break;
	case 2:
		this.channel3Volume = 0.5;
		break;
	case 3:
		this.channel3Volume = 0.25;
		break;
	default:
		this.channel3Volume = 0.75;
	}
};

GameBoyAdvanceAudio.prototype.writeChannel3X = function(value) {
	this.channel3Interval = this.cpuFrequency * (2048 - (value & 0x7FF)) / 2097152;
	this.channel3Next = this.cpu.cycles;
	this.nextEvent = this.channel3Next;
	this.updateTimers();
	this.core.irq.pollNextEvent();
};

GameBoyAdvanceAudio.prototype.writeWaveData = function(offset, data, width) {
	if (width == 2) {
		this.waveData[offset] = (data >> 8) & 0xFF;
		++offset;
	}
	this.waveData[offset] = data & 0xFF;
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
	var channel;

	channel = this.squareChannels[0];
	if (channel.enabled) {
		sample += channel.sample * this.soundRatio;
	}

	channel = this.squareChannels[1];
	if (channel.enabled) {
		sample += channel.sample * this.soundRatio;
	}

	if (this.enableChannel3) {
		sample += this.channel3Sample * this.soundRatio * this.channel3Volume;
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
