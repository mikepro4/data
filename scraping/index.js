var CronJob = require('cron').CronJob;
const _ = require("lodash");
const mongoose = require("mongoose");
const request = require('request-promise');


const YoutubeSearch = require("./scrape_yt_search");

const Video = mongoose.model("videos");
const VideoLog = mongoose.model("videologs");
const Ticker = mongoose.model("tickers");
const Proxy = mongoose.model("proxies");
const Channel = mongoose.model("channels");
const ChannelLog = mongoose.model("channellogs");
const Scraping = mongoose.model("scraping");


const keys = require("./../config/keys");

let io

module.exports = socket => {
    io = socket
}

let scraperStatus = {
    active: null,
    currentTicker: 0,
    currentTickerCount: 0,
    tickerCount: 0,
    pausedTicker: null,
    currentCycle: {
        cycleStartTime: null,
        videosAdds: 0,
        videosUpdates: 0,
        videoDeletes: 0,
        proxyErrors: 0
    },
    previousCycle: null,
    useSmartproxy: false,
    // sorting: "CAISBAgCEAE"
    sorting: "CAASBAgCEAE"
}

module.exports.start = () => {
    scraperStatus.active = true
    loadFirstTicker()
}

module.exports.stop = () => {
    scraperStatus.active = false
}


/////////////////////////////////////////

// Initial start

function initialSetup() {
    return new Promise(async (resolve, reject) => {
        try {
            Scraping.findOne({}, async (err, scraping) => {
                if (scraping) {
                    scraperStatus.active = scraping.scrapingSearchActive

                    if(scraperStatus.active) {
                        loadFirstTicker()
                    }

                    resolve(scraping)
                }
            });
        } catch (e) {
            reject(e)
        }
    })
}

initialSetup()

/////////////////////////////////////////

loadFirstTicker = async (req, res) => {
    const query = Ticker.find()
            .sort({ "metadata.symbol": "1" })
            .skip(0)
            .limit(1);
            
    return Promise.all(
        [query, Ticker.find().countDocuments()]
    ).then(
        results => {
            let symbol = results[0]
            scraperStatus.currentTicker = 0
            tickerCount = results[1]

            let finalSymbol = symbol[0].metadata.symbol

            if(symbol[0] && symbol[0].metadata) {
                setTimeout(() => {

                    searchVideos(finalSymbol)

                    if(scraperStatus.active) {
                        // loadNextTicker()
                    }

                    return console.log({
                        ticker: symbol[0].metadata.symbol,
                        count: results[1]
                    });
                }, 10)
                
            }

            
        }
    );
}

/////////////////////////////////////////

function searchVideos(ticker) {
    return Proxy.aggregate([{ $sample: { size: 1 } }]).then(random => {

        let proxy = "http://" + random[0].metadata.ip

        if(scraperStatus.useSmartproxy) {
            proxy =  keys.sp
        }

        io.emit('tickerUpdate', {
            ticker: ticker,
            proxy: proxy
        })

        // console.log(ticker, 
        //     {sp: scraperStatus.sorting },
        //     proxy,
        //     io)

        YoutubeSearch
            .search(
                ticker, 
                {sp: scraperStatus.sorting },
                proxy,
                io
            )
            .then(results => {
                console.log(results)
                // results.videos.map((result) => {
                // return checkVideo(result, ticker)
            // })
        }).catch((err) => console.log(err));
    });
}

/////////////////////////////////////////

var job = new CronJob(
    // '0/30 * * * * *',
    '0 * * * *',
    function() {
        console.log("run cron count")
        loadFirstTickerCount()
    },
    null,
    true,
    'America/Los_Angeles'
);

job.start()