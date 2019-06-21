let request = require('request-promise-native');
	  
const FileCookieStore = require('tough-cookie-filestore'),
	  async = require('async'),
	  cheerio = require('cheerio'),
	  path = require('path'),
	  fs = require('fs');

const configPath = path.join(__dirname, 'config.json'),
	  cookiesPath = path.join(__dirname, 'cookies.json');

const start = async () => {
	let config, showHref;
	const downloadUrls = [];

	// Load user configuration.
	try {
		config = require(configPath);
	} catch (err){
		if (err.message.includes('Cannot find module')) {
			console.error('Please create a config.json from the example config.');
		}

		if (err.message.includes('Unexpected')) {
			console.error(err);
		}

		process.exit();
	}

	const jar = request.jar(new FileCookieStore(cookiesPath));

	request = request.defaults({ jar });

	// Attempt to login
	try {
		const loginReq = await request({
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

	// Attempt to get index page
	try {
		const response = await request({
			uri: 'http://tv-vault.me/index.php',
			simple: false,
			resolveWithFullResponse: true
		});

		const $ = cheerio.load(response.body);

		const table = $('.torrent_table').first();

		const heads = table.find('.head');

		if(heads.length > 2) {
			process.exit();
		}

		const showOfTheDayHead = $(heads[1]);

		if(!showOfTheDayHead) {
			process.exit();
		}

		const showTr = showOfTheDayHead.next();

		const showAnchor = showTr.find('a');

		if(!showAnchor) {
			process.exit();
		}

		showHref = showAnchor.attr('href');

		if(!showHref) {
			console.log('Could not find the show of the day page!');
			process.exit();
		}

	} catch(error) {
		console.error('TV Vault index request failed!');
		console.error(error);

		process.exit();
	}

	try {
		const response = await request({
			uri: `http://tv-vault.me/${showHref}`,
			simple: false,
			resolveWithFullResponse: true
		});

		const $ = cheerio.load(response.body);

		const table = $('.torrent_table').first();

		const anchors = table.find('a[title="Download"]');

		anchors.each((index,anchor) => {
			const href = $(anchor).attr('href');
			downloadUrls.push(href);
		});
	} catch(error) {
		console.error('TV Vault show of the day page request failed!');
		console.error(error);

		process.exit();
	}

	try {
		if(!downloadUrls.length) {
			console.log("No download links for today's show of the day!");
			process.exit();
		}

		async.eachSeries(downloadUrls, (url, next) => {
			const downloadUrl = `http://tv-vault.me/${url}`;
			setTimeout(async () => {
				const result = await request(downloadUrl).pipe(fs.createWriteStream(`${config.downloadPath}/${Math.random().toString(36).slice(-5)}.torrent`));
				next();
			}, 5000);
		});

	} catch(error) {
		console.error('TV Vault show of the day page request failed!');
		console.error(error);

		process.exit();
	}
	
};

start();
