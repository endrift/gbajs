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
};

GameBoyAdvanceAudio.prototype.appendToFifoA = function(value) {
	this.fifoA.push(value);
	this.fifoA.shift();
};

GameBoyAdvanceAudio.prototype.appendToFifoB = function(value) {
	this.fifoB.push(value);
	this.fifoB.shift();
};
