function loadRom(url, callback) {
	var xhr = new XMLHttpRequest();
	xhr.open('GET', url, !!callback);
	xhr.responseType = 'arraybuffer';

	if (callback) {
		xhr.onload = callback;
	}
	xhr.send();

	if (!callback) {
		return xhr.response;
	}
}
