const { readdirSync } = require("fs")
const { join } = require("path")
const filePath2 = join(__dirname, "..", "events");
const Dashboard = require("../dashboard/dashboard")
const eventFiles2 = readdirSync(filePath2);
const mongoose = require("mongoose")



module.exports = (client) => {
   console.log(`Signed in as ${client.user.username} || Loaded [${eventFiles2.length}] event(s) & [${client.commands.size}] command(s)`);
   Dashboard(client);
   mongoose.connect(mongofb, {
    useNewUrlParser: true,
    useUnifiedTopology: true},(err) => {
    if (err) return console.error(err);
    console.log("MONGODB IS CONNECTED")
    })
}
