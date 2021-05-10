const mongoose = require("mongoose");
const { Schema } = mongoose;

const videoLogSchema = new Schema({
    createdAt: { type: Date, default: Date.now },
    metadata: {}
});

videoLogSchema.index({
});

mongoose.model("videologs", videoLogSchema);
