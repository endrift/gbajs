function GameBoyAdvance() {
	this.LOG_ERROR = 1;
	this.LOG_WARN = 2;
	this.LOG_STUB = 4;
	this.LOG_INFO = 8;
	this.LOG_DEBUG = 16;

	this.SYS_ID = 'com.endrift.gbajs';

	this.logLevel = this.LOG_ERROR | this.LOG_WARN;

	this.rom = null;

	this.cpu = new ARMCore();
	this.mmu = new GameBoyAdvanceMMU()
	this.irq = new GameBoyAdvanceInterruptHandler();
	this.io = new GameBoyAdvanceIO();
	this.audio = new GameBoyAdvanceAudio();
	this.video = new GameBoyAdvanceVideo();
	this.keypad = new GameBoyAdvanceKeypad();
	this.sio = new GameBoyAdvanceSIO();

	// TODO: simplify this graph
	this.cpu.mmu = this.mmu;
	this.cpu.irq = this.irq;

	this.mmu.cpu = this.cpu;
	this.mmu.core = this;

	this.irq.cpu = this.cpu;
	this.irq.io = this.io;
	this.irq.audio = this.audio;
	this.irq.video = this.video;
	this.irq.core = this;

	this.io.cpu = this.cpu;
	this.io.audio = this.audio;
	this.io.video = this.video;
	this.io.keypad = this.keypad;
	this.io.sio = this.sio;
	this.io.core = this;

	this.audio.cpu = this.cpu;
	this.audio.core = this;

	this.video.cpu = this.cpu;
	this.video.core = this;

	this.keypad.core = this;

	this.sio.core = this;

	this.keypad.registerHandlers();
	this.doStep = this.waitFrame;
	this.paused = false;

	this.seenFrame = false;
	this.seenSave = false;
	this.lastVblank = 0;

	this.queue = null;
	this.reportFPS = null;
	this.throttle = 16; // This is rough, but the 2/3ms difference gives us a good overhead

	var self = this;
	window.queueFrame = function (f) {
		self.queue = window.setTimeout(f, self.throttle);
	};

	window.URL = window.URL || window.webkitURL;

	this.video.vblankCallback = function() {
		self.seenFrame = true;
	};
};

GameBoyAdvance.prototype.setCanvas = function(canvas) {
	var self = this;
	if (canvas.offsetWidth != 240 || canvas.offsetHeight != 160) {
		this.indirectCanvas = document.createElement("canvas");
		this.indirectCanvas.setAttribute("height", "160");
		this.indirectCanvas.setAttribute("width", "240");
		this.targetCanvas = canvas;
		this.setCanvasDirect(this.indirectCanvas);
		var targetContext = canvas.getContext('2d');
		this.video.drawCallback = function() {
			targetContext.drawImage(self.indirectCanvas, 0, 0, canvas.offsetWidth, canvas.offsetHeight);
		}
	} else {
		this.setCanvasDirect(canvas);
		var self = this;
	}
};

GameBoyAdvance.prototype.setCanvasDirect = function(canvas) {
	this.context = canvas.getContext('2d');
	this.video.setBacking(this.context);
};

GameBoyAdvance.prototype.setBios = function(bios, real) {
	this.mmu.loadBios(bios, real);
};

GameBoyAdvance.prototype.setRom = function(rom) {
	this.reset();

	this.rom = this.mmu.loadRom(rom, true);
	if (!this.rom) {
		return false;
	}
	this.retrieveSavedata();
	return true;
};

GameBoyAdvance.prototype.hasRom = function() {
	return !!this.rom;
};

GameBoyAdvance.prototype.loadRomFromFile = function(romFile, callback) {
	var reader = new FileReader();
	var self = this;
	reader.onload = function(e) {
		var result = self.setRom(e.target.result);
		if (callback) {
			callback(result);
		}
	}
	reader.readAsArrayBuffer(romFile);
};

GameBoyAdvance.prototype.reset = function() {
	this.audio.pause(true);

	this.mmu.clear();
	this.io.clear();
	this.audio.clear();
	this.video.clear();
	this.sio.clear();

	this.mmu.mmap(this.mmu.REGION_IO, this.io);
	this.mmu.mmap(this.mmu.REGION_PALETTE_RAM, this.video.renderPath.palette);
	this.mmu.mmap(this.mmu.REGION_VRAM, this.video.renderPath.vram);
	this.mmu.mmap(this.mmu.REGION_OAM, this.video.renderPath.oam);

	this.cpu.resetCPU(0);
};

GameBoyAdvance.prototype.step = function() {
	while (this.doStep()) {
		this.cpu.step();
	}
};

GameBoyAdvance.prototype.waitFrame = function() {
	var seen = this.seenFrame;
	this.seenFrame = false;
	return !seen;
};

GameBoyAdvance.prototype.pause = function() {
	this.paused = true;
	this.audio.pause(true);
	if (this.queue) {
		clearTimeout(this.queue);
		this.queue = null;
	}
};

GameBoyAdvance.prototype.advanceFrame = function() {
	this.step();
	if (this.seenSave) {
		if (!this.mmu.saveNeedsFlush()) {
			this.storeSavedata();
			this.seenSave = false;
		} else {
			this.mmu.flushSave();
		}
	} else if (this.mmu.saveNeedsFlush()) {
		this.seenSave = true;
		this.mmu.flushSave();
	}
};

GameBoyAdvance.prototype.runStable = function() {
	if (this.interval) {
		return; // Already running
	}
	var self = this;
	var timer = 0;
	var frames = 0;
	var runFunc;
	var start = Date.now();
	this.paused = false;
	this.audio.pause(false);

	if (this.reportFPS) {
		runFunc = function() {
			try {
				timer += Date.now() - start;
				if (self.paused) {
					return;
				} else {
					queueFrame(runFunc);
				}
				start = Date.now();
				self.advanceFrame();
				++frames;
				if (frames == 60) {
					self.reportFPS((frames * 1000) / timer);
					frames = 0;
					timer = 0;
				}
			} catch(exception) {
				self.ERROR(exception);
				if (exception.stack) {
					self.logStackTrace(exception.stack.split('\n'));
				}
				throw exception;
			}
		};
	} else {
		runFunc = function() {
			try {
				if (self.paused) {
					return;
				} else {
					queueFrame(runFunc);
				}
				self.advanceFrame();
			} catch(exception) {
				self.ERROR(exception);
				if (exception.stack) {
					self.logStackTrace(exception.stack.split('\n'));
				}
				throw exception;
			}
		};
	}
	queueFrame(runFunc);
};

GameBoyAdvance.prototype.setSavedata = function(data) {
	this.mmu.loadSavedata(data);
};

GameBoyAdvance.prototype.loadSavedataFromFile = function(saveFile) {
	var reader = new FileReader();
	var self = this;
	reader.onload = function(e) { self.setSavedata(e.target.result); }
	reader.readAsArrayBuffer(saveFile);
};

GameBoyAdvance.prototype.decodeSavedata = function(string) {
	this.setSavedata(this.decodeBase64(string));
};

GameBoyAdvance.prototype.decodeBase64 = function(string) {
	var length = (string.length * 3 / 4);
	if (string[string.length - 2] == '=') {
		length -= 2;
	} else if (string[string.length - 1] == '=') {
		length -= 1;
	}
	var buffer = new ArrayBuffer(length);
	var view = new Uint8Array(buffer);
	var bits = string.match(/..../g);
	for (var i = 0; i + 2 < length; i += 3) {
		var s = atob(bits.shift());
		view[i] = s.charCodeAt(0);
		view[i + 1] = s.charCodeAt(1);
		view[i + 2] = s.charCodeAt(2);
	}
	if (i < length) {
		var s = atob(bits.shift());
		view[i++] = s.charCodeAt(0);
		if (s.length > 1) {
			view[i++] = s.charCodeAt(1);
		}
	}

	return buffer;
};

GameBoyAdvance.prototype.encodeBase64 = function(view) {
	var data = [];
	var b;
	var wordstring = [];
	var triplet;
	for (var i = 0; i < view.byteLength; ++i) {
		b = view.getUint8(i, true);
		wordstring.push(String.fromCharCode(b));
		while (wordstring.length >= 3) {
			triplet = wordstring.splice(0, 3);
			data.push(btoa(triplet.join('')));
		}
	};
	if (wordstring.length) {
		data.push(btoa(wordstring.join('')));
	}
	return data.join('');
};

GameBoyAdvance.prototype.downloadSavedata = function() {
	var sram = this.mmu.save;
	if (!sram) {
		this.WARN("No save data available");
		return null;
	}
	if (window.URL) {
		var url = window.URL.createObjectURL(new Blob([sram.buffer], { type: 'application/octet-stream' }));
		window.open(url);
	} else {
		var data = this.encodeBase64(sram.view);
		window.open('data:application/octet-stream;base64,' + data, this.rom.code + '.sav');
	}
};


GameBoyAdvance.prototype.storeSavedata = function() {
	var sram = this.mmu.save;
	try {
		var storage = window.localStorage;
		storage[this.SYS_ID + '.' + this.mmu.cart.code] = this.encodeBase64(sram.view);
	} catch (e) {
		this.WARN('Could not store savedata! ' + e);
	}
};

GameBoyAdvance.prototype.retrieveSavedata = function() {
	try {
		var storage = window.localStorage;
		var data = storage[this.SYS_ID + '.' + this.mmu.cart.code];
		if (data) {
			this.decodeSavedata(data);
			return true;
		}
	} catch (e) {
		this.WARN('Could not retrieve savedata! ' + e);
	}
	return false;
};

GameBoyAdvance.prototype.freeze = function() {
	return {
		'cpu': this.cpu.freeze(),
		'mmu': this.mmu.freeze(),
		'irq': this.irq.freeze(),
		'io': this.io.freeze(),
		'audio': this.audio.freeze(),
		'video': this.video.freeze()
	}
};

GameBoyAdvance.prototype.defrost = function(frost) {
	this.cpu.defrost(frost.cpu);
	this.mmu.defrost(frost.mmu);
	this.audio.defrost(frost.audio);
	this.video.defrost(frost.video);
	this.irq.defrost(frost.irq);
	this.io.defrost(frost.io);
};

GameBoyAdvance.prototype.log = function(level, message) {};

GameBoyAdvance.prototype.setLogger = function(logger) {
	this.log = logger;
};

GameBoyAdvance.prototype.logStackTrace = function(stack) {
	var overflow = stack.length - 32;
	this.ERROR('Stack trace follows:');
	if (overflow > 0) {
		this.log(-1, '> (Too many frames)');
	}
	for (var i = Math.max(overflow, 0); i < stack.length; ++i) {
		this.log(-1, '> ' + stack[i]);
	}
};

GameBoyAdvance.prototype.ERROR = function(error) {
	if (this.logLevel & this.LOG_ERROR) {
		this.log(this.LOG_ERROR, error);
	}
};

GameBoyAdvance.prototype.WARN = function(warn) {
	if (this.logLevel & this.LOG_WARN) {
		this.log(this.LOG_WARN, warn);
	}
};

GameBoyAdvance.prototype.STUB = function(func) {
	if (this.logLevel & this.LOG_STUB) {
		this.log(this.LOG_STUB, func);
	}
};

GameBoyAdvance.prototype.INFO = function(info) {
	if (this.logLevel & this.LOG_INFO) {
		this.log(this.LOG_INFO, info);
	}
};

GameBoyAdvance.prototype.DEBUG = function(info) {
	if (this.logLevel & this.LOG_DEBUG) {
		this.log(this.LOG_DEBUG, info);
	}
};

GameBoyAdvance.prototype.ASSERT_UNREACHED = function(err) {
	throw new Error("Should be unreached: " + err);
};

GameBoyAdvance.prototype.ASSERT = function(test, err) {
	if (!test) {
		throw new Error("Assertion failed: " + err);
	}
};
