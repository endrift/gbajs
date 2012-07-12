Console = function(cpu) {
	this.cpu = cpu;
	this.ul = document.getElementById('console');
	this.gprs = document.getElementById('gprs');
	this.updateGPRs();
	this.updateCPSR();
}

Console.prototype.hex = function(number, leading) {
	if (typeof(leading) === 'undefined') {
		leading = 8;
	}
	var string = (number >>> 0).toString(16).toUpperCase();
	leading -= string.length;
	return '0x' + new Array(leading + 1).join('0') + string;
}

Console.prototype.updateGPRs = function() {
	for (var i = 0; i < 16; ++i) {
		this.gprs.children[i].innerText = this.hex(this.cpu.gprs[i]);
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
}

Console.prototype.log = function(message) {
	var entry = document.createElement('li');
	entry.innerText = message;
	this.ul.appendChild(entry);
}

Console.prototype.step = function() {
	this.cpu.step();
	this.updateGPRs();
	this.updateCPSR();
}
