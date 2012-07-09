GameBoyAdvanceInterruptHandler = function() {
	this.cpu = null;
};

GameBoyAdvanceInterruptHandler.prototype.setCPU = function(cpu) {
	this.cpu = cpu;
}

GameBoyAdvanceInterruptHandler.prototype.swi = function(opcode) {
	switch (opcode) {
	default:
		throw "Unimplemented software interrupt: 0x" + opcode.toString(16);
	}
}
