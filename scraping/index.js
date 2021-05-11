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
                    console.log(symbol[0])
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
    
   
    // return video.title.includes(ticker) !== -1
    // return video.title.match(new RegExp(ticker))
    // return (new RegExp(video.title)).test(ticker)
    // var r = /^video.title$/;
    // return(r.test(ticker))
   
}

function matchChannel(video, ticker) {
    return video.channel.verified == true
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

                                // channelCheck(video)
                                
                                io.emit('videoUpdate',{
                                    status: "add",
                                    ticker: ticker,
                                    video: newVideo
                                })
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

                                                    // channelCheck(video)
                                                    io.emit('videoUpdate',{
                                                        status: "update",
                                                        ticker: ticker,
                                                        video: result
                                                    })
                                                    resolve(result)
                                                }
                                            });
                                        }
                                    }
                                );
                            }

                        } else {
                            // console.log("reject video")

                            // io.emit('videoUpdate', {
                            //     status: "reject",
                            //     ticker: ticker,
                            //     video: result
                            // })
                            
                        }
                    }
                }
            );


        } catch (e) {
            reject(e);
        }
        
    })
}

function channelCheck(video) {
    Channel.findOne(
        {
            "metadata.link": { $eq: video.channel.link }
        },
        async(err, result) => {
            if(!result) {
                resolve()
            } else {
                if(result.approved) {

                    Video.updateOne(
                        {
                            googleId: { $eq: video.id }
                        },
                        {
                            $set: { approved: true }
                        },
                        async (err, info) => {
                            if (info) {
                                console.log("approved because of channel")
                            }
                        }
                    );
                }
            }
        }
    )
}

// function fetchVideoSeries(ticker, days) {
//     return new Promise(async (resolve, reject) => {
//         try {
//             let videoSeries = []
//             var i;
//             for (i = 0; i < days; i++) {

//             }
//         }catch (e) {
//             reject(e);
//         }
//     })
// }


function updateTickerVideoCount(ticker) {
    return new Promise(async (resolve, reject) => {
        try {
            Ticker.findOne({ "metadata.symbol": { $eq: ticker} }, async (err, ticker) => {
                if (ticker) {
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
                                        resolve(info)
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
                                        resolve(info)
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
                                        resolve(info)
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
                                        resolve(info)
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


                                                Ticker.update(
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
                                                            resolve(info)
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

                    resolve(ticker)
                }
            });
        }catch (e) {
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
                io.emit('channelUpdate',{
                    status: "add channel",
                    channel: newChannel
                })
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
                                                io.emit('channelUpdate',{
                                                    status: "update",
                                                    ticker: ticker,
                                                    channel: channel
                                                })
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

/////////////////////////////////////////

loadFirstTickerCount = async (req, res) => {
    const query = Ticker.find()
            .sort({ "metadata.symbol": "1" })
            .skip(0)
            .limit(1);
            
    return Promise.all(
        [query, Ticker.find().countDocuments()]
    ).then(
        results => {
            let symbol = results[0]
            scraperStatus.currentTickerCount = 0
            tickerCount = results[1]

            let finalSymbol = symbol[0].metadata.symbol


            if(symbol[0] && symbol[0].metadata) {
                setTimeout(() => {

                    // updateTickerVideoCount(finalSymbol)
                    loadNextTickerCount()
                }, scraperStatus.delay)
                
            }

            
        }
    );
}

/////////////////////////////////////////

loadNextTickerCount = async (req, res) => {
    scraperStatus.currentTickerCount = scraperStatus.currentTickerCount + 1

    const query = Ticker.find()
            .sort({ "metadata.symbol": "1" })
            .skip(scraperStatus.currentTickerCount)
            .limit(1);
            
    return Promise.all(
        [query, Ticker.find().countDocuments()]
    ).then(
        results => {
            let symbol = results[0]

            if(symbol[0].metadata) {
                // updateTickerVideoCount(symbol[0].metadata.symbol)

                setTimeout(() => {
                    if(scraperStatus.currentTickerCount < results[1] -1) {
                        loadNextTickerCount()
                    } else{
                        scraperStatus.currentTickerCount = 0
                    }
                }, scraperStatus.delay)
            }
        }
    );
}


var job = new CronJob(
    // '0/30 * * * * *',
    '0 * * * *',
    function() {
        console.log("run cron count")
        // loadFirstTickerCount()
    },
    null,
    true,
    'America/Los_Angeles'
);

job.start()