const request = require('request-promise');
const keys = require("../config/keys");
const mongoose = require("mongoose");

const Ticker = mongoose.model("tickers");


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
