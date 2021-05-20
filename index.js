const {Client , Collection} = require("discord.js")
const config = require("./config.js")
const client = new Client({
    disableEveryone: true,
    disabledEvents: ["TYPING_START"]
});

const token = process.env.TOKEN

client.commands = new Collection();
client.aliases = new Collection();
client.limits = new Map();
client.config = config;

const command = require("./structures/command");
command.run(client);

const events = require("./structures/event");
events.run(client)

client.login(process.env.TOKEN)