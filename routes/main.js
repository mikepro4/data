const passport = require('passport');
const keys = require("../config/keys");

const mongoose = require("mongoose");
const Proxy = mongoose.model("proxies");
const Ticker = mongoose.model("tickers");
const Video = mongoose.model("videos");
const Channel = mongoose.model("channels");
const Group = mongoose.model("groups");
const fs = require('fs');


module.exports = app => {

	app.get("/refresh_data", async (req, res) => {
		// const { username } = req.body;
		return Ticker.find(
			{
				"active": { $eq: true }
			},
			async (err, result) => {
                fs.writeFileSync('scraping/tickers.json', JSON.stringify(result));
				res.json(result);
			}
		);
	});
	
};

const buildQuery = criteria => {
    const query = {};

	return query
};


