var GameBoyAdvanceAudio = function() {
};

GameBoyAdvanceAudio.prototype.clear = function() {
	this.fifoA = [ 0, 0, 0, 0 ];
	this.fifoB = [ 0, 0, 0, 0 ];

	this.enabled = false;

	this.enableChannel0 = false;
	this.enableChannel1 = false;
	this.enableChannel2 = false;
	this.enableChannel3 = false;
	this.enableChannelA = false;
	this.enableChannelB = false;

	this.dmaA = -1;
	this.dmaB = -1;
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
		this.dmaA = number;
		break;
	case this.cpu.mmu.BASE_IO | this.cpu.irq.io.FIFO_B_LO:
		this.dmaB = number;
		break;
	default:
		this.cpu.log('Tried to schedule FIFO DMA for non-FIFO destination');
		break;
	}
};
