const mongoose = require("mongoose");
const { Schema } = mongoose;

const videoSchema = new Schema({
    createdAt: { type: Date, default: Date.now },
    linkedTickers: [
		{
			symbol: String
		}
	],
    googleId: String,
    metadata: {
        id: String,
        title: String,
        link: String,
        thumbnail: String,
        channel: {
            name: String,
            link: String,
            verified: Boolean,
            thumbnail: String
        },
        description: String,
        views: String,
        uploaded: String,
        duration: Number
    },
    approved: { type: Boolean, default: false},
    disabled: { type: Boolean, default: false}
});

videoSchema.index({
});

mongoose.model("videos", videoSchema);
