const mongoose = require("mongoose");
const { Schema } = mongoose;

const proxyLogSchema = new Schema({
    createdAt: { type: Date, default: Date.now },
    metadata: {}
});

proxyLogSchema.index({
});

mongoose.model("proxylogs", proxyLogSchema);
