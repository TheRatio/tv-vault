const { getConfig, fetchTorrents, downloadTorrent } = require('./utils');

module.exports = async function() {
	try {
		const config = getConfig(),
			torrentUrls = await fetchTorrents(config);

		for (const url of torrentUrls) {
			await downloadTorrent(config, url);
		}
	} catch(error) {
		console.log(error);
	}
}
