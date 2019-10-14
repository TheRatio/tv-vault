let requestNative = require('request-promise-native');
	  
const FileCookieStore = require('tough-cookie-filestore'),
	  async = require('async'),
	  cheerio = require('cheerio'),
	  path = require('path'),
	  fs = require('fs');

const configPath = path.join(__dirname, '../../config.json'),
	  cookiesPath = path.join(__dirname, '../../cookies.json');

const validateCookiePath = () => {
	if(!fs.existsSync(cookiesPath)) {
		fs.closeSync(fs.openSync(cookiesPath, 'a'));
	}
};

const getRequest = (() => {
	let request;

	validateCookiePath();

	return () => {
		if (request) {
			return request;
		}

		const jar = requestNative.jar(new FileCookieStore(cookiesPath));

		request = requestNative.defaults({ jar });

		return request;
	}
})();

exports.getConfig = () => {
	try {
		return require(configPath);
	} catch (error){
		if (error.message.includes('Cannot find module')) {
			console.error('Please create a config.json from the example config.');
		}

		if (error.message.includes('Unexpected')) {
			console.error(error);
		}

		process.exit();
	}
};

const login = async config => {
	try {
		const request = getRequest();

		await request({
			method: 'POST',
			uri: 'http://tv-vault.me/login.php',
			form: {
				username: config.username,
				password: config.password
			},
			simple: false,
			resolveWithFullResponse: true
		});
	} catch(error) {
		console.log('TV Vault login failed!');
		console.log(error);

		process.exit();
	}
};

const getIndexPage = async () => {
	try {
		const request = getRequest();

		const response = await request({
			uri: 'http://tv-vault.me/index.php',
			simple: false,
			resolveWithFullResponse: true
		});

		return response.body;
	} catch(error) {
		console.error('TV Vault index request failed!');
		console.error(error);

		process.exit();
	}
};

const getShowOfTheDayUrl = async htmlTree => new Promise((resolve, reject) => {
	const $ = cheerio.load(htmlTree),
		table = $('.torrent_table').first(),
		heads = table.find('.head'),
		showOfTheDayHead = $(heads[1]),
		showTr = showOfTheDayHead.next(),
		showAnchor = showTr.find('a'),
		url = showAnchor.attr('href');

	if(!url) {
		console.log('Could not find the show of the day page!');
		process.exit();
	}

	resolve(url);
});

const getShowOfTheDayPage = async showOfTheDayUrl => {
	try {
		const request = getRequest();

		const response = await request({
			uri: `http://tv-vault.me/${showOfTheDayUrl}`,
			simple: false,
			resolveWithFullResponse: true
		});

		return response.body;
	} catch(error) {
		console.error('TV Vault show of the day page request failed!');
		console.error(error);

		process.exit();
	}
};

const getShowOfTheDayDownloadUrls = async showOfTheDayPage => {
	const downloadUrls = [],
		$ = cheerio.load(showOfTheDayPage),
		table = $('.torrent_table').first(),
		anchors = table.find('a[title="Download"]');

	anchors.each((index, anchor) => {
		const href = $(anchor).attr('href');
		downloadUrls.push(href);
	});

	if(!downloadUrls.length) {
		console.log("No download links for today's show of the day!");
		process.exit();
	}

	return downloadUrls;
};

exports.downloadTorrent = async (config, url) => {
	const request = getRequest();

	await request(`http://tv-vault.me/${url}`).pipe(fs.createWriteStream(`${config.downloadPath}/${Math.random().toString(36).slice(-5)}.torrent`));
};

exports.fetchTorrents = async function(config) {
	await login(config);

	const indexPage = await getIndexPage(),
		showOfTheDayUrl = await getShowOfTheDayUrl(indexPage),
		showOfTheDayPage = await getShowOfTheDayPage(showOfTheDayUrl),
		downloadUrls = await getShowOfTheDayDownloadUrls(showOfTheDayPage);

	return downloadUrls;
}
