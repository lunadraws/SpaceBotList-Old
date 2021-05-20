const mongoose = require("mongoose");

const newusers = mongoose.Schema({
    user: String,
    clientid: String,
})

module.exports = mongoose.model("check", newusers);