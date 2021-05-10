const mongoose = require("mongoose");
const { Schema } = mongoose;

const wallSchema = new Schema({
    createdAt: { type: Date, default: Date.now },
    userId: String,
    contentType: String,
    contentId: String,
    context: String,
    symbol: String
});

wallSchema.index({
    "owner": "text"
});

mongoose.model("walls", wallSchema);
