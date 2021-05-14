const request = require('request-promise');
const mongoose = require("mongoose");

const Ticker = mongoose.model("tickers");
const Channel = mongoose.model("channels");


exports.searchTickers = function() {
    return new Promise(async (resolve, reject) => {
        try {
            Ticker.find(
                {
                    "active": { $eq: true }
                },
                async (err, results) => {
                    resolve(results);
                }
            );
        } catch (e) {
            reject(e);
        }
    });
}

exports.searchChannels = function() {
    return new Promise(async (resolve, reject) => {
        try {
            Channel.find(
                {
                },
                async (err, results) => {
                    resolve(results);
                }
            );
        } catch (e) {
            reject(e);
        }
    });
}
