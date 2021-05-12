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

const parse = require('csv-parse');
const fs = require('fs');

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
    loadFirstTicker()
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
        // loadFirstTickerCount()

        _.map(Tickers, async (record, i) => {
            setTimeout(() => {

            updateTickerVideoCount(record)

            console.log({
                type: "update count",
                ticker: record.metadata.symbol,
            });
            }, i*500)
        })
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
    _.map(Tickers, async (record, i) => {
        setTimeout(() => {

            let finalSymbol = record.metadata.symbol

            searchVideos(finalSymbol, record)

            if(i+1 == record.length) {
                setTimeout(() => {
                    searchAll()
                }, 1000)
            }
           
            return console.log({
                ticker: record.metadata.symbol,
                count: Tickers.length
            });

        }, i*100)
    })
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
            io
        )
        .then(results => {
            // console.log(results)
            results.videos.map((result, i) => {
                return checkVideo(result, ticker, fullTicker)
            })
    }).catch((err) => console.log(err));
}

    

/////////////////////////////////////////

function matchTitle(video, ticker, fullTicker) {

    if(fullTicker.strictNameCheck) {
        if(fullTicker.altNames.length > 0) {
            let valid = false
    
            fullTicker.altNames.map((name) => {
                console.log(name)
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
                    console.log(name)
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
                        createVideoLog(video, ticker, "add")
                        updateTickerVideoCount(fullTicker)

                        
                        if(matchTitle(video, ticker, fullTicker)) {

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
                                ]
                            }).save();

                            if(newVideo) {

                               
                                resolve(video)
                            }
                        } else {
                            const newVideo2 = await new Video({
                                createdAt: new Date(),
                                linkedTickers: [
                                    {
                                        symbol: ticker
                                    }
                                ],
                                googleId: video.id,
                                metadata: video,
                            }).save();

                            if(newVideo2) {
                                resolve(video)
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


                                            Video.findOne({ _id: result._id }, async (err, result) => {
                                                if (result) {
                                                    console.log("update video")
                                                    updateTickerVideoCount(fullTicker)
                                                    createVideoLog(result, ticker, "update")
                                                    resolve(result)
                                                }
                                            });
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
                createChannelLog(newChannel, ticker, "add")
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
                                                createChannelLog(channel, ticker, "update")
                                                
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

/////////////////////////////////////////

function updateTickerVideoCount(ticker) {

    Video.find({
        "createdAt":{ $gt:new Date(Date.now() - 24*60*60 * 1000)},
        approvedFor: {
            $elemMatch: { symbol: { $eq: ticker.metadata.symbol} }
        }
    }, async(err, result) => {
        if(!result) {
            resolve()
        } else {
            Ticker.update(
                {
                    "metadata.symbol": { $eq: ticker.metadata.symbol} 
                },
                {
                    $set: { last24hours: result.length }
                },
                async (err, info) => {
                    if (info) {
                        // console.log("updated count 24")
                    }
                }
            );
        }
    })

    Video.find({
        "createdAt":{ $gt:new Date(Date.now() - 48*60*60 * 1000)},
        approvedFor: {
            $elemMatch: { symbol: { $eq: ticker.metadata.symbol} }
        }
    }, async(err, result) => {
        if(!result) {
            resolve()
        } else {
            Ticker.update(
                {
                    "metadata.symbol": { $eq: ticker.metadata.symbol} 
                },
                {
                    $set: { last48hours: result.length }
                },
                async (err, info) => {
                    if (info) {
                        // console.log("updated count 48")
                    }
                }
            );
        }
    })

    Video.find({
        "createdAt":{ $gt:new Date(Date.now() - 24*7*60*60 * 1000)},
        approvedFor: {
            $elemMatch: { symbol: { $eq: ticker.metadata.symbol} }
        }
    }, async(err, result) => {
        if(!result) {
            resolve()
        } else {
            Ticker.update(
                {
                    "metadata.symbol": { $eq: ticker.metadata.symbol} 
                },
                {
                    $set: { thisWeek: result.length }
                },
                async (err, info) => {
                    if (info) {
                        // console.log("updated count 48")
                    }
                }
            );
        }
    })

    Video.find({
        "createdAt":{ 
            $gt:new Date(Date.now() - 24*14*60*60 * 1000),
            $lt:new Date(Date.now() - 24*7*60*60 * 1000)
        },
        approvedFor: {
            $elemMatch: { symbol: { $eq: ticker.metadata.symbol} }
        }
    }, async(err, result) => {
        if(!result) {
            resolve()
        } else {
            Ticker.update(
                {
                    "metadata.symbol": { $eq: ticker.metadata.symbol} 
                },
                {
                    $set: { previousWeek: result.length }
                },
                async (err, info) => {
                    if (info) {
                        // console.log("updated count 48")
                    }
                }
            );
        }
    })

    let week = []

    Video.find({
        "createdAt":{ 
            $gt:new Date(Date.now() - 24*60*60 * 1000)
        },
        approvedFor: {
            $elemMatch: { symbol: { $eq: ticker.metadata.symbol} }
        }
    }, async(err, result) => {
        week.push(result.length)

        Video.find({
            "createdAt":{ 
                $gt:new Date(Date.now() - 24*2*60*60 * 1000),
                $lt:new Date(Date.now() - 24*60*60 * 1000)
            },
            approvedFor: {
                $elemMatch: { symbol: { $eq: ticker.metadata.symbol} }
            }
        }, async(err, result) => {
            week.push(result.length)

            Video.find({
                "createdAt":{ 
                    $gt:new Date(Date.now() - 24*3*60*60 * 1000),
                    $lt:new Date(Date.now() - 24*2*60*60 * 1000)
                },
                approvedFor: {
                    $elemMatch: { symbol: { $eq: ticker.metadata.symbol} }
                }
            }, async(err, result) => {
                week.push(result.length)

                Video.find({
                    "createdAt":{ 
                        $gt:new Date(Date.now() - 24*4*60*60 * 1000),
                        $lt:new Date(Date.now() - 24*3*60*60 * 1000)
                    },
                    approvedFor: {
                        $elemMatch: { symbol: { $eq: ticker.metadata.symbol} }
                    }
                }, async(err, result) => {
                    week.push(result.length)

                    Video.find({
                        "createdAt":{ 
                            $gt:new Date(Date.now() - 24*5*60*60 * 1000),
                            $lt:new Date(Date.now() - 24*4*60*60 * 1000)
                        },
                        approvedFor: {
                            $elemMatch: { symbol: { $eq: ticker.metadata.symbol} }
                        }
                    }, async(err, result) => {
                        week.push(result.length)

                        Video.find({
                            "createdAt":{ 
                                $gt:new Date(Date.now() - 24*6*60*60 * 1000),
                                $lt:new Date(Date.now() - 24*5*60*60 * 1000)
                            },
                            approvedFor: {
                                $elemMatch: { symbol: { $eq: ticker.metadata.symbol} }
                            }
                        }, async(err, result) => {
                            week.push(result.length)


                            Video.find({
                                "createdAt":{ 
                                    $gt:new Date(Date.now() - 24*7*60*60 * 1000),
                                    $lt:new Date(Date.now() - 24*6*60*60 * 1000)
                                },
                                approvedFor: {
                                    $elemMatch: { symbol: { $eq: ticker.metadata.symbol} }
                                }
                            }, async(err, result) => {
                                week.push(result.length)

                                // let growthRate24 = week[1] * 100 / week[0]
                                // let growthRate48 = (week[2] + week[3]) * 100 / (week[0] + week[1])
                                // let growthRate72 = (week[3] + week[4] + week[5]) * 100 / (week[0] + week[1] + week[2])

                                let growthRate24
                                let growthRate48
                                let growthRate72 

                                if(week[1] == 0) {
                                    growthRate24 = week[0] * 100
                                } else {
                                    growthRate24 = (week[0] * 100 / week[1]) - 100
                                }

                                if((week[2] + week[3]) == 0) {
                                    growthRate48 = (week[0] + week[1]) * 100
                                } else {
                                    growthRate48 = ((week[0] + week[1]) * 100 / (week[2] + week[3])) - 100
                                }

                                if((week[3] + week[4] + week[5]) == 0) {
                                    growthRate72 = (week[0] + week[1] + week[2]) * 100
                                } else {
                                    growthRate72 = ((week[0] + week[1] + week[2]) * 100 / (week[3] + week[4] + week[5])) - 100
                                }

                                // let growthRate24 = (week[0] * 100 / week[1]) - 100
                                // let growthRate48 = ((week[0] + week[1]) * 100 / (week[2] + week[3])) - 100
                                // let growthRate72 = ((week[0] + week[1] + week[2]) * 100 / (week[3] + week[4] + week[5])) - 100
                                let fullWeek = week[0] + week[1] + week[2] + week[3] + week[4] + week[5] + week[6]
                                let score = (fullWeek * 100 + week[0] * 250 + week[1] * 200 + growthRate24 * 175)/(100+250+200+175)


                                Ticker.updateOne(
                                    {
                                        "metadata.symbol": { $eq: ticker.metadata.symbol} 
                                    },
                                    {
                                        $set: { 
                                            week: week,
                                            growthRate24: growthRate24,
                                            growthRate48: growthRate48,
                                            growthRate72: growthRate72,
                                            score: score
                                        }
                                    },
                                    async (err, info) => {
                                        if (info) {
                                            // console.log("updated count 48")
                                        }
                                    }
                                );
                            })
                        })
                    })
                })
            })
        })
    })
}


