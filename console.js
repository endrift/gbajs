function hex(number, leading, usePrefix) {
	if (typeof(usePrefix) === 'undefined') {
		usePrefix = true;
	}
	if (typeof(leading) === 'undefined') {
		leading = 8;
	}
	var string = (number >>> 0).toString(16).toUpperCase();
	leading -= string.length;
	return (usePrefix ? '0x' : '')  + new Array(leading + 1).join('0') + string;
}

Console = function(gba) {
	this.cpu = gba.cpu;
	this.ul = document.getElementById('console');
	this.gprs = document.getElementById('gprs');
	this.memory = new Memory(gba.mmu);
	this.updateGPRs();
	this.updateCPSR();
	this.breakpoints = [];
	this.memory.refreshAll();
	this.logQueue = [];
	var self = this;
	gba.cpu.setLogger(function (message) { self.log(message) });
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

Console.prototype.log = function(message) {
	this.logQueue.push(message);
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

Console.prototype.step = function() {
	try {
		this.cpu.step();
		this.updateGPRs();
		this.updateCPSR();
		this.memory.refreshAll();
	} catch (exception) {
		this.log(exception);
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
	var start = new Date().getTime();
	regs.setAttribute('class', 'disabled');
	mem.setAttribute('class', 'disabled');
	var self = this;
	var instructions = 0;
	run = function() {
		if (self.stillRunning) {
			try {
				if (self.breakpoints.length) {
					var base = self.cpu.cycles;
					while (self.cpu.cycles - base < 280896 * 8) {
						++instructions;
						self.cpu.step();
						if (self.breakpoints[self.cpu.gprs[self.cpu.PC]]) {
							self.breakpointHit();
							return;
						}
					}
				} else {
					var base = self.cpu.cycles;
					while (self.cpu.cycles - base < 280896 * 8) {
						++instructions;
						self.cpu.step();
					}
				}
				setTimeout(run, 0);
			} catch (exception) {
				self.log("Exception hit after " + instructions + " instructions in " + (new Date().getTime() - start) + " milliseconds!");
				self.log(exception);
				self.pause();
				throw exception;
			}
		}
	}
	setTimeout(run, 0);
}

Console.prototype.pause = function() {
	this.stillRunning = false;
	var regs = document.getElementById('registers');
	var mem = document.getElementById('memory');
	mem.removeAttribute('class');
	regs.removeAttribute('class');
	this.updateGPRs();
	this.updateCPSR();
	this.memory.refreshAll();
	this.flushLog();
}

Console.prototype.breakpointHit = function() {
	this.pause();
	this.log('Hit breakpoint at ' + hex(this.cpu.gprs[this.cpu.PC]));
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
		bpLi.appendChild(cb);
		bpLi.appendChild(document.createTextNode(hex(addr)));
		document.getElementById('breakpointView').appendChild(bpLi);
	}
}

Memory = function(mmu) {
	this.mmu = mmu;
	this.ul = document.getElementById('memoryView');
	row = this.createRow(0);
	this.ul.appendChild(row);
	this.rowHeight = row.offsetHeight;
	this.numberRows = this.ul.offsetHeight / this.rowHeight + 2;
	this.ul.removeChild(row);

	for (var i = 0; i < this.numberRows; ++i) {
		this.ul.appendChild(this.createRow(i << 4));
	}
	this.ul.scrollTop = 50;

	var self = this;
	this.ul.addEventListener('scroll', function(e) { self.scroll() }, true);
	window.addEventListener('resize', function(e) { self.resize() }, true);
}

Memory.prototype.scroll = function() {
	while (this.ul.scrollTop - 50 < this.rowHeight) {
		if (this.ul.firstChild.offset == 0) {
			break;
		}
		var victim = this.ul.lastChild;
		this.ul.removeChild(victim);
		victim.offset = this.ul.firstChild.offset - 16;
		this.refresh(victim);
		this.ul.insertBefore(victim, this.ul.firstChild);
		this.ul.scrollTop += this.rowHeight;
	}
	while (this.ul.scrollTop - 50 > this.rowHeight * 2) {
		var victim = this.ul.firstChild;
		this.ul.removeChild(victim);
		victim.offset = this.ul.lastChild.offset + 16;
		this.refresh(victim);
		this.ul.appendChild(victim);
		this.ul.scrollTop -= this.rowHeight;
	}
	if (this.ul.scrollTop < 50) {
		this.ul.scrollTop = 50;
	}
}

Memory.prototype.resize = function() {
	this.numberRows = this.ul.offsetHeight / this.rowHeight + 2;
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
			newValue = hex(this.mmu.loadU8(row.offset + i), 2, false);
			if (child.textContent == newValue) {
				child.setAttribute('class', 'memoryCell');
			} else if (showChanged) {
				child.setAttribute('class', 'memoryCell changed');
				child.textContent = newValue;
			} else {
				child.setAttribute('class', 'memoryCell');
				child.textContent = newValue;
			}
		} catch (exception) {
			child.setAttribute('class', 'memoryCell');
			child.textContent = '??';
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
		this.ul.scrollTop = 50+ this.rowHeight;
	} else {
		for (var i = 0; i < this.ul.children.length; ++i) {
			var child = this.ul.children[i];
			child.offset = offset + i * 16;
			this.refresh(child);
		}
		this.ul.scrollTop = 50;
	}
}
