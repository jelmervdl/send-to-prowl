var api_key_el = document.getElementById('api_key');
var close_tab_el = document.getElementById('close_tab');
var show_notification_el = document.getElementById('show_notification');
var status_el = document.getElementById('status');
var request_api_key_button_el = document.getElementById('request_api_key_button');
var history_el = document.querySelector('#history tbody');
var clear_status;

function urlencode(data)
{
	var pairs = [];
	
	for (var key in data)
		pairs.push(encodeURIComponent(key) + "=" + encodeURIComponent(data[key]));
	
	return pairs.join('&');
}

function Prowl()
{
	this.provider_key = 'c8f364809d533a1fee2ebeaf87040fc600f37201';
	this.host = "https://api.prowlapp.com/publicapi/";
}

Prowl.prototype.call = function(method, action, data, onresponse)
{
	var body = urlencode(data);
	
	var request = new XMLHttpRequest();
	request.onreadystatechange = function() {
		if (request.readyState == 4)
			onresponse(request);
	};
	
	if (method == 'GET')
	{
		request.open('GET', this.host + action + '?' + body, true);
		request.send();
	}
	else
	{
		request.open('POST', this.host + action, true);
		request.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
		request.send(body);
	}
};

Prowl.prototype.validateApiKey = function(key, onresponse)
{
	this.call('GET', 'verify',
		{
			'providerkey': this.provider_key,
			'apikey': key
		},
		function(response) {
			onresponse(response.responseXML.getElementsByTagName('success').length > 0);
		});
};

Prowl.prototype.requestToken = function(onresponse)
{
	this.call('GET', 'retrieve/token',
		{
			'providerkey': this.provider_key
		},
		function(response) {
			if (response.responseXML.getElementsByTagName('error') > 0)
				onresponse(false);
			else
				onresponse({
					'token': response.responseXML.getElementsByTagName('retrieve')[0].getAttribute('token'),
					'url': response.responseXML.getElementsByTagName('retrieve')[0].getAttribute('url')
				});
		});
};

Prowl.prototype.requestKey = function(token, onresponse)
{
	this.call('GET', 'retrieve/apikey',
		{
			'providerkey': this.provider_key,
			'token': token
		},
		function(response) {
			if (response.responseXML.getElementsByTagName('error').length > 0)
				onresponse(false);
			else
				onresponse(response.responseXML.getElementsByTagName('retrieve')[0].getAttribute('apikey'));
		});
};

var prowl = new Prowl();

function load()
{
	api_key_el.value = preference('api_key', '');
	loadPreferences();
	loadHistory();
}

function saveApiKey(onsuccess, onerror)
{
	var api_key = api_key_el.value;
	
	if (api_key.length === 0)
	{
		setPreference('api_key', '');
		onsuccess();
	}
	else if (api_key.length == 40)
	{
		prowl.validateApiKey(api_key, function(success) {
			if (success)
			{
				setPreference('api_key', api_key);
				onsuccess();
			}
			else
				onerror();
		});
	}
	else
		onerror();
}

function status(message, level)
{
	clearTimeout(clear_status);
	status_el.innerText = message;
	status_el.className = 'visible ' + level;
	clear_status = setTimeout(function() {
		status_el.className = '';
	}, 5000);
}

function preference(name, default_value)
{
	try {
		if (typeof localStorage[name] == 'undefined')
			throw new Error('Preference not found');

		return JSON.parse(localStorage[name]);
	} catch (e) {
		return default_value;
	}
}

function setPreference(name, value)
{
	localStorage[name] = JSON.stringify(value);
}

api_key_el.addEventListener('keydown', function(e)
{
	switch (e.keyCode)
	{
		case 27: // esc
			load();
			e.preventDefault();
			break;
		case 13: // enter
			status('Validating Key...', '');
			saveApiKey(
				function() { status('API Key Saved', 'ok'); },
				function() { status('Invalid API Key', 'error'); });
			e.preventDefault();
			break;
	}
});

close_tab_el.addEventListener('change', function(e)
{
	setPreference('close_tab', close_tab_el.checked);
});

show_notification_el.addEventListener('change', function(e)
{
	setPreference('show_notification', show_notification_el.checked);
});

var token = null;

request_api_key_button_el.addEventListener('click', function(e)
{
	request_api_key_button_el.disabled = true;
	prowl.requestToken(function(response) {
		if (!response)
		{
			status('Could not retrieve token used to request the key', 'error');
			request_api_key_button_el.disabled = false;
			return;
		}
		
		token = response.token;
		chrome.tabs.create(
			{
				'url': response.url
			},
			function(tab) {
				chrome.tabs.onUpdated.addListener(function(aTab, data) {
					if (aTab != tab.id || !data.url) // only detect url changes of 'our' tab
						return;
					
					if (data.url.indexOf('?do=permit') == -1) // only the 'checkout' page
						return;
						
					prowl.requestKey(token, function(api_key) {
						if (api_key)
						{
							setPreference('api_key', api_key);
							status('Key saved', 'ok');
							load();
						}
						else
						{
							status('An error occurred while trying to retrieve the key', 'error');
						}
						
						request_api_key_button_el.disabled = false;
					});
					
					chrome.tabs.remove(aTab);
				});
				
				chrome.tabs.onRemoved.addListener(function(aTab) {
					if (tab.id == aTab)
					{
						status('Key request aborted because the tab was closed', '');
						request_api_key_button_el.disabled = false;
					}
				});
			});
		
		status('See the other Prowl tab thingy');
	});
});

function loadPreferences()
{
	close_tab_el.checked = preference('close_tab', true);
	show_notification_el.checked = preference('show_notification', false);
}

function loadHistory()
{
	history_el.innerHTML = '';

	var history = preference('history', []);

	for (var i = history.length - 1; i >= 0; --i)
	{
		var row_el = document.createElement('tr'),
			title_cell_el = document.createElement('td'),
			date_cell_el = document.createElement('td'),
			link_el = document.createElement('a'),
			date_el = document.createElement('time');
		
		row_el.appendChild(title_cell_el);
		row_el.appendChild(date_cell_el);
	
		title_cell_el.appendChild(link_el);
		date_cell_el.appendChild(date_el);

		link_el.href = history[i].link;
		link_el.appendChild(document.createTextNode(history[i].title));

		date_el.appendChild(document.createTextNode(new Date(history[i].date).toLocaleDateString()));

		history_el.appendChild(row_el);
	}
}

load();