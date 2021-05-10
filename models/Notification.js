const mongoose = require("mongoose");
const { Schema } = mongoose;

const notificationSchema = new Schema({
    createdAt: { type: Date, default: Date.now },
    user: {},
    type: String,
    link: String,
    relatedContentType: String,
    relatedContentId: String
});

notificationSchema.index({
});

mongoose.model("notifications", notificationSchema);
