function GameBoyAdvanceSIO() {
	this.SIO_NORMAL_8 = 0;
	this.SIO_NORMAL_32 = 1;
	this.SIO_MULTI = 2;
	this.SIO_UART = 3;
	this.SIO_GPIO = 8;
	this.SIO_JOYBUS = 12;
}

GameBoyAdvanceSIO.prototype.clear = function() {
	this.mode = this.SIO_GPIO;
};

GameBoyAdvanceSIO.prototype.setMode = function(mode) {
	if (mode & 0x8) {
		mode &= 0xC;
	} else {
		mode &= 0x3;
	}
	this.mode = mode;

	this.core.INFO('Setting SIO mode to ' + hex(mode, 1));
};

GameBoyAdvanceSIO.prototype.writeRCNT = function(value) {
	if (mode != this.SIO_GPIO) {
		return;
	}

	this.core.STUB('General purpose serial not supported');
};

GameBoyAdvanceSIO.prototype.writeSIOCNT = function(value) {
	switch (this.mode) {
	case this.SIO_NORMAL_8:
		this.core.STUB('8-bit transfer unsupported');
		break;
	case this.SIO_NORMAL_32:
		this.core.STUB('32-bit transfer unsupported');
		break;
	case this.SIO_MULTI:
		this.core.STUB('Multiplayer unsupported');
		break;
	case this.SIO_UART:
		this.core.STUB('UART unsupported');
		break;
	case this.SIO_GPIO:
		// Nothing to do
		break;
	case this.SIO_JOYBUS:
		this.core.STUB('JOY BUS unsupported');
		break;
	}
};