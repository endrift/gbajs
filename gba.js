var GameBoyAdvance = function() {
	this.cpu = new ARMCore();
	this.mmu = new GameBoyAdvanceMMU()
	this.irq = new GameBoyAdvanceInterruptHandler();
	this.io = new GameBoyAdvanceIO();
	this.audio = new GameBoyAdvanceAudio();
	this.video = new GameBoyAdvanceVideo();

	// TODO: simplify this graph
	this.cpu.mmu = this.mmu;
	this.cpu.irq = this.irq;

	this.mmu.cpu = this.cpu;

	this.irq.cpu = this.cpu;
	this.irq.io = this.io;
	this.irq.audio = this.audio;
	this.irq.video = this.video;

	this.io.cpu = this.cpu;
	this.io.audio = this.audio;
	this.io.video = this.video;

	this.audio.cpu = this.cpu;

	this.video.cpu = this.cpu;

	this.mmu.clear();
	this.io.clear();
	this.audio.clear();
	this.video.clear();

	this.mmu.mmap(this.mmu.REGION_IO, this.io);
	this.mmu.mmap(this.mmu.REGION_PALETTE_RAM, this.video.palette);
};

GameBoyAdvance.prototype.setCanvas = function(video) {
	this.video.setCanvas();
};

GameBoyAdvance.prototype.reset = function() {
	this.core.resetCPU(0x08000000);
};
