function Console(gba) {
	this.cpu = gba.cpu;
	this.gba = gba;
	this.ul = document.getElementById('console');
	this.gprs = document.getElementById('gprs');
	this.memory = new Memory(gba.mmu);
	this.breakpoints = [];
	this.logQueue = [];

	this.activeView = null;
	this.paletteView = new PaletteViewer(gba.video.renderPath.palette);
	this.tileView = new TileViewer(gba.video.renderPath.vram, gba.video.renderPath.palette);
	this.update();

	var self = this;
	gba.setLogger(function (level, message) { self.log(level, message) });
	this.gba.doStep = function () { return self.testBreakpoints() };
}

Console.prototype.updateGPRs = function() {
	for (var i = 0; i < 16; ++i) {
		this.gprs.children[i].textContent = hex(this.cpu.gprs[i]);
	}
}

Console.prototype.updateCPSR = function() {
	var cpu = this.cpu;
	var bit = function(psr, member) {
		var element = document.getElementById(psr);
		if (cpu[member]) {
			element.removeAttribute('class'); 
		} else {
			element.setAttribute('class', 'disabled');
		}
	}
	bit('cpsrN', 'cpsrN');
	bit('cpsrZ', 'cpsrZ');
	bit('cpsrC', 'cpsrC');
	bit('cpsrV', 'cpsrV');
	bit('cpsrI', 'cpsrI');
	bit('cpsrT', 'execMode');
	
	var mode = document.getElementById('mode');
	switch (cpu.mode) {
	case cpu.MODE_USER:
		mode.textContent = 'USER';
		break;
	case cpu.MODE_IRQ:
		mode.textContent = 'IRQ';
		break;
	case cpu.MODE_FIQ:
		mode.textContent = 'FIQ';
		break;
	case cpu.MODE_SUPERVISOR:
		mode.textContent = 'SVC';
		break;
	case cpu.MODE_ABORT:
		mode.textContent = 'ABORT';
		break;
	case cpu.MODE_UNDEFINED:
		mode.textContent = 'UNDEFINED';
		break;
	case cpu.MODE_SYSTEM:
		mode.textContent = 'SYSTEM';
		break;
	default:
		mode.textContent = '???';
		break;
	}
}

Console.prototype.log = function(level, message) {
	switch (level) {
	case this.gba.LOG_ERROR:
		message = '[ERROR] ' + message;
		break;
	case this.gba.LOG_WARN:
		message = '[WARN] ' + message;
		break;
	case this.gba.LOG_STUB:
		message = '[STUB] ' + message;
		break;
	case this.gba.LOG_INFO:
		message = '[INFO] ' + message;
		break;
	case this.gba.LOG_DEBUG:
		message = '[DEBUG] ' + message;
		break;
	}
	this.logQueue.push(message);
	if (level == this.gba.LOG_ERROR) {
		this.pause();
	}
	if (!this.stillRunning) {
		this.flushLog();
	}
}

Console.prototype.flushLog = function() {
	var doScroll = this.ul.scrollTop == this.ul.scrollHeight - this.ul.offsetHeight;
	while (this.logQueue.length) {
		var entry = document.createElement('li');
		entry.textContent = this.logQueue.shift();
		this.ul.appendChild(entry);
	}
	if (doScroll) {
		var ul = this.ul;
		var last = ul.scrollTop;
		var scrollUp = function() {
			if (ul.scrollTop == last) {
				ul.scrollTop = (ul.scrollHeight - ul.offsetHeight) * 0.2 + last * 0.8;
				last = ul.scrollTop;
				if (last != ul.scrollHeight - ul.offsetHeight) {
					setTimeout(scrollUp, 25);
				}
			}
		}
		setTimeout(scrollUp, 25);
	}

}

Console.prototype.update = function() {
	this.updateGPRs();
	this.updateCPSR();
	this.memory.refreshAll();
	if (this.activeView) {
		this.activeView.redraw();
	}
}

Console.prototype.setView = function(view) {
	var container = document.getElementById('debugViewer');
	while (container.hasChildNodes()) {
		container.removeChild(container.lastChild);
	}
	if (view) {
		view.insertChildren(container);
		view.redraw();
	}
	this.activeView = view;
}

Console.prototype.step = function() {
	try {
		this.cpu.step();
		this.update();
	} catch (exception) {
		this.log(this.gba.LOG_DEBUG, exception);
		throw exception;
	}
}

Console.prototype.runVisible = function() {
	if (this.stillRunning) {
		return;
	}

	this.stillRunning = true;
	var self = this;
	run = function() {
		if (self.stillRunning) {
			try {
				self.step();
				if (self.breakpoints.length && self.breakpoints[self.cpu.gprs[self.cpu.PC]]) {
					self.breakpointHit();
					return;
				}
				self.flushLog();
				setTimeout(run, 0);
			} catch (exception) {
				self.log(this.gba.LOG_DEBUG, exception);
				self.pause();
				throw exception;
			}
		}
	}
	setTimeout(run, 0);
}

Console.prototype.run = function() {
	if (this.stillRunning) {
		return;
	}

	this.stillRunning = true;
	var regs = document.getElementById('registers');
	var mem = document.getElementById('memory');
	var start = Date.now();
	regs.setAttribute('class', 'disabled');
	mem.setAttribute('class', 'disabled');
	var self = this;
	this.gba.runStable();
}

Console.prototype.runFrame = function() {
	if (this.stillRunning) {
		return;
	}

	this.stillRunning = true;
	var regs = document.getElementById('registers');
	var mem = document.getElementById('memory');
	var start = Date.now();
	regs.setAttribute('class', 'disabled');
	mem.setAttribute('class', 'disabled');
	var self = this;
	run = function() {
		self.gba.step();
		self.pause();
	}
	setTimeout(run, 0);
}

Console.prototype.pause = function() {
	this.stillRunning = false;
	this.gba.pause();
	var regs = document.getElementById('registers');
	var mem = document.getElementById('memory');
	mem.removeAttribute('class');
	regs.removeAttribute('class');
	this.update();
	this.flushLog();
}

Console.prototype.breakpointHit = function() {
	this.pause();
	this.log(this.gba.LOG_DEBUG, 'Hit breakpoint at ' + hex(this.cpu.gprs[this.cpu.PC]));
}

Console.prototype.addBreakpoint = function(addr) {
	this.breakpoints[addr] = true;
	var bpLi = document.getElementById('bp' + addr);
	if (!bpLi) {
		bpLi = document.createElement('li');
		bpLi.address = addr;
		var cb = document.createElement('input');
		cb.setAttribute('type', 'checkbox');
		cb.setAttribute('checked', 'checked');
		var self = this;
		cb.addEventListener('click', function() {
			self.breakpoints[addr] = cb.checked;
		}, false);
		bpLi.appendChild(cb);
		bpLi.appendChild(document.createTextNode(hex(addr)));
		document.getElementById('breakpointView').appendChild(bpLi);
	}
}

Console.prototype.testBreakpoints = function() {
	if (this.breakpoints.length && this.breakpoints[this.cpu.gprs[this.cpu.PC]]) {
		this.breakpointHit();
		return false;
	}
	return this.gba.waitFrame();
};

Memory = function(mmu) {
	this.mmu = mmu;
	this.ul = document.getElementById('memoryView');
	row = this.createRow(0);
	this.ul.appendChild(row);
	this.rowHeight = row.offsetHeight;
	this.numberRows = this.ul.parentNode.offsetHeight / this.rowHeight + 2;
	this.ul.removeChild(row);
	this.scrollTop = 50 - this.ul.parentElement.firstElementChild.offsetHeight;

	for (var i = 0; i < this.numberRows; ++i) {
		this.ul.appendChild(this.createRow(i << 4));
	}
	this.ul.parentElement.scrollTop = this.scrollTop;

	var self = this;
	this.ul.parentElement.addEventListener('scroll', function(e) { self.scroll(e) }, true);
	window.addEventListener('resize', function(e) { self.resize() }, true);
}

Memory.prototype.scroll = function(e) {
	while (this.ul.parentElement.scrollTop - this.scrollTop < this.rowHeight) {
		if (this.ul.firstChild.offset == 0) {
			break;
		}
		var victim = this.ul.lastChild;
		this.ul.removeChild(victim);
		victim.offset = this.ul.firstChild.offset - 16;
		this.refresh(victim);
		this.ul.insertBefore(victim, this.ul.firstChild);
		this.ul.parentElement.scrollTop += this.rowHeight;
	}
	while (this.ul.parentElement.scrollTop - this.scrollTop > this.rowHeight * 2) {
		var victim = this.ul.firstChild;
		this.ul.removeChild(victim);
		victim.offset = this.ul.lastChild.offset + 16;
		this.refresh(victim);
		this.ul.appendChild(victim);
		this.ul.parentElement.scrollTop -= this.rowHeight;
	}
	if (this.ul.parentElement.scrollTop < this.scrollTop) {
		this.ul.parentElement.scrollTop = this.scrollTop;
		e.preventDefault();
	}
}

Memory.prototype.resize = function() {
	this.numberRows = this.ul.parentNode.offsetHeight / this.rowHeight + 2;
	if (this.numberRows > this.ul.children.length) {
		var offset = this.ul.lastChild.offset + 16;
		for (var i = 0; i < this.numberRows - this.ul.children.length; ++i) {
			var row = this.createRow(offset);
			this.refresh(row);
			this.ul.appendChild(row);
			offset += 16;
		}
	} else {
		for (var i = 0; i < this.ul.children.length - this.numberRows; ++i) {
			this.ul.removeChild(this.ul.lastChild);
		}
	}
}

Memory.prototype.refresh = function(row) {
	var showChanged;
	var newValue;
	var child;
	row.firstChild.textContent = hex(row.offset);
	if (row.oldOffset == row.offset) {
		showChanged = true;
	} else {
		row.oldOffset = row.offset;
		showChanged = false;
	}
	for (var i = 0; i < 16; ++i) {
		child = row.children[i + 1];
		try {
			newValue = this.mmu.loadU8(row.offset + i);
			if (newValue >= 0) {
				newValue = hex(newValue, 2, false);
				if (child.textContent == newValue) {
					child.setAttribute('class', 'memoryCell');
				} else if (showChanged) {
					child.setAttribute('class', 'memoryCell changed');
					child.textContent = newValue;
				} else {
					child.setAttribute('class', 'memoryCell');
					child.textContent = newValue;
				}
			} else {
				child.setAttribute('class', 'memoryCell');
				child.textContent = '--';				
			}
		} catch (exception) {
			child.setAttribute('class', 'memoryCell');
			child.textContent = '--';
		}
	}
}

Memory.prototype.refreshAll = function() {
	for (var i = 0; i < this.ul.children.length; ++i) {
		this.refresh(this.ul.children[i]);
	}
}

Memory.prototype.createRow = function(startOffset) {
	var li = document.createElement('li');
	var offset = document.createElement('span');
	offset.setAttribute('class', 'memoryOffset');
	offset.textContent = hex(startOffset);
	li.appendChild(offset);

	for (var i = 0; i < 16; ++i) {
		var b = document.createElement('span');
		b.textContent = '00';
		b.setAttribute('class', 'memoryCell');
		li.appendChild(b);
	}
	li.offset = startOffset;
	li.oldOffset = startOffset;
	return li;
}

Memory.prototype.scrollTo = function(offset) {
	offset &= 0xFFFFFFF0;
	if (offset) {
		for (var i = 0; i < this.ul.children.length; ++i) {
			var child = this.ul.children[i];
			child.offset = offset + (i - 1) * 16;
			this.refresh(child);
		}
		this.ul.parentElement.scrollTop = this.scrollTop + this.rowHeight;
	} else {
		for (var i = 0; i < this.ul.children.length; ++i) {
			var child = this.ul.children[i];
			child.offset = offset + i * 16;
			this.refresh(child);
		}
		this.ul.parentElement.scrollTop = this.scrollTop;
	}
}

function PaletteViewer(palette) {
	this.palette = palette;
	this.view = document.createElement('canvas');
	this.view.setAttribute('class', 'paletteView');
	this.view.setAttribute('width', '240');
	this.view.setAttribute('height', '500');
}

PaletteViewer.prototype.insertChildren = function(container) {
	container.appendChild(this.view);
}

PaletteViewer.prototype.redraw = function() {
	var context = this.view.getContext('2d');
	context.clearRect(0, 0, this.view.width, this.view.height);
	for (var p = 0; p < 2; ++p) {
		for (var y = 0; y < 16; ++y) {
			for (var x = 0; x < 16; ++x) {
				var color = this.palette.loadU16((p * 256 + y * 16 + x) * 2);
				var r = (color & 0x001F) << 3;
				var g = (color & 0x03E0) >> 2;
				var b = (color & 0x7C00) >> 7;
				context.fillStyle = '#' + hex(r, 2, false) + hex(g, 2, false) + hex(b, 2, false);
				context.fillRect(x * 15 + 1, y * 15 + p * 255 + 1, 13, 13);
			}
		}
	}
}

function TileViewer(vram, palette) {
	this.BG_MAP_WIDTH = 256;
	this.vram = vram;
	this.palette = palette;

	this.view = document.createElement('canvas');
	this.view.setAttribute('class', 'tileView');
	this.view.setAttribute('width', '256');
	this.view.setAttribute('height', '512');

	this.activePalette = 0;
}

TileViewer.prototype.insertChildren = function(container) {
	container.appendChild(this.view);
};

TileViewer.prototype.redraw = function() {
	var context = this.view.getContext('2d');
	var data = context.createImageData(this.BG_MAP_WIDTH, 512);
	var t = 0;
	for (var y = 0; y < 512; y += 8) {
		for (var x = 0; x < this.BG_MAP_WIDTH; x += 8) {
			this.drawTile(data.data, t, this.activePalette, x + y * this.BG_MAP_WIDTH, this.BG_MAP_WIDTH);
			++t;
		}
	}
	context.putImageData(data, 0, 0);
};

TileViewer.prototype.drawTile = function(data, tile, palette, offset, stride) {
	for (var j = 0; j < 8; ++j) {
		var memOffset = tile << 5;
		memOffset |= j << 2;

		var row = this.vram.load32(memOffset);
		for (var i = 0; i < 8; ++i) {
			var index = (row >> (i << 2)) & 0xF;
			var color = this.palette.loadU16((index << 1) + (palette << 5));
			var r = (color & 0x001F) << 3;
			var g = (color & 0x03E0) >> 2;
			var b = (color & 0x7C00) >> 7;
			data[(offset + i + stride * j) * 4 + 0] = r;
			data[(offset + i + stride * j) * 4 + 1] = g;
			data[(offset + i + stride * j) * 4 + 2] = b;
			data[(offset + i + stride * j) * 4 + 3] = 255;
		}
	}
};
