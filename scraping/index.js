var CronJob = require('cron').CronJob;
const _ = require("lodash");
const mongoose = require("mongoose");
const request = require('request-promise');


const YoutubeSearch = require("./scrape_yt_search");

const Controller = require("../controllers/main");

const Video = mongoose.model("videos");
const VideoLog = mongoose.model("videologs");
const Ticker = mongoose.model("tickers");
const Proxy = mongoose.model("proxies");
const Channel = mongoose.model("channels");
const ChannelLog = mongoose.model("channellogs");
const Scraping = mongoose.model("scraping");

const keys = require("./../config/keys");

const Tickers = require("./tickers.json");

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
    sorting: "CAASBAgCEAE",
    delay: 1
}

module.exports.start = () => {
    scraperStatus.active = true
}

module.exports.stop = () => {
    scraperStatus.active = false
}

///////////////////////////////////////

var job = new CronJob(
    // '0/30 * * * * *',
    '0 * * * *',
    function() {
        console.log("run cron count")

        Controller
            .searchTickers(
            )
            .then(results => {
                _.map(results, async (record, i) => {
                    setTimeout(() => {
        
                        updateLast24Hours(record)
            
                        console.log({
                            type: "update count",
                            ticker: record.metadata.symbol,
                        });
                    }, i*500)
                })
            }).catch((err) => console.log(err));
        },
    null,
    true,
    'America/Los_Angeles'
);

job.start()

// Initial start

function initialSetup() {
    return new Promise(async (resolve, reject) => {
        try {
            Scraping.findOne({}, async (err, scraping) => {
                if (scraping) {
                    // scraperStatus.active = scraping.scrapingSearchActive
                    scraperStatus.active = true // Change this later

                    if(scraperStatus.active) {
                        searchAll()
                    }
                    resolve(scraping)
                }
            });
        } catch (e) {
            reject(e)
        }
    })
}
function searchAll() {
    Controller
        .searchTickers(
        )
        .then(results => {
            _.map(results, async (record, i) => {
                setTimeout(() => {
        
                    let finalSymbol = record.metadata.symbol
        
                    searchVideos(finalSymbol, record)
        
                    if(i+1 == results.length) {
                        setTimeout(() => {
                            searchAll()
                        }, 250000)
                    }
                    
                    return console.log({
                        ticker: record.metadata.symbol,
                        i: i,
                        percent: (i*100/results.length).toFixed(2),
                        count: results.length
                    });
        
                }, i*50)
            })
    }).catch((err) => console.log(err));
}

initialSetup()

/////////////////////////////////////////

function searchVideos(ticker, fullTicker) {

    var sortArray = [
        'CAISBAgCEAE',
        'CAASBAgCEAE'
    ];
    var randomNumber = Math.floor(Math.random()*sortArray.length);
    

    YoutubeSearch
        .search(
            ticker, 
            {sp: sortArray[randomNumber]},
            "http://urlrouter1.herokuapp.com/",
            fullTicker
        )
        .then(results => {
            results.videos.map((result, i) => {
                setTimeout(() => {
                    checkVideo(result, ticker, fullTicker)
                }, i*1000)
            })
    }).catch((err) => console.log(err));
}
    

/////////////////////////////////////////

function matchTitle(video, ticker, fullTicker) {

    if(fullTicker.strictNameCheck) {
        if(fullTicker.altNames.length > 0) {
            let valid = false
    
            fullTicker.altNames.map((name) => {
                // console.log(name)
                if(video.title.indexOf(name) !== -1) {
                    valid = true
                }
            })
    
            return valid
    
        } 
    } else {
        let newVideo = video.title.toUpperCase()
        if(newVideo.indexOf(ticker) !== -1) {
            return true
        } else {
            if(fullTicker.altNames.length > 0) {
                let valid = false
        
                fullTicker.altNames.map((name) => {
                    // console.log(na÷me)
                    if(video.title.indexOf(name) !== -1) {
                        valid = true
                    }
                })
        
                return valid
        
            } else {
                
            }
        }
    }

}

/////////////////////////////////////////

getChannelSubscribers = async (channel) => {
    return new Promise(async (resolve, reject) => {
        try {
            YoutubeSearch
                .getChannelSubscriptions(
                    channel,
                    "http://urlrouter2.herokuapp.com/",
                )
                .then(count => {
                    console.log(channel + "; " + count )
                    resolve(count)
            }).catch((err) => console.log(err));
        }catch (e) {
            reject(e);
        }
        
    })
}

/////////////////////////////////////////



function checkVideo(video, ticker, fullTicker) {
    return new Promise(async (resolve, reject) => {
        try {
            Video.findOne(
                {
                    googleId: { $eq: video.id }
                },
                async(err, result) => {


                    if(!result) {
                        console.log("add video")
                        // createVideoLog(video, ticker, "add")
                        
                        if(matchTitle(video, ticker, fullTicker)) {
                            const channelCount = await getChannelSubscribers(video.channel.link)
                            if(channelCount) {
                                const newVideo = await new Video({
                                    createdAt: new Date(),
                                    linkedTickers: [
                                        {
                                            symbol: ticker
                                        }
                                    ],
                                    googleId: video.id,
                                    metadata: video,
                                    approvedFor: [
                                        {
                                            symbol: ticker
                                        }
                                    ],
                                    reach: channelCount
                                }).save();

                                if(newVideo) {
                                    updateLast24Hours(fullTicker)
                                    resolve(video)
                                }
                            }
                            
                        } else {
                            const channelCount = await getChannelSubscribers(video.channel.link)
                            if(channelCount) {
                                const newVideo2 = await new Video({
                                    createdAt: new Date(),
                                    linkedTickers: [
                                        {
                                            symbol: ticker
                                        }
                                    ],
                                    googleId: video.id,
                                    metadata: video,
                                    reach: channelCount
                                }).save();

                                if(newVideo2) {
                                    updateLast24Hours(fullTicker)
                                    resolve(video)
                                }
                            }
                        }

                        checkIfChannelExists(video.channel, ticker)

                    } else {

                        let linked = _.find(result.linkedTickers, { symbol: ticker})
                        
                        if (!linked) {

                            let newLinked = [
                                ...result.linkedTickers,
                                {
                                    symbol: ticker
                                }
                            ]

                            if(matchTitle(video, ticker, fullTicker)) {
                                approved = true

                                Video.updateOne(
                                    {
                                        _id: result._id
                                    },
                                    {
                                        $set: { linkedTickers: newLinked },
                                        $push: { approvedFor : {
                                            symbol: ticker
                                        }}
                                    },
                                    async (err, info) => {
                                        if (info) {
                                            console.log("update video")
                                            updateLast24Hours(fullTicker)
                                        }
                                    }
                                );
                            }

                        } else {
                        }
                    }
                }
            );


        } catch (e) {
            reject(e);
        }
        
    })
}

/////////////////////////////////////////

function checkIfChannelExists(channel, ticker) {
    return new Promise(async (resolve, reject) => {
        try {
            Channel.findOne(
                {
                    "metadata.link": { $eq: channel.link }
                },
                async(err, result) => {
                    if(!result) {
                        createChannel(channel, ticker)
                        resolve()
                    } else {
                        linkToChannel(channel, ticker)
                        resolve(result)
                    }
                }
            )
        }catch (e) {
            reject(e);
        }
        
    })
}

/////////////////////////////////////////

function createChannel(channel, ticker) {
    return new Promise(async (resolve, reject) => {
        try {
            const newChannel = await new Channel({
                createdAt: new Date(),
                linkedTickers: [
                    {
                        symbol: ticker
                    }
                ],
                metadata: channel
            }).save();

            if(newChannel) {
                // console.log("add channel")
                // createChannelLog(newChannel, ticker, "add")
                resolve(newChannel)
            }
        }catch (e) {
            reject(e);
        }
        
    })
}

/////////////////////////////////////////

function linkToChannel(channel, ticker) {
    return new Promise(async (resolve, reject) => {
        try {
            Channel.findOne(
                {
                    "metadata.link": { $eq: channel.link }
                },
                async(err, result) => {
                    if(!result) {
                        return 
                    } else {
                        let linked = _.find(result.linkedTickers, { symbol: ticker})

                        if (!linked) {

                            let newLinked = [
                                ...result.linkedTickers,
                                {
                                    symbol: ticker
                                }
                            ]

                            Channel.update(
                                {
                                    _id: result._id
                                },
                                {
                                    $set: { linkedTickers: newLinked }
                                },
                                async (err, info) => {
                                    if (info) {

                                        Channel.findOne({ _id: result._id }, async (err, channel) => {
                                            if (channel) {
                                                // console.log("update channel")
                                                // createChannelLog(channel, ticker, "update")
                                                
                                                resolve(channel)
                                            }
                                        });
                                    }
                                }
                            );
                        } else {
                            // console.log("reject channel")
                            
                        }
                        
                    }
                }
            )
           
        }catch (e) {
            reject(e);
        }
        
    })
}

/////////////////////////////////////////

function createChannelLog(channel, ticker, type) {
    return new Promise(async (resolve, reject) => {
        try {
            const newChannelLog = await new ChannelLog({
                createdAt: new Date(),
                metadata: {
                    type: type,
                    channelLink: channel.metadata.link,
                    channelName: channel.metadata.name,
                    channelId: channel._id,
                    symbol: ticker
                }
            }).save();

            if(newChannelLog) {
                resolve(newChannelLog)
            }
           
        }catch (e) {
            reject(e);
        }
        
    })
}

/////////////////////////////////////////

function createVideoLog(video, ticker, type) {
    return new Promise(async (resolve, reject) => {
        try {
            const newVideoLog = await new VideoLog({
                createdAt: new Date(),
                metadata: {
                    type: type,
                    symbol: ticker,
                    video: video
                }
            }).save();

            if(newVideoLog) {
                resolve(newVideoLog)
            }
           
        }catch (e) {
            reject(e);
        }
        
    })
}

function updateLast24Hours(ticker) {

    Video.find({
        "createdAt":{ $gt:new Date(Date.now() - 24*60*60 * 1000)},
        approvedFor: {
            $elemMatch: { symbol: { $eq: ticker.metadata.symbol} }
        }
    }, async(err, result) => {
        if(!result) {
            resolve()
        } else {
            Ticker.updateOne(
                {
                    "metadata.symbol": { $eq: ticker.metadata.symbol} 
                },
                {
                    $set: { last24hours: result.length }
                },
                async (err, info) => {
                    if (info) {
                        console.log("updated count 24",  ticker.metadata.symbol)
                    }
                }
            );
        }
    })
}




