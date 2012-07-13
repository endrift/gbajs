function hex(number, leading) {
	if (typeof(leading) === 'undefined') {
		leading = 8;
	}
	var string = (number >>> 0).toString(16).toUpperCase();
	leading -= string.length;
	return '0x' + new Array(leading + 1).join('0') + string;
}

Console = function(cpu) {
	this.cpu = cpu;
	this.ul = document.getElementById('console');
	this.gprs = document.getElementById('gprs');
	this.updateGPRs();
	this.updateCPSR();
}

Console.prototype.updateGPRs = function() {
	for (var i = 0; i < 16; ++i) {
		this.gprs.children[i].innerText = hex(this.cpu.gprs[i]);
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
		mode.innerText = 'USER';
		break;
	case cpu.MODE_IRQ:
		mode.innerText = 'IRQ';
		break;
	case cpu.MODE_ABORT:
		mode.innerText = 'ABORT';
		break;
	case cpu.MODE_UNDEFINED:
		mode.innerText = 'UNDEFINED';
		break;
	case cpu.MODE_SYSTEM:
		mode.innerText = 'SYSTEM';
		break;
	default:
		mode.innerText = '???';
		break;
	}
}

Console.prototype.log = function(message) {
	var entry = document.createElement('li');
	var doScroll = this.ul.scrollTop == this.ul.scrollHeight - this.ul.offsetHeight;
	entry.innerText = message;
	this.ul.appendChild(entry);
	if (doScroll) {
		this.ul.scrollTop = this.ul.scrollHeight - this.ul.offsetHeight;
	}
}

Console.prototype.step = function() {
	try {
		this.cpu.step();
		this.updateGPRs();
		this.updateCPSR();
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
				setTimeout(run, 0);
			} catch (exception) {
				self.stillRunning = false;
				throw exception;
			}
		}
	}
	run();
}

Console.prototype.run = function() {
	if (this.stillRunning) {
		return;
	}

	this.stillRunning = true;
	var regs = document.getElementById('registers');
	var start = new Date().getTime();
	regs.setAttribute('class', 'disabled');
	var self = this;
	run = function() {
		if (self.stillRunning) {
			try {
				for (var i = 0; i < 16780; ++i) {
					self.cpu.step();
				}
				setTimeout(run, 0);
			} catch (exception) {
				self.stillRunning = false;
				self.log("Exception hit after " + (new Date().getTime() - start) + " milliseconds!");
				self.log(exception);
				self.updateGPRs();
				self.updateCPSR();
				regs.removeAttribute('class');
				throw exception;
			}
		} else {
			regs.removeAttribute('class');
		}
	}
	run();
}

Console.prototype.pause = function() {
	this.stillRunning = false;
}

Memory = function(mmu) {
	this.mmu = mmu;
	this.ul = document.getElementById('memory');
	row = this.createRow(0);
	this.ul.appendChild(row);
	this.rowHeight = row.offsetHeight;
	this.numberRows = this.ul.offsetHeight / this.rowHeight + 2;
	this.ul.removeChild(row);

	for (var i = 0; i < this.numberRows; ++i) {
		this.ul.appendChild(this.createRow(i << 4));
	}

	var self = this;
	this.ul.addEventListener('scroll', function(e) { self.scroll() }, true);
}

Memory.prototype.scroll = function() {
	while (this.ul.scrollTop < this.rowHeight) {
		var victim = this.ul.lastChild;
		this.ul.removeChild(victim);
		this.ul.insertBefore(victim, this.ul.firstChild);
		this.ul.scrollTop += this.rowHeight;
	}
	while (this.ul.scrollTop > this.rowHeight * 2) {
		var victim = this.ul.firstChild;
		this.ul.removeChild(victim);
		this.ul.appendChild(victim);
		this.ul.scrollTop -= this.rowHeight;
	}
}

Memory.prototype.createRow = function(startOffset) {
	var li = document.createElement('li');
	var offset = document.createElement('span');
	offset.setAttribute('class', 'memoryOffset');
	offset.innerText = hex(startOffset);
	li.appendChild(offset);

	for (var i = 0; i < 16; ++i) {
		var b = document.createElement('span');
		b.innerText = '00';
		b.setAttribute('class', 'memoryCell');
		li.appendChild(b);
	}
	return li;
}
