function GameBoyAdvanceSIO() {
	this.SIO_NORMAL_8 = 0;
	this.SIO_NORMAL_32 = 1;
	this.SIO_MULTI = 2;
	this.SIO_UART = 3;
	this.SIO_GPIO = 8;
	this.SIO_JOYBUS = 12;

	this.BAUD = [ 9600, 38400, 57600, 115200 ];
}

GameBoyAdvanceSIO.prototype.clear = function() {
	this.mode = this.SIO_GPIO;
	this.sd = false;

	this.irq = false;
	this.multiplayer = {
		baud: 0,
		si: 0,
		id: 0,
		error: 0,
		busy: 0,

		states: [ 0xFFFF, 0xFFFF, 0xFFFF, 0xFFFF ]
	};

	this.linkLayer = null;
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
	if (this.mode != this.SIO_GPIO) {
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
		this.multiplayer.baud = value & 0x0003;
		if (this.linkLayer) {
			this.linkLayer.setBaud(this.BAUD[this.multiplayer.baud]);
		}

		if (!this.multiplayer.si) {
			this.multiplayer.busy = value & 0x0080;
			if (this.linkLayer && this.multiplayer.busy) {
				this.linkLayer.startMultiplayerTransfer();
			}
		}
		this.irq = value & 0x4000;
		break;
	case this.SIO_UART:
		this.core.STUB('UART unsupported');
		break;
	case this.SIO_GPIO:
		// This register isn't used in general-purpose mode
		break;
	case this.SIO_JOYBUS:
		this.core.STUB('JOY BUS unsupported');
		break;
	}
};

GameBoyAdvanceSIO.prototype.readSIOCNT = function() {
	var value = (this.mode << 12) & 0xFFFF;
	switch (this.mode) {
	case this.SIO_NORMAL_8:
		this.core.STUB('8-bit transfer unsupported');
		break;
	case this.SIO_NORMAL_32:
		this.core.STUB('32-bit transfer unsupported');
		break;
	case this.SIO_MULTI:
		value |= this.multiplayer.baud;
		value |= this.multiplayer.si;
		value |= (!!this.sd) << 3;
		value |= this.multiplayer.id << 4;
		value |= this.multiplayer.error;
		value |= this.multiplayer.busy;
		value |= (!!this.multiplayer.irq) << 14;
		break;
	case this.SIO_UART:
		this.core.STUB('UART unsupported');
		break;
	case this.SIO_GPIO:
		// This register isn't used in general-purpose mode
		break;
	case this.SIO_JOYBUS:
		this.core.STUB('JOY BUS unsupported');
		break;
	}
	return value;
};

GameBoyAdvanceSIO.prototype.read = function(slot) {
	switch (this.mode) {
	case this.SIO_NORMAL_32:
		this.core.STUB('32-bit transfer unsupported');
		break;
	case this.SIO_MULTI:
		return this.multiplayer.states[slot];
	case this.SIO_UART:
		this.core.STUB('UART unsupported');
		break;
	default:
		this.core.WARN('Reading from transfer register in unsupported mode');
		break;
	}
	return 0;
};
