const mongoose = require("mongoose");
const { Schema } = mongoose;

const connectionSchema = new Schema({
    createdAt: { type: Date, default: Date.now },
    object: {},
    subject: {}
});

connectionSchema.index({
});

mongoose.model("connections", connectionSchema);
