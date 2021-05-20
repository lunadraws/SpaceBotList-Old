const mongoose = require("mongoose");

const newerrors = mongoose.Schema({
    userID: String,
    bug:String,
})

module.exports = mongoose.model("botlistbugreports", newerrors);