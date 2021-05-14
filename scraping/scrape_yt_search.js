const axios = require("axios")
const request = require('request-promise');
const keys = require("./../config/keys");

const { getStreamData, getPlaylistData, getVideoData } = require('./parse_yt_search');
const mongoose = require("mongoose");

const ProxyLog = mongoose.model("proxylogs");

function getURL(query, options, fullTicker) {
    const url = new URL('/results', 'https://www.youtube.com');
    let sp = [(options.type || 'video')];
    let keyword = ""

    if(fullTicker.type == "regular") {
        keyword = " stock"
    }

    if(fullTicker.type == "crypto") {
        keyword = " crypto"
    }

    url.search = new URLSearchParams({
        search_query: query + keyword
    }).toString();

    if (options.sp) sp = options.sp;

    return url.href + '&sp=' + sp;
}

function extractRenderData(page, proxy, query) {
    return new Promise((resolve, reject) => {
        try {
            // #1 - Remove line breaks
            page = page.split('\n').join('');
            // #2 - Split at start of data
            page = page.split('var ytInitialData')[1];
            // #3 - Remove the first equals sign
            const spot = page.split('=');
            spot.shift();
            // #4 - Join the split data and split again at the closing tag
            const data = spot.join('=').split(';</script>')[0];

            let render = null;
            let contents = [];
            let primary = {}
            if(JSON.parse(data).contents) {
                primary = JSON.parse(data).contents
                .twoColumnSearchResultsRenderer
                .primaryContents;
            }
            


            // The renderer we want. This should contain all search result information
            if (primary['sectionListRenderer']) {

                // Filter only the search results, exclude ads and promoted content
                render = primary.sectionListRenderer.contents.filter((item) => {
                    if(!item.itemSectionRenderer) {
                        // console.log("problem " + query + " " + proxy)
                    }
                    
                    return (
                        item.itemSectionRenderer &&
                        item.itemSectionRenderer.contents &&
                        item.itemSectionRenderer.contents.filter((c) => c['videoRenderer'] || c['playlistRenderer']).length
                    );
                }).shift();
                if(render && render.itemSectionRenderer) {
                    contents = render.itemSectionRenderer.contents;
                } else {
                    content = {}
                }
            }

            // YouTube occasionally switches to a rich grid renderer.
            // More testing will be needed to see how different this is from sectionListRenderer
            if (primary['richGridRenderer']) {
                contents = primary.richGridRenderer.contents.filter((item) => {
                    return item.richItemRenderer && item.richItemRenderer.content;
                }).map((item) => item.richItemRenderer.content);
            }

            resolve(contents);
        } catch (e) {
            reject(e);
        }
    });
}

function parseData(data)  {
    return new Promise((resolve, reject) => {
        try {
            const results = {
                videos: [],
                playlists: [],
                streams: []
            };

            data.forEach((item) => {
                if (item['videoRenderer'] && item['videoRenderer']['lengthText']) {
                    try {
                        const result = getVideoData(item['videoRenderer']);
                        results.videos.push(result);
                    } catch (e) {
                        // console.log(e)
                    }
                }

                if (item['videoRenderer'] && !item['videoRenderer']['lengthText']) {
                    try {
                        const result = getStreamData(item['videoRenderer']);
                        results.streams.push(result);
                    } catch (e) {
                        // console.log(e)
                    }
                }

                if (item['playlistRenderer']) {
                    try {
                        const result = getPlaylistData(item['playlistRenderer']);
                        results.playlists.push(result);
                    } catch (e) {
                        // console.log(e);
                    }
                }
            });

            resolve(results);
        } catch (e) {
            // console.warn(e);
            reject('Fatal error when parsing result data. Please report this on GitHub');
        }
    });
}

/**
     * Load the page and scrape the data
     * @param query Search query
     * @param options Search options
     */
function load(query, options, proxy, fullTicker) {
    const url = getURL(query, options, fullTicker);

    return new Promise((resolve, reject) => {
        request({
            url: proxy + "get",
            timeout: "15000",
            method: 'POST',
            body: {
                url: url
            },
            json: true
        })
        .then((response) => {resolve(response)})
        .catch((err) => {
            console.log(err)
            if(err.statusCode == 429) {
                // console.log("banned " + proxy)
                createProxyLog(proxy, query, "banned")
            } else {
                console.log(err)
                createProxyLog(proxy, query, "error")
            }
        })
    });

}


exports.search = function(query, options, proxy, fullTicker) {
    return new Promise(async (resolve, reject) => {
        try {
            options = { ...options};
            const page = await load(query, options, proxy, fullTicker);
            const data = await extractRenderData(page, proxy, query);
            const results = await parseData(data);

            resolve(results);
        } catch (e) {
            reject(e);
        }
    });
}

function createProxyLog(proxy, ticker, type) {
    return new Promise(async (resolve, reject) => {
        try {
            const newProxyLog = await new ProxyLog({
                createdAt: new Date(),
                metadata: {
                    type: type,
                    proxy: proxy,
                    symbol: ticker
                }
            }).save();

            if(newProxyLog) {
                resolve(newProxyLog)
            }
        }catch (e) {
            reject(e);
        }
        
    })
}

requestVideoPage = async (channelURL, proxy) => {
    try {
        return await axios.post(proxy + "get", {
            url: channelURL
        })
    } catch (e) {
        return {
            error: true,
            message: e
        }
    }
}


scrape_subscriber_count_from_channel = async (channelURL, proxy) =>{
    const html_data = await requestVideoPage(channelURL, proxy);
    const count = await parse_html(html_data.data);
    return count
}

function parse_html(page){

    return new Promise((resolve, reject) => {
        try {
            const results = {
                videos: [],
                playlists: [],
                streams: []
            };

            // #1 - Remove line breaks
            page = page.split('\n').join('');
            // // #2 - Split at start of data
            page = page.split('var ytInitialData')[1];

            // // #3 - Remove the first equals sign
            const spot = page.split('=');
            spot.shift();
            // // #4 - Join the split data and split again at the closing tag
            const data = spot.join('=').split(';</script>')[0];


            let render = null;
            let count = 0
            let subscriberString = JSON.parse(data).header.c4TabbedHeaderRenderer.subscriberCountText.accessibility.accessibilityData.label
            const stringSequences = subscriberString.split(" ")
            if (stringSequences[0].charAt(stringSequences[0].length-1) === 'K') {
                count = Number(stringSequences[0].substring(0, stringSequences[0].length-1)) * 1000
            } else if (stringSequences[1] === 'million') {
                count = Number(stringSequences[0].substring(0, stringSequences[0].length-1)) * 1000000
            } else {
                count = Number(stringSequences[0].substring(0, stringSequences[0].length))
            }

            resolve(count);
        } catch (e) {
            // console.warn(e);
            reject();
        }
    });
}


exports.getChannelSubscriptions = function(channel, proxy) {
    return new Promise(async (resolve, reject) => {
        try {
            const count = await scrape_subscriber_count_from_channel(channel, proxy);
            resolve(count);
        } catch (e) {
            reject(e);
        }
    });
}