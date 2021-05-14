const passport = require('passport');
const keys = require("../config/keys");

const mongoose = require("mongoose");
const Proxy = mongoose.model("proxies");
const Ticker = mongoose.model("tickers");
const Video = mongoose.model("videos");
const Channel = mongoose.model("channels");
const Group = mongoose.model("groups");

const Youtube = require("../scraping/index");

module.exports = app => {

	app.post("/searchSingleTicker", async (req, res) => {
		Ticker.findOne({ "metadata.symbol":  req.body.symbol}, async (err, ticker) => {
			if (ticker) {

				Youtube
					.searchSingleTicker(
						req.body.symbol, 
						ticker
					)
					.then(results => {
						res.json("good");
				}).catch((err) => console.log(err));

				// res.json(ticker);
			} else {
				res.json("bad");
			}
		});
	});
	
};

const buildQuery = criteria => {
    const query = {};

	return query
};


