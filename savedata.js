function SRAMSavedata(size) {
	MemoryView.call(this, new ArrayBuffer(size), 0);

	this.writePending = false;
};

SRAMSavedata.prototype = Object.create(MemoryView.prototype);

SRAMSavedata.prototype.store8 = function(offset, value) {
	this.view.setInt8(offset, value);
	this.writePending = true;
};

SRAMSavedata.prototype.store16 = function(offset, value) {
	this.view.setInt16(offset, value, true);
	this.writePending = true;
};

SRAMSavedata.prototype.store32 = function(offset, value) {
	this.view.setInt32(offset, value, true);
	this.writePending = true;
};

function FlashSavedata(size) {
	MemoryView.call(this, new ArrayBuffer(size), 0);

	this.COMMAND_WIPE = 0x10;
	this.COMMAND_ERASE_SECTOR = 0x30;
	this.COMMAND_ERASE = 0x80;
	this.COMMAND_ID = 0x90;
	this.COMMAND_WRITE = 0xA0;
	this.COMMAND_SWITCH_BANK = 0xB0;
	this.COMMAND_TERMINATE_ID = 0xF0;

	this.ID_PANASONIC = 0x1B32;
	this.ID_SANYO = 0x1362;

	this.bank0 = new DataView(this.buffer, 0, 0x00010000);
	if (size > 0x00010000) {
		this.id = this.ID_SANYO;
		this.bank1 = new DataView(this.buffer, 0x00010000);
	} else {
		this,id = this.ID_PANASONIC;
		this.bank1 = null;
	}
	this.bank = this.bank0;

	this.idMode = false;
	this.writePending = false;

	this.first = 0;
	this.second = 0;
	this.command = 0;
	this.pendingCommand = 0;
};

FlashSavedata.prototype.load8 = function(offset) {
	if (this.idMode && offset < 2) {
		return (this.id >> ((1 - offset) << 3)) & 0xFF;
	} else {
		return this.bank.getInt8(offset);
	}
};

FlashSavedata.prototype.load16 = function(offset) {
	return (this.load8(offset) & 0xFF) | (this.load8(offset + 1) << 8);
};

FlashSavedata.prototype.load32 = function(offset) {
	return (this.load8(offset) & 0xFF) | (this.load8(offset + 1) << 8) | (this.load8(offset + 2) << 16) | (this.load8(offset + 3) << 24);
};

FlashSavedata.prototype.loadU8 = function(offset) {
	return this.load8(offset) & 0xFF;
};

FlashSavedata.prototype.loadU16 = function(offset) {
	return (this.loadU8(offset) & 0xFF) | (this.loadU8(offset + 1) << 8);
};

FlashSavedata.prototype.store8 = function(offset, value) {
	switch (this.command) {
	case 0:
		if (offset == 0x5555) {
			if (this.second == 0x55) {
				if (value == this.COMMAND_ERASE) {
					this.pendingCommand = value;
				} else {
					this.command = value;
				}
				this.second = 0;
				this.first = 0;
			} else {
				this.command = 0;
				this.first = value;
				this.idMode = false;
			}
		} else if (offset == 0x2AAA && this.first == 0xAA) {
			this.first = 0;
			if (this.pendingCommand) {
				this.command = this.pendingCommand;
			} else {
				this.second = value;
			}
		}
		break;
	case this.COMMAND_WIPE:
		if (offset == 0x5555) {
			// TODO: wipe chip
			this.erasePending = false;
		}
		this.command = 0;
		break;
	case this.COMMAND_ERASE_SECTOR:
		if (!(offet & 0x0000FFFF)) {
			// TODO: wipe sector
			this.erasePending = false;
		}
		this.command = 0;
		break;
	case this.COMMAND_ERASE:
		switch (value) {
		case this.COMMAND_WIPE:
			if (offset == 0x5555) {
				for (var i = 0; i < this.view.byteLength; i += 4) {
					this.view.setInt32(i, -1);
				}
			}
			break;
		case this.COMMAND_ERASE_SECTOR:
			if ((offset & 0x0FFF) == 0) {
				for (var i = offset; i < offset + 0x1000; i += 4) {
					this.bank.setInt32(i, -1);
				}
				break;
			}
		}
		this.pendingCommand = 0;
		this.command = 0;
		break;
	case this.COMMAND_ID:
		if (offset == 0x5555) {
			this.idMode = true;
		}
		this.command = 0;
		break;
	case this.COMMAND_WRITE:
		this.bank.setInt8(offset, value);
		this.command = 0;

		this.writePending = true;
		break;
	case this.COMMAND_SWITCH_BANK:
		if (this.bank1 && offset == 0) {
			if (value == 1) {
				this.bank = this.bank1;
			} else {
				this.bank = this.bank0;
			}
		}
		this.command = 0;
		break;
	case this.COMMAND_TERMINATE_ID:
		if (offset == 0x5555) {
			this.idMode = false;
		}
		this.command = 0;
		break;
	}
};

FlashSavedata.prototype.store16 = function(offset, value) {
	throw new Error("Unaligned save to flash!");
};

FlashSavedata.prototype.store32 = function(offset, value) {
	throw new Error("Unaligned save to flash!");
};

FlashSavedata.prototype.replaceData = function(memory) {
	var bank = this.view === this.bank1;
	MemoryView.prototype.replaceData.call(this, memory, 0);

	this.bank0 = new DataView(this.buffer, 0, 0x00010000);
	if (memory.byteLength > 0x00010000) {
		this.bank1 = new DataView(this.buffer, 0x00010000);
	} else {
		this.bank1 = null;
	}
	this.bank = bank ? this.bank1 : this.bank0;
}
