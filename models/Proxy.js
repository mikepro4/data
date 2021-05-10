const mongoose = require("mongoose");
const { Schema } = mongoose;

const proxySchema = new Schema({
    createdAt: { type: Date, default: Date.now },
    metadata: {
        ip: String,
        source: String
    },
    banned: { type: Boolean, default: false },
    working: { type: Boolean, default: true }
});

proxySchema.index({
	"metadata.ip": "text",
});

mongoose.model("proxies", proxySchema);
