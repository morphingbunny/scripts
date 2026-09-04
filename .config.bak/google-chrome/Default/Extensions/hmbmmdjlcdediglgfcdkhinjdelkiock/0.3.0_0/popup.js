var port = chrome.extension.connect();
port.postMessage({action: 'start'});

var slide = document.getElementById('slide');

port.postMessage({action: 'give value'});
port.onMessage.addListener(function(msg) {
  slide.value = parseInt(msg);
});

slide.onchange = function () {
  chrome.storage.sync.set({
		bold: this.value/100
	}, function() {
		// Update status to let user know options were saved.
		var status = document.getElementById('status');
		status.textContent = 'Options saved.';
		setTimeout(function() {
			status.textContent = '';
		}, 750);
	});
}

button.onclick = function() {
  port.postMessage({faction: true});
  window.close();
}
