const mongoose = require("mongoose");
const { Schema } = mongoose;

const postSchema = new Schema({
    createdAt: { type: Date, default: Date.now },
    content: String,
    user: {},
    linkedTickers: [],
    linkedUsers: [],
    sentiment: String,
    deleted: { type: Boolean, default: false},
    linkedImages: []
});

postSchema.index({
});

mongoose.model("posts", postSchema);
