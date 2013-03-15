Object.prototype.inherit = function() {
	for (var v in this) {
		this[v] = this[v];
	}
};

Serializer = {
	TAG_INT: 1,
	TAG_STRING: 2,
	TAG_STRUCT: 3,
	TAG_BLOB: 4,
	TAG_BOOLEAN: 5,
	TYPE: 'application/octet-stream',

	pointer: function() {
		this.index = 0;
		this.top = 0;
		this.stack = [];
	},

	pack: function(value) {
		var object = new DataView(new ArrayBuffer(4));
		object.setUint32(0, value, true);
		return object.buffer;
	},

	pack8: function(value) {
		var object = new DataView(new ArrayBuffer(1));
		object.setUint8(0, value, true);
		return object.buffer;
	},

	prefix: function(value) {
		return new Blob([Serializer.pack(value.size || value.length || value.byteLength), value], { type: Serializer.TYPE });
	},

	serialize: function(stream) {
		var parts = [];
		var size = 4;
		for (i in stream) {
			if (stream.hasOwnProperty(i)) {
				var tag;
				var head = Serializer.prefix(i);
				var body;
				switch (typeof(stream[i])) {
				case 'number':
					tag = Serializer.TAG_INT;
					body = Serializer.pack(stream[i]);
					break;
				case 'string':
					tag = Serializer.TAG_STRING;
					body = Serializer.prefix(stream[i]);
					break;
				case 'object':
					if (stream[i].type == Serializer.TYPE) {
						tag = Serializer.TAG_BLOB;
						body = Serializer.prefix(stream[i]);
					} else {
						tag = Serializer.TAG_STRUCT;
						body = Serializer.serialize(stream[i]);
					}
					break;
				case 'boolean':
					tag = Serializer.TAG_BOOLEAN;
					body = Serializer.pack8(stream[i]);
					break;
				default:
					console.log(stream[i]);
					break;
				}
				size += 1 + head.size + (body.size || body.byteLength || body.length);
				parts.push(Serializer.pack8(tag));
				parts.push(head);
				parts.push(body);
			}
		}
		parts.unshift(Serializer.pack(size));
		return new Blob(parts);
	},

	deserialize: function(blob, callback) {
		var reader = new FileReader();
		reader.onload = function(data) {
			callback(Serializer.deserealizeStream(new DataView(data.target.result), new Serializer.pointer));
		}
		reader.readAsArrayBuffer(blob);
	},

	deserealizeStream: function(view, pointer) {
		pointer.push();
		var object = {};
		var remaining = view.getUint32(pointer.advance(4), true);
		while (pointer.mark() < remaining) {
			var tag = view.getUint8(pointer.advance(1));
			var head = pointer.readString(view);
			var body;
			switch (tag) {
			case Serializer.TAG_INT:
				body = view.getUint32(pointer.advance(4), true);
				break;
			case Serializer.TAG_STRING:
				body = pointer.readString(view);
				break;
			case Serializer.TAG_STRUCT:
				body = Serializer.deserealizeStream(view, pointer);
				break;
			case Serializer.TAG_BLOB:
				var size = view.getUint32(pointer.advance(4), true);
				body = view.buffer.slice(pointer.advance(size), pointer.advance(0));
				break;
			case Serializer.TAG_BOOLEAN:
				body = !!view.getUint8(pointer.advance(1));
				break;
			}
			object[head] = body;
		}
		if (pointer.mark() > remaining) {
			throw "Size of serialized data exceeded";
		}
		pointer.pop();
		return object;
	}
};

Serializer.pointer.prototype.advance = function(amount) {
	var index = this.index;
	this.index += amount;
	return index;
};

Serializer.pointer.prototype.mark = function() {
	return this.index - this.top;
};

Serializer.pointer.prototype.push = function() {
	this.stack.push(this.top);
	this.top = this.index;
};

Serializer.pointer.prototype.pop = function() {
	this.top = this.stack.pop();
};

Serializer.pointer.prototype.readString = function(view) {
	var length = view.getUint32(this.advance(4), true);
	var bytes = [];
	for (var i = 0; i < length; ++i) {
		bytes.push(String.fromCharCode(view.getUint8(this.advance(1))));
	}
	return bytes.join('');
};
