/**
 * Fetch all badges the channel has
 * @param video Video Renderer
 */

 const getChannelBadges = (video) => {
    const ownerBadges = video.ownerBadges;
    return ownerBadges ? ownerBadges.map((badge) => badge['metadataBadgeRenderer']['style']) : [];
};

/**
 * Attempt to find out if the channel is verified
 * @param video Video Renderer
 */
const isVerified = (video) => {
    const badges = getChannelBadges(video);
    return (
        badges.includes('BADGE_STYLE_TYPE_VERIFIED_ARTIST') ||
        badges.includes('BADGE_STYLE_TYPE_VERIFIED')
    );
};

/**
 * Attempt to fetch channel link
 * @param channel Channel Renderer
 */
const getChannelLink = (channel) => {
    return 'https://www.youtube.com' + (
        channel.navigationEndpoint.browseEndpoint.canonicalBaseUrl ||
        channel.navigationEndpoint.commandMetadata.webCommandMetadata.url
    );
};

/**
 * Compresses the "runs" texts into a single string.
 * @param key Video Renderer key
 */
const compress = (key) => {
    return (key && key['runs'] ? key['runs'].map((v) => v.text) : []).join('');
};

/**
 * Parse an hh:mm:ss timestamp into total seconds
 * @param text hh:mm:ss
 */
const parseDuration = (text)  => {
    const nums = text.split(':');
    let sum = 0;
    let multi = 1;

    while (nums.length > 0) {
        sum += multi * parseInt(nums.pop() || '-1', 10);
        multi *= 60;
    }

    return sum;
};


/**
 * Sometimes the upload date is not available. YouTube is to blame, not this package.
 * @param video Video Renderer
 */
const getUploadDate = (video) => {
    return video.publishedTimeText ? video.publishedTimeText.simpleText : '';
};

/**
 * Fetch the number of users watching a live stream
 * @param result Video Renderer
 */
const getWatchers = (result) => {
    try {
        return +(result.viewCountText.runs[0].text.replace(/[^0-9]/g, ''));
    } catch (e) {
        return 0;
    }
};

/**
 * Some paid movies do not have views
 * @param video Video Renderer
 */
const getViews = (video) => {
    try {
        return +(video.viewCountText.simpleText.replace(/[^0-9]/g, ''));
    } catch (e) {
        return 0;
    }
};

/**
 * Attempt to fetch the channel thumbnail
 * @param video Channel Renderer
 */
const getChannelThumbnail = (video) => {
    try {
        return video.channelThumbnailSupportedRenderers
            .channelThumbnailWithLinkRenderer
            .thumbnail
            .thumbnails[0].url;
    } catch (e) {
        // Return a default youtube avatar when the channel thumbnail is not available (in playlists)
        return `https://www.gstatic.com/youtube/img/originals/promo/ytr-logo-for-search_160x160.png`;
    }
};

const getVideoThumbnail = (id) => {
    return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
};

/**
 * Fetch a video or playlist link using the supplied ID
 * @param id ID
 * @param playlist is playlist true/false
 */
const getLink = (id, playlist = false) => {
    return (playlist ? 'https://www.youtube.com/playlist?list=' : 'https://youtu.be/') + id;
};

/**
 * Fetch basic information about the channel
 * @param video Video Renderer
 */
const getChannelData = (video) => {
    const channel = (video.ownerText || video.longBylineText)['runs'][0];
    return {
        name: channel.text,
        link: getChannelLink(channel),
        verified: isVerified(video),
        thumbnail: getChannelThumbnail(video)
    };
};

/**
 * Get the playlist thumbnail (the first video in the list)
 * @param result Playlist Renderer
 */
const getPlaylistThumbnail = (result) => {
    return getVideoThumbnail(result.navigationEndpoint.watchEndpoint.videoId);
};

/**
 * Similar to getResultData, but with minor changes for playlists
 * @param result Playlist Renderer
 */
const getPlaylistResultData = (result) => {
    const id = result.playlistId;

    return {
        id,
        title: result.title.simpleText,
        link: getLink(id, true),
        thumbnail: getPlaylistThumbnail(result),
        channel: getChannelData(result)
    };
};

/**
 * Fetch the default result data included in all result types
 * @param result Video Renderer
 */
const getResultData = (result) => {
    return {
        id: result.videoId,
        title: compress(result.title),
        link: getLink(result.videoId, false),
        thumbnail: getVideoThumbnail(result.videoId),
        channel: getChannelData(result)
    };
};

/**
 * Extract information about a video in a playlist
 * @param child Child Renderer
 */
const getPlaylistVideo = (child) => {
    return {
        id: child.videoId,
        title: child.title.simpleText,
        link: getLink(child.videoId),
        duration: parseDuration(child.lengthText.simpleText),
        thumbnail: getVideoThumbnail(child.videoId)
    };
};

/**
 * Extract all information required for the "Video" result type
 * @param result Video Renderer
 */
exports.getVideoData = (result) => {
    return {
        ...getResultData(result),
        description: compress(result.descriptionSnippet),
        views: getViews(result),
        uploaded: getUploadDate(result),
        duration: result.lengthText ? parseDuration(result.lengthText.simpleText) : 0
    };
};

/**
 * Extract all playlist information from the renderer
 * @param result Playlist Renderer
 */
exports.getPlaylistData = (result) => {
    const cvideos = [];

    // Loop through any visible child videos and extract the data
    result.videos.map((video) => {
        try {
            cvideos.push(getPlaylistVideo(video['childVideoRenderer']));
        } catch (e) { }
    });

    return {
        ...getPlaylistResultData(result),
        videoCount: +result['videoCount'],
        videos: cvideos
    };
};

exports.getStreamData = (result) => {
    return {
        ...getResultData(result),
        watching: getWatchers(result)
    };
};