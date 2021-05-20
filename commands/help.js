const { MessageEmbed } = require("discord.js")
module.exports.run = (client , message, args) => {
    let prefix = 's!'
    if(args[0] && client.commands.has(args[0])){
        const cmd = client.commands.get(args[0]);
        let cmdname = cmd.help.name.charAt(0).toUpperCase() + cmd.help.name.slice(1)
        let aliases = "No aliases for that command"
        if(cmd.help.aliases.length === 0){
            aliases = "No aliases for that command"
        }else{
            aliases = cmd.help.aliases.join("\n")
        }
        const embed = new MessageEmbed()
        .setAuthor(`${cmdname} command`)
        .setColor("GREEN")
        .setDescription(`**Prefix:** ${prefix}\n**Name:** ${cmd.help.name}\n**Description:** ${cmd.help.description}\n**Category:** ${cmd.help.category}`)
        .addField("Examples", cmd.help.example)
        .addField("Aliases", "``" + aliases + "``")
        .setFooter(`Syntax: <> = required, [] = optional`)
        return message.channel.send(embed)
    }
  const embed = new MessageEmbed()
  embed.setAuthor("SpaceBot help prompt", client.user.displayAvatarURL())
  embed.setThumbnail(message.guild.iconURL({ format: "gif" }))
  embed.setColor("BLUE")
  embed.addField(`Commands`,  client.commands.map(cmd => "``" + cmd.help.name + "``"))
  embed.setFooter("Requested by " + message.author.tag, message.author.displayAvatarURL() )
  message.channel.send(embed);
}

module.exports.help = {
    name: "help",
    category: "info",
    aliases: ['commands', 'cmds'],
    description: "Send you all commands!",
    example: "``help``\n``help <command_name>``"
}

module.exports.requirements = {
    userPerms: [],
    clientPerms: ["EMBED_LINKS"],
    ownerOnly: false
}

module.exports.limits = {
    rateLimit: 2,
    cooldown: 1e4
}