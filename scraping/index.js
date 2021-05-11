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


/////////////////////////////////////////

// Initial start

function initialSetup() {
    return new Promise(async (resolve, reject) => {
        try {
            Scraping.findOne({}, async (err, scraping) => {
                if (scraping) {
                    // scraperStatus.active = scraping.scrapingSearchActive
                    scraperStatus.active = true // Change this later

                    if(scraperStatus.active) {

                        _.map(Tickers, async (record, i) => {
                            setTimeout(() => {

                            let finalSymbol = record.metadata.symbol

                            searchVideos(finalSymbol, record)

                            return console.log({
                                ticker: record.metadata.symbol,
                                count: Tickers.length
                            });
                            }, i*100)
                        })
                        // loadFirstTicker()

                        // const processFile = async () => {
                        //     records = []
                        //     const parser = fs
                        //     .createReadStream(`./tickers.json`)
                        //     .pipe(parse({
                        //         // CSV options if any
                        //     }));
                        //     // _.map(parser, async (record) => {
                        //     //    console.log(record)
                        //     // })
                        //     for await (const record of parser) {
                        //         // console.log(record)
                        //         // // Work with each record
                        //         // setTimeout(() => {
                        //         //     console.log(parser)
                        //         // }, i*record)
                        
                        //         // const ticker = await new Ticker({
                        //         //     createdAt: new Date(),
                        //         //     metadata: {
                        //         //         symbol: record[0],
                        //         //         name: record[1]
                        //         //     }
                        //         // }).save();
                        
                        //         records.push(record)
                        //     }
                        //     return records
                        // }
                        
                        // (async () => {
                        //     const records = await processFile()
                        //     //   console.info(records);
                        //       _.map(records, async (record, i) => {
                        //           setTimeout(() => {
                        //             console.log(record)

                        //             searchVideos(record[6], symbol[0])

                        //             return console.log({
                        //                 ticker: symbol[0].metadata.symbol,
                        //                 count: results[1]
                        //             });
                        //           }, i*1000)
                        //         })
                        //     })()
                        
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
                        // updateTickerVideoCount(ticker)

                        
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

                                // channelCheck(video)
                                
                                io.emit('videoUpdate',{
                                    status: "add",
                                    ticker: ticker,
                                    video: newVideo2
                                })
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

                            let approved = false

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
                                                    // updateTickerVideoCount(ticker)
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

                    searchVideos(finalSymbol, symbol[0])

                    if(scraperStatus.active) {
                        loadNextTicker()
                    }

                    return console.log({
                        ticker: symbol[0].metadata.symbol,
                        count: results[1]
                    });
                }, scraperStatus.delay)
                
            }

            
        }
    );
}

/////////////////////////////////////////

loadNextTicker = async (req, res) => {
    scraperStatus.currentTicker = scraperStatus.currentTicker + 1

    const query = Ticker.find()
            .sort({ "metadata.symbol": "1" })
            .skip(scraperStatus.currentTicker)
            .limit(1);
            
    return Promise.all(
        [query, Ticker.find().countDocuments()]
    ).then(
        results => {
            let symbol = results[0]

            if(symbol[0].metadata) {
                searchVideos(symbol[0].metadata.symbol, symbol[0])

                setTimeout(() => {
                    if(scraperStatus.currentTicker < results[1] -1) {
                        if(scraperStatus.active) {
                            loadNextTicker()
                        }
                    } else{
                        scraperStatus.currentTicker = 0
                        setTimeout(() => {
                            if(scraperStatus.active) {
                                loadFirstTicker()
                            }
                        }, scraperStatus.delay)
                    }

                    return console.log({
                        ticker: symbol[0].metadata.symbol,
                        count: results[1]
                    });
                }, scraperStatus.delay)
            }
        }
    );
}

