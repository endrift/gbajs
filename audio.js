var GameBoyAdvanceAudio = function() {
};

GameBoyAdvanceAudio.prototype.clear = function() {
	this.fifoA = [ 0, 0, 0, 0 ];
	this.fifoB = [ 0, 0, 0, 0 ];
};
