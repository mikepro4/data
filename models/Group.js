const mongoose = require("mongoose");
const { Schema } = mongoose;

const groupSchema = new Schema({
    createdAt: { type: Date, default: Date.now },
    active: { type: Boolean, default: true },
    metadata: {
        title: String,
    },
    tags: [
        {
            tagName: String
        }
    ],
    linkedTickers: [
        {
            symbol: String
        }
    ],
    last24hours: { type: Number, default: 0 },
    last48hours: { type: Number, default: 0 },
    lastWeek: { type: Number, default: 0 }
});

groupSchema.index({
});

mongoose.model("groups", groupSchema);
