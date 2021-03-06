function urlencode(data)
{
	var pairs = [];
	
	for (var key in data)
		pairs.push(encodeURIComponent(key) + "=" + encodeURIComponent(data[key]));
	
	return pairs.join('&');
}

function sendToProwl(method, data, onsuccess, onerror)
{
	var body = urlencode(data);
	
	var request = new XMLHttpRequest();
	request.open("POST", "https://api.prowlapp.com/publicapi/" + method, true);
	request.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
	
	request.onreadystatechange = function() {
		if (request.readyState == 4)
		{
			if (request.responseXML.getElementsByTagName('success'))
			{
				if (onsuccess)
					onsuccess(request);
			}
			else
			{
				if (onerror)
					onerror(request);
			}
		}
	};
	
	request.send(body);
}

function showSuccessNotification(request)
{
	var notification = webkitNotifications.createNotification(
		'56-cloud.png',  // icon url - can be relative
		'Sent URL to Prowl',  // notification title
		'Prowl will do the rest'  // notification body text
	);
	
	notification.show();
	
	setTimeout(function() {
		notification.cancel();
	}, 3000);
}

function showErrorNotification(request)
{
	var errors = request.responseXML.getElementsByTagName('error');
	webkitNotifications.createNotification(
		'56-cloud.png',  // icon url - can be relative
		'Error while Sending URL to Prowl',  // notification title
		errors[0].innerText  // notification body text
	).show();
}

function preference(name, default_value)
{
	if (typeof localStorage[name] == 'undefined')
		return default_value;
	else
		return JSON.parse(localStorage[name]);
}

function addToHistory(data)
{
	var history = JSON.parse(localStorage['history'] || '[]');

	while (history.length >= 10)
		history.shift();
	
	history.push(data);

	localStorage['history'] = JSON.stringify(history);
}

chrome.browserAction.onClicked.addListener(function() {
	chrome.tabs.getSelected(null, function(tab) {
		sendToProwl("add",
			{
				"apikey": localStorage['api_key'],
				"url": tab.url,
				"application": "Chrome",
				"event": "Open URL",
				"description": tab.title
			},
			function(request) {
				addToHistory({
					link: tab.url,
					title: tab.title,
					date: new Date()
				});

				if (preference('show_notification', false))
					showSuccessNotification(request);
				
				if (preference('close_tab', true))
					chrome.tabs.remove(tab.id);
			},
			function(request) {
				console.log(request.responseText);
				showErrorNotification(request);
			});
	});
});
