const mongoose = require("mongoose");
const { Schema } = mongoose;

const scrapingSchema = new Schema({
    scrapingSearchActive:  {type: Boolean, default: true},
    delayNextTicker: {type: Number, default: 1000},
    delayStartOver: {type: Number, default: 10000},
    cycleStart: Number,
    cycleEnd: Number,
    cycleDuration: Number,
    scrapingPaused: Boolean,
    scrapingPausedTicker: {}
});


mongoose.model("scraping", scrapingSchema);
