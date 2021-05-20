const mongoose = require("mongoose");

const newusers = mongoose.Schema({
    userID: String,
    bio:String,
})

module.exports = mongoose.model("users", newusers);