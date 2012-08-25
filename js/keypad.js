function GameBoyAdvanceKeypad() {
	this.KEYCODE_LEFT = 37;
	this.KEYCODE_UP = 38;
	this.KEYCODE_RIGHT = 39;
	this.KEYCODE_DOWN = 40;
	this.KEYCODE_START = 13;
	this.KEYCODE_SELECT = 220;
	this.KEYCODE_A = 90;
	this.KEYCODE_B = 88;
	this.KEYCODE_L = 65;
	this.KEYCODE_R = 83;

	this.A = 0;
	this.B = 1;
	this.SELECT = 2;
	this.START = 3;
	this.RIGHT = 4;
	this.LEFT = 5;
	this.UP = 6;
	this.DOWN = 7;
	this.R = 8;
	this.L = 9;

	this.currentDown = 0x03FF;
	this.eatInput = false;

	var self = this;
	this.keyboardHandler = function(e) {
		var toggle = 0;
		switch (e.keyCode) {
		case this.KEYCODE_START:
			toggle = this.START;
			break;
		case this.KEYCODE_SELECT:
			toggle = this.SELECT;
			break;
		case this.KEYCODE_A:
			toggle = this.A;
			break;
		case this.KEYCODE_B:
			toggle = this.B;
			break;
		case this.KEYCODE_L:
			toggle = this.L;
			break;
		case this.KEYCODE_R:
			toggle = this.R;
			break;
		case this.KEYCODE_UP:
			toggle = this.UP;
			break;
		case this.KEYCODE_RIGHT:
			toggle = this.RIGHT;
			break;
		case this.KEYCODE_DOWN:
			toggle = this.DOWN;
			break;
		case this.KEYCODE_LEFT:
			toggle = this.LEFT;
			break;
		default:
			return;
		}

		toggle = 1 << toggle;
		if (e.type == "keydown") {
			this.currentDown &= ~toggle;
		} else {
			this.currentDown |= toggle;
		}

		if (this.eatInput) {
			e.preventDefault();
		}
	};
};

GameBoyAdvanceKeypad.prototype.registerKeyboardHandlers = function() {
	window.addEventListener("keydown", this.keyboardHandler.bind(this), true);
	window.addEventListener("keyup", this.keyboardHandler.bind(this), true);
};
