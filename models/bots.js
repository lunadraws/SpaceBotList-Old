const mongoose = require("mongoose");

const newbots = mongoose.Schema({
    botid: { type: String, default: "00000" },
    username: { type: String, default: "justabot" },
    owner: { type: String, default: "00000" },
    prefix: { type: String, default: "No prefix" },
    short: { type: String, default: "No short description" },
    long: { type: String, default: "No long description" },
    invite: { type: String, default: "No invite description" },
    votes: { type: Number, default: 0 },
    avatar: { type: String, default: "https://cdn.discordapp.com/attachments/831283997560274986/840699649223426148/startup3.png" },
    serverlink: { type: String, default: "https://discord.gg/WB4ZBRY3jV" },
    website: { type: String, default: "" },
    tags:  { type: String, default: "None" },
    status: { type: String, default: "pending" },
    library: { type: String, default: "None" },
    date: { type: Number, default: 000 },
    servers: { type: Number, default: 0 },
    shards: { type: Number, default: 0 },
    auth: { type: String, default: "None" },
    donate: { type: String, default: "" },
});

module.exports = mongoose.model("bots", newbots);
