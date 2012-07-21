var GameBoyAdvanceAudio = function() {
};

GameBoyAdvanceAudio.prototype.clear = function() {
	this.fifoA = [ 0, 0, 0, 0 ];
	this.fifoB = [ 0, 0, 0, 0 ];
};

GameBoyAdvanceAudio.prototype.appendToFifoA = function(value) {
	this.fifoA.push(value);
	this.fifoA.shift();
};

GameBoyAdvanceAudio.prototype.appendToFifoB = function(value) {
	this.fifoB.push(value);
	this.fifoB.shift();
};
