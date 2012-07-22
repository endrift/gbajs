var GameBoyAdvanceAudio = function() {
};

GameBoyAdvanceAudio.prototype.clear = function() {
	this.fifoA = [ 0, 0, 0, 0, 0, 0, 0, 0 ];
	this.fifoB = [ 0, 0, 0, 0, 0, 0, 0, 0 ];

	this.enabled = false;

	this.enableChannel0 = false;
	this.enableChannel1 = false;
	this.enableChannel2 = false;
	this.enableChannel3 = false;
	this.enableChannelA = false;
	this.enableChannelB = false;
	this.enableRightChannelA = false;
	this.enableLeftChannelA = false;
	this.enableRightChannelB = false;
	this.enableLeftChannelB = false;

	this.dmaA = -1;
	this.dmaB = -1;
	this.soundTimerA = 0;
	this.soundTimerB = 0;

	this.soundRatio = 1;
};

GameBoyAdvanceAudio.prototype.writeEnable = function(value) {
	this.enabled = value;
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
		this.cpu.log('Tried to schedule FIFO DMA for non-FIFO destination');
		break;
	}
};
