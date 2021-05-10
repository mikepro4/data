const mongoose = require("mongoose");
const { Schema } = mongoose;

const channelLogSchema = new Schema({
    createdAt: { type: Date, default: Date.now },
    metadata: {}
});

channelLogSchema.index({
});

mongoose.model("channellogs", channelLogSchema);
