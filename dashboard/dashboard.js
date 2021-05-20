// We import modules.
const url = require("url");
const path = require("path");
const ishtml = require('is-html');
const showdown = require('showdown');
const converter = new showdown.Converter();
converter.setOption('tables', 'true');
const url2 = require('is-url');
const express = require("express");
const passport = require("passport");
const session = require("express-session");
const Strategy = require("passport-discord").Strategy;
const config = require("../config.js")
const ejs = require("ejs");
const bodyParser = require("body-parser");
const Discord = require("discord.js");
const ERRORS = require("../models/errors")
const BOTS = require("../models/bots")
const USERS = require("../models/users")
const VOTES = require("../models/votes")
const ratelimit = new Set()
// We instantiate express app and the session store.
const app = express();
const MemoryStore = require("memorystore")(session);

// We export the dashboard as a function which we call in ready event.
module.exports = async (client) => {
  BOTS.find({}, async (err, bots) => {
    for (i = 0; i < bots.length; i++) { 
      await client.users.fetch(bots[i].botid).then(async bot => {
        if(bot.username !== bots[i].username){
          bots[i].username = bot.username
          await bots[i].save()
        }
      })
         } 
      })
  // We declare absolute paths.
  const dataDir = path.resolve(`${process.cwd()}${path.sep}dashboard`); // The absolute path of current this directory.
  const templateDir = path.resolve(`${dataDir}${path.sep}templates`); // Absolute path of ./templates directory.

  // Deserializing and serializing users without any additional logic.
  passport.serializeUser((user, done) => done(null, user));
  passport.deserializeUser((obj, done) => done(null, obj));

  // We set the passport to use a new discord strategy, we pass in client id, secret, callback url and the scopes.
  /** Scopes:
   *  - Identify: Avatar's url, username and discriminator.
   *  - Guilds: A list of partial guilds.
  */
  passport.use(new Strategy({
    clientID: config.id,
    clientSecret: config.clientSecret,
    callbackURL: `${config.domain}/callback`,
    scope: ["identify"]
  },
  (accessToken, refreshToken, profile, done) => { // eslint-disable-line no-unused-vars
    // On login we pass in profile with no logic.
    process.nextTick(() => done(null, profile));
  }));
  // We initialize the memorystore middleware with our express app.
  app.use(session({
    store: new MemoryStore({ checkPeriod: 86400000 }),
    secret: "#@%#&^$^$%@$^$&%#$%@#$%$^%&$%^#$%@#$%#E%#%@$FEErfgr3g#%GT%536c53cc6%5%tv%4y4hrgrggrgrgf4n",
    resave: false,
    saveUninitialized: false,
  }));

  // We initialize passport middleware.
  app.use(passport.initialize());
  app.use(passport.session());

  // We bind the domain.
  app.locals.domain = config.domain.split("//")[1];

  // We set out templating engine.
  app.engine("html", ejs.renderFile);
  app.set("view engine", "html");

  // We initialize body-parser middleware to be able to read forms.
  app.use(bodyParser.json());
  app.use(bodyParser.urlencoded({
    extended: true
  }));
  // We declare a renderTemplate function to make rendering of a template in a route as easy as possible.
  const renderTemplate = (res, req, template, data = {}) => {
    // Default base data which passed to the ejs template by default. 
    const baseData = {
      bot: client,
      path: req.path,
      user: req.isAuthenticated() ? req.user : null
    };
    // We render template using the absolute path of the template and the merged default data with the additional data provided.
    res.render(path.resolve(`${templateDir}${path.sep}${template}`), Object.assign(baseData, data));

  };
  // We declare a checkAuth function middleware to check if an user is logged in or not, and if not redirect him.
  const checkAuth = (req, res, next) => {
    // If authenticated we forward the request further in the route.
    if (req.isAuthenticated()) return next();
    // If not authenticated, we set the url the user is redirected to into the memory.
    req.session.backURL = req.url;
    // We redirect user to login endpoint/route.
    res.redirect("/login");
  }

  // Login endpoint.
  app.get("/login", (req, res, next) => {
    // We determine the returning url.
    if (req.session.backURL) {
      req.session.backURL = req.session.backURL; // eslint-disable-line no-self-assign
    } else if (req.headers.referer) {
      const parsed = url.parse(req.headers.referer);
      if (parsed.hostname === app.locals.domain) {
        req.session.backURL = parsed.path;
      }
    } else {
      req.session.backURL = "/";
    }
    // Forward the request to the passport middleware.
    next();
  },
  passport.authenticate("discord"));

  // Callback endpoint.
  app.get("/callback", passport.authenticate("discord", { failureRedirect: "/" }), /* We authenticate the user, if user canceled we redirect him to index. */ (req, res) => {
    // If user had set a returning url, we redirect him there, otherwise we redirect him to index.
    if (req.session.backURL) {
      const url = req.session.backURL;
      req.session.backURL = null;
      res.redirect(url);
    } else {
      res.redirect("/");
    }
  });

  // Logout endpoint.
  app.get("/logout", function (req, res) {
    // We destroy the session.
    req.session.destroy(() => {
      // We logout the user.
      req.logout();
      // We redirect user to index.
      res.redirect("/");
    });
  });

  // Index endpoint.
  app.get("/docs", async (req, res) => {
    renderTemplate(res, req, "docs.ejs");
  })
   app.get("/upload", async (req, res) => {
    renderTemplate(res, req, "upload.ejs");
  })
  app.get("/helpus", async (req, res) => {
    renderTemplate(res, req, "helpus.ejs");
  })
  app.post("/api/v1/bot/:botid", async (req, res) => {
    let auth = req.headers.authorization;
    if (!auth) return res.json("[SBL] (404): Authorization header not found."); 
    let servers = req.body.server_count
    if(!servers) return res.json("[SBL] (404): Can't find server_count."); 
    servers = parseInt(servers);
    if (!servers) return res.json("[SBL] (400): server_count not integer.");
    BOTS.findOne({botid: req.params.botid}, (err, bot2) => {
      if(!bot2) return res.json("[SBL] (404): Bot not found!");
      if(!bot2.auth) return res.json("[SBL (404): Go generate auth token for your bot!");
    if(bot2.auth !== auth){
     return res.json("[SBL] (400): Incorrect authorization token.");
    }else{
      BOTS.findOne({botid: req.params.botid}, async (err, bot) => {
        if(!bot) return res.json("[SBL] (404): Bot not found.");
        bot.servers = servers
        if(req.body.shard_count){
        if(!parseInt(req.body.shard_count)) return res.json("[SBL] (400): shard_count not integer.");
        bot.shards = req.body.shard_count;
        }else{
          bot.shards = 0;
        }
        if(ratelimit.has(req.params.botid + "stats")) return res.json("[SBL] (429): Your are being ratelimited, 1 request per 5 mins.");
        await bot.save()
        await ratelimit.add(req.params.botid + "stats")
        setTimeout(async () => {
          await ratelimit.delete(req.params.botid + "stats")
        }, 300000)
        await res.json(`[SBL] (200): Your Stats Has Been Posted.`);
      })
    }
  })
  });
  app.get("/", async (req, res) => {
    const botlist = await BOTS.find({status: "approved"}, { _id: false, auth: false }).sort([['votes','descending']])
    botlist.filter(bot => bot)
    const botlist2 = await BOTS.find({status: "approved"}, { _id: false, auth: false }).sort([['date','descending']])
    botlist2.filter(bot => bot)
     for (i = 0; i < botlist.length; i++) { 
      await client.users.fetch(botlist[i].botid) 
         } 
    for (i = 0; i < botlist2.length; i++) { 
      await client.users.fetch(botlist2[i].botid) 
        } 
    renderTemplate(res, req, "index.ejs", {bots2: botlist2, bots: botlist ,alert: null, error: null});
  });
  app.post("/", async (req, res) => {
    if(req.body.searchbutton){
      return res.redirect("/search=" + req.body.search)
    }
  });
  app.get("/search=:value", async (req, res) => {
    await BOTS.find({}, async (err, bots) => {
      for (i = 0; i < bots.length; i++) { 
        await client.users.fetch(bots[i].botid).then(async bot => {
          if(bot.username !== bots[i].username){
            bots[i].username = bot.username
            await bots[i].save()
          }
        })
           } 
        })
    let bots = await BOTS.find({status: "approved"}).sort([[req.params.value, "descending"]])
    for (i = 0; i < bots.length; i++) { 
      await client.users.fetch(bots[i].botid) 
         } 
      bots = bots.filter(bot => {
          if (bot.username.toLowerCase().includes(req.params.value)) return true;
          else if(bot.username.toUpperCase().includes(req.params.value)) return true;
          else if(bot.username.includes(req.params.value)) return true;
          else if (bot.tags.toLowerCase().includes(req.params.value)) return true;
          else if(bot.tags.toUpperCase().includes(req.params.value)) return true;
          else if(bot.tags.includes(req.params.value)) return true;
          else return false;
      });
    renderTemplate(res, req, "search.ejs", {bots: bots, alert: null, error: null});
  });
  app.get("/tos", async (req, res) => {
    renderTemplate(res, req, "tos.ejs");
  })
   app.get("/privacy", async (req, res) => {
    renderTemplate(res, req, "privacy.ejs");
  })
  app.get("/error", async (req, res) => {
    renderTemplate(res, req, "error.ejs", {alert: null, error: null});
  });
  app.get("/add", checkAuth, async (req, res) => {
    renderTemplate(res, req, "add.ejs", {alert: null, error: null});
  });
  app.get("/panel", checkAuth, async (req, res) => {
    if(!config.owners.includes(req.user.id)){
      return res.redirect("/")
    }else{
      const penbotlist = await BOTS.find({status: "pending"}, { _id: false, auth: false }).sort([['descending']])
      penbotlist.filter(bot => bot)
      for (i = 0; i < penbotlist.length; i++) { 
        await client.users.fetch(penbotlist[i].botid) 
          }    
         const bugres = await ERRORS.find({}, { _id: false, auth: false })
          bugres.filter(bug => bug)
      renderTemplate(res, req, "panel.ejs", {bots: penbotlist, alert: null, error: null, reportbug: bugres});
    }
  });
  app.post("/panel", checkAuth, async (req, res) => {
   let bugres = await ERRORS.find({}, { _id: false, auth: false })
      bugres.filter(bug => bug)
    if(!config.owners.includes(req.user.id)){
      return res.redirect("/")
    }else{
      let penbotlist = await BOTS.find({status: "pending"}, { _id: false, auth: false }).sort([['descending']])
      penbotlist.filter(bot => bot)
      for (i = 0; i < penbotlist.length; i++) { 
        await client.users.fetch(penbotlist[i].botid) 
          } 
     if(req.body.checkingdelete){
      BOTS.findOne({botid: req.body.clientid}, async (err, bot3) => {
       if(!bot3){
        return renderTemplate(res, req, "panel.ejs", {reportbug: bugres, bots: penbotlist, alert: null, error: "That bot not exists in our database"});
       }else{
         client.guilds.cache.get(config.guildid).channels.cache.get(config.botlogs).send(`<@${req.body.clientid}> has been deleted by <@${req.user.id}> (<@${bot3.owner}>)\nReason: **${req.body.deletereason}**`)
         let thebot2 = client.guilds.cache.get(config.guildid).members.cache.get(req.body.clientid);
         thebot2.kick().catch(() => {})
         BOTS.find({
          owner: bot3.owner,
          status: "approved"}, (err, bot4) => {
            if(bot4.length <= 1){
             let theowner = client.guilds.cache.get(config.guildid).members.cache.get(bot3.owner);
             let role3 = client.guilds.cache.get(config.guildid).roles.cache.get(config.verifieddevs);
             theowner.roles.remove(role3)
            }
        })
        bot3.status = "denied";
        bot3.date = Date.now()
        await bot3.save()
        penbotlist = await BOTS.find({status: "pending"}, { _id: false, auth: false }).sort([['descending']])
        penbotlist.filter(bot => bot)
        for (i = 0; i < penbotlist.length; i++) { 
          await client.users.fetch(penbotlist[i].botid) 
            } 
        return renderTemplate(res, req, "panel.ejs", {reportbug: bugres, bots: penbotlist, alert: "Successfully the bot has been deleted!", error: null});
       }
      })
     }
      if(req.body.reject){
        if(!client.guilds.cache.get(config.guildid).members.cache.get(req.body.reject)){
          return renderTemplate(res, req, "panel.ejs", {reportbug: bugres, bots: penbotlist, alert: null, error: "Bot is not at server!"});
        }
        BOTS.findOne({botid: req.body.reject}, async (err, bot) => {
          if(!bot){
            return renderTemplate(res, req, "panel.ejs", {reportbug: bugres, bots: penbotlist, alert: null, error: "Error occured while rejecting bot!"});
          }else{
            if(bot.status == "denied") return renderTemplate(res, req, "panel.ejs", {reportbug: bugres, bots: penbotlist, alert: null, error: "Someone already rejected the bot faster than you!"});
            client.guilds.cache.get(config.guildid).channels.cache.get(config.botlogs).send(`<@${req.body.reject}> has been denied by <@${req.user.id}> (<@${bot.owner}>)\nReason: **${req.body.reason}**`)
            let thebot = client.guilds.cache.get(config.guildid).members.cache.get(req.body.reject);
            thebot.kick().catch(() => {})
            bot.status = "denied";
            bot.date = Date.now()
            await bot.save()
            penbotlist = await BOTS.find({status: "pending"}, { _id: false, auth: false }).sort([['descending']])
            penbotlist.filter(bot => bot)
            for (i = 0; i < penbotlist.length; i++) { 
              await client.users.fetch(penbotlist[i].botid) 
                } 
            return renderTemplate(res, req, "panel.ejs", {reportbug: bugres, bots: penbotlist, alert: "Success the bot has been denied!", error: null});
          }
        })
      }
      if(req.body.accept){
        if(!client.guilds.cache.get(config.guildid).members.cache.get(req.body.accept)){
          return renderTemplate(res, req, "panel.ejs", {reportbug: bugres, bots: penbotlist, alert: null, error: "Bot is not at server!"});
        }
        BOTS.findOne({botid: req.body.accept}, async (err, bot) => {
          if(!bot){
            return renderTemplate(res, req, "panel.ejs", {reportbug: bugres, bots: penbotlist, alert: null, error: "Error occured while rejecting bot!"});
          }else{
            if(!client.guilds.cache.get(config.guildid).members.cache.get(bot.owner)){
              client.guilds.cache.get(config.guildid).channels.cache.get(config.botlogs).send(`<@${req.body.accept}> has been denied by <@${req.user.id}> (<@${bot.owner}>)\nReason: **Bot owner not in server!**`)
              let thebot = client.guilds.cache.get(config.guildid).members.cache.get(req.body.accept);
             let guild = client.guilds.cache.get(config.guildid)
             let kicked = guild.member(thebot)
             kicked.kick().catch(() => {})
              BOTS.findOne({botid: req.body.accept}, async (err, bot2) => {
                if(bot2){
                  bot2.status = "denied";
                  bot2.date = Date.now()
                  await bot2.save()
                }
              })
              penbotlist = await BOTS.find({status: "pending"}, { _id: false, auth: false }).sort([['descending']])
              penbotlist.filter(bot => bot)
              return renderTemplate(res, req, "panel.ejs", {reportbug: bugres, bots: penbotlist, alert: null, error: "Bot owner is not at server!, bot got auto rejected"});
            }
           if(bot.status == "approved") return renderTemplate(res, req, "panel.ejs", {reportbug: bugres, bots: penbotlist, alert: null, error: "Someone already approved the bot faster than you!"});
            client.guilds.cache.get(config.guildid).channels.cache.get(config.botlogs).send(`<@${req.body.accept}> has been accepted by <@${req.user.id}> (<@${bot.owner}>)\nFeedBack: **${req.body.reason}**`)
            bot.status = "approved"
            bot.date = Date.now()
            await bot.save()
            for (i = 0; i < penbotlist.length; i++) { 
              await client.users.fetch(penbotlist[i].botid) 
                } 
            let thebot = client.guilds.cache.get(config.guildid).members.cache.get(req.body.accept);
            let theowner = client.guilds.cache.get(config.guildid).members.cache.get(bot.owner);
            let role = client.guilds.cache.get(config.guildid).roles.cache.get(config.verifiedbots);
            let role2 = client.guilds.cache.get(config.guildid).roles.cache.get(config.pendingbots);
            let role3 = client.guilds.cache.get(config.guildid).roles.cache.get(config.verifieddevs);
            thebot.roles.add(role)
            thebot.roles.remove(role2)
            theowner.roles.add(role3)
            penbotlist = await BOTS.find({status: "pending"}, { _id: false, auth: false }).sort([['descending']])
            penbotlist.filter(bot => bot)
            return renderTemplate(res, req, "panel.ejs", {reportbug: bugres, bots: penbotlist, alert: "Success the bot has accepted!", error: null});
          }
        })
      }
      let alertmsg = "";
      let errormsg = "";
if(req.body.acceptbug){
        ERRORS.findOneAndDelete({userID: req.body.acceptbug}, async (err, bug) => {
  if(!bug){
  errormsg = `Error occured while accepting bug !`
  bugres = await ERRORS.find({}, { _id: false, auth: false })
    bugres.filter(bug => bug)
  return renderTemplate(res, req, "panel.ejs", {reportbug: bugres, bots: penbotlist, alert: alertmsg, error: errormsg});
  }else{
  alertmsg = `Success accepted the bug (which means fixed)!`
  bugres = await ERRORS.find({}, { _id: false, auth: false })
    bugres.filter(bug => bug)
  return renderTemplate(res, req, "panel.ejs", {reportbug: bugres, bots: penbotlist, alert: alertmsg, error: errormsg});
  }
        })
 
      }
    }
  });
  app.post("/add", checkAuth, async (req, res) => {
    let errormsg = "";
    let alertmsg = "";
    let guild = client.guilds.cache.get(config.guildid)
    if(!guild.members.cache.get(req.user.id)){
      errormsg = "You are not in our server!"
      return renderTemplate(res, req, "add.ejs", {alert: alertmsg, error: errormsg});
    }
    if(req.body.shortdesc.length > 50){
      errormsg = "Short Description: Short description can't be more than 50 charactars"
      return renderTemplate(res, req, "add.ejs", {alert: alertmsg, error: errormsg});
    }else if(req.body.shortdesc.length < 10){
      errormsg = "Short Description: Short description can't be less than 10 charactars"
      return renderTemplate(res, req, "add.ejs", {alert: alertmsg, error: errormsg});
    }
  if(req.body.longdesc.length < 100){
      errormsg = "Long Description: Long description can't be less than 100 charactars"
      return renderTemplate(res, req, "add.ejs", {alert: alertmsg, error: errormsg});
  }
  if(req.body.prefix.length > 20){
    errormsg = "Prefix: prefix can't be more than 20 charactars"
    return renderTemplate(res, req, "add.ejs", {alert: alertmsg, error: errormsg});
}
if(ishtml(req.body.longdesc)){
  errormsg = "Long Description: HTML is not supported at long description!"
  return renderTemplate(res, req, "add.ejs", {alert: alertmsg, error: errormsg});
}
if(ishtml(req.body.shortdesc)){
  errormsg = "Short Description: HTML is not supported at short description!"
  return renderTemplate(res, req, "add.ejs", {alert: alertmsg, error: errormsg});
}
BOTS.findOne({botid: req.body.clientid}, (err, bot) => {
  if(bot){
    errormsg = "The bot is already exists!"
    return renderTemplate(res, req, "add.ejs", {alert: alertmsg, error: errormsg});
  }else{
    client.users.fetch(req.body.clientid).then(async newbot => {
      if(!newbot.bot) return renderTemplate(res, req, "add.ejs", {alert: alertmsg, error: "You can't add human as bots!"});
        let avatar = "https://maxcdn.icons8.com/Share/icon/Logos/discord_logo1600.png";
        if(newbot.avatar){
          avatar = `https://cdn.discordapp.com/avatars/${req.body.clientid}/${newbot.avatar}.png?size=256`;
        }
        let text = req.body.tags
        let tags2 = "";
        if(Array.isArray(text) == true){
          tags2 = text.join(", ")
          if(text.length > 4) return renderTemplate(res, req, "add.ejs", {alert: null, error: "Tags : Max tags is 4"});
        }else{
          tags2 = text
        }
        await new BOTS({
          botid: req.body.clientid,
          owner: req.user.id,
          prefix: req.body.prefix,
          short: req.body.shortdesc,
          long: req.body.longdesc,
          invite: req.body.botinvite || `https://discord.com/oauth2/authorize?client_id=${req.body.clientid}&permissions=0&scope=bot`,
          votes: 0,
          avatar: avatar,
          status: "pending",
          serverlink: req.body.serverinvite || "https://discord.gg/WB4ZBRY3jV",
          website: req.body.website || "",
          donate: req.body.donateurl || "",
          tags: tags2,
          library: req.body.library || "None",
          date: Date.now(),
          servers: 0,
          shards: 0,
          auth: Math.random().toString(36).replace(/[^a-z]+/g, '').substr(0, 15) + Math.ceil(Math.random() * 52520) + Math.random().toString(36).replace(/[^a-z]+/g, '').substr(0, 15) + Math.ceil(Math.random() * 52520) + Math.random().toString(36).replace(/[^a-z]+/g, '').substr(0, 15)
        }).save()
        client.guilds.cache.get(config.guildid).channels.cache.get(config.botlogs).send(`<@${req.user.id}> added <@${req.body.clientid}> for verification ( <@&841365206621224990> | <@&827934477559791656>)\n<${config.domain}/bots/${req.body.clientid}>`)
        client.guilds.cache.get("844429404909862933").channels.cache.get("844430145732608021").send(`<@${req.user.id}> added <@${req.body.clientid}> for verification ( <@&841365206621224990> | <@&827934477559791656>)\n<${config.domain}/bots/${req.body.clientid}>`)
        alertmsg = "Your bot application has been sent, be patient while reviewing!"
        return renderTemplate(res, req, "add.ejs", {alert: alertmsg, error: errormsg});
    }).catch(() => {
      errormsg = "An error occured, try check bot id."
      return renderTemplate(res, req, "add.ejs", {alert: alertmsg, error: errormsg});
    })
  }
  })
  });
  app.get("/bug", (req, res) => {
    renderTemplate(res, req, "bug.ejs", {alert: null, error: null});
  });
  app.post("/bug", checkAuth, async (req, res) => {
    // We validate the request, check if guild exists, member is in guild and if member has minimum permissions, if not, we redirect it back.
    let alertmsg = "";
    let errormsg = "";
    if(ratelimit.has(req.user.id + "bug")){
      errormsg = "Ratelimited, come back after 1 min"
}else{
    // We retrive the settings stored for this guild.
    if(req.body.reportbug.length > 500){
      errormsg = "Max characters exceeded! (500 char)"
    }else if(req.body.reportbug.length < 25){
      errormsg = "Brief report in more than 25 char"
    }else{
      ratelimit.add(req.user.id + "bug")
        const newbug = new ERRORS({
        userID: req.user.id,
        bug: req.body.reportbug
      });
      newbug.save().catch(()=>{});
      alertmsg = "Your report has been submited and will be reviewed!"
      setTimeout(() => {
        ratelimit.delete(req.user.id + "bug")
    }, 60000);
  }
    }
    renderTemplate(res, req, "bug.ejs", { alert: `${alertmsg}`, error: `${errormsg}` });
  });
  // Dashboard endpoint.
  app.get("/bots/:botid/resubmit", checkAuth, async (req, res) => {
    BOTS.findOne({
      botid: req.params.botid,
      status: "denied"
    }, async (err, bot) => {
    if(!bot) return res.redirect("/error")
    if(bot.owner !== req.user.id) return res.redirect("/error")
    const botlist = await BOTS.findOne({botid: req.params.botid}, { _id: false, auth: false })
    renderTemplate(res, req, "resubmit.ejs", {bots: botlist ,alert: null, error: null});
             });
             
     });
     app.post("/bots/:botid/resubmit", checkAuth, async (req, res) => {
      BOTS.findOne({
        botid: req.params.botid,
        status: "denied"
      }, async (err, bot) => {
          if(!bot){
            res.redirect("/error")
          }else{
          if(bot.owner !== req.user.id) return res.redirect("/error")
          let botlist = await BOTS.findOne({botid: req.params.botid}, { _id: false, auth: false })
          if(req.body.shortdesc.length > 50){
            errormsg = "Short Description: Short description can't be more than 50 charactars"
            return renderTemplate(res, req, "editbot.ejs", {bots: botlist ,alert: alertmsg, error: errormsg});
          }else if(req.body.shortdesc.length < 10){
            return renderTemplate(res, req, "resubmit.ejs", {bots: botlist ,alert: null, error: "Short Description: Short description can't be less than 10 charactars"});
          }
        if(req.body.longdesc.length < 100){
            return renderTemplate(res, req, "resubmit.ejs", {bots: botlist ,alert: null, error: "Long Description: Long description can't be less than 100 charactars"});
        }
        if(req.body.prefix.length > 20){
          return renderTemplate(res, req, "resubmit.ejs", {bots: botlist ,alert: null, error: "Prefix: prefix can't be more than 20 charactars"});
      }
      if(ishtml(req.body.longdesc)){
        return renderTemplate(res, req, "resubmit.ejs", {bots: botlist ,alert: null, error: "Long Description: HTML is not supported at long description!"});
      }
      if(ishtml(req.body.shortdesc)){
        return renderTemplate(res, req, "resubmit.ejs", {bots: botlist ,alert: null, error: "Short Description: HTML is not supported at short description!"});
      }
      let text = req.body.tags
      let tags2 = "";
      if(Array.isArray(text) == true){
        tags2 = text.join(", ")
        if(text.length > 4) return renderTemplate(res, req, "resubmit.ejs", {bots: botlist ,alert: null, error: "Tags : Max tags is 4"});
      }else{
        tags2 = text
      }
          bot.prefix = req.body.prefix || "No prefix";
          bot.library = req.body.library || "No librarys";
          bot.tags = tags2;
          bot.serverinvite = req.body.serverinvite || "https://discord.gg/WB4ZBRY3jV";
          bot.website = req.body.website || "";
          bot.donate = req.body.donateurl || "",
          bot.invite = req.body.botinvite || `https://discord.com/oauth2/authorize?client_id=${req.body.clientid}&permissions=0&scope=bot`;
          bot.short = req.body.shortdesc || "No short description";
          bot.long = req.body.longdesc || "No long description";
          bot.status = "pending";
          bot.date = Date.now()
          await bot.save()
          botlist = await BOTS.findOne({botid: req.params.botid}, { _id: false, auth: false })
          client.guilds.cache.get(config.guildid).channels.cache.get(config.botlogs).send(`<@${req.user.id}> resubmited <@${req.body.clientid}>\n<${config.domain}/bots/${req.body.clientid}>`)
          await renderTemplate(res, req, "resubmit.ejs", {bots: botlist ,alert: "Success your bot is waiting at pending bots queue!", error: null})
          }
        });
    });
  app.get("/bots/:botid", async (req, res) => {
    BOTS.findOne({
      botid: req.params.botid,
    }, async (err, bot) => {
        if(!bot) return res.redirect("/error")
        if(bot.status == "denied") return res.redirect("/error")
         const botlist = await BOTS.findOne({botid: req.params.botid}, { _id: false, auth: false })
    var desc = ``;
    let isUrl = url2(bot.long.replace("\n", "").replace(" ", ""))
    if (isUrl) {
        desc = `<iframe src="${bot.long.replace("\n", "").replace(" ", "")}" width="600" height="400" style="width: 100%; height: 100vh; color: black;"><object data="${bot.long.replace("\n", "").replace(" ", "")}" width="600" height="400" style="width: 100%; height: 100vh; color: black;"><embed src="${bot.long.replace("\n", "").replace(" ", "")}" width="600" height="400" style="width: 100%; height: 100vh; color: black;"> </embed>${bot.long.replace("\n", "").replace(" ", "")}</object></iframe>`
    } else if (bot.long) desc = converter.makeHtml(bot.long);
    else desc = bot.long;
      await client.users.fetch(botlist.botid) 
      await client.users.fetch(botlist.owner)
         renderTemplate(res, req, "botpage.ejs", {desc: desc,isURL: isUrl, bots: botlist ,alert: null, error: null, token: null});
             });
             
     });
  app.post("/bots/:botid", async (req, res) => {
    let botlist = await BOTS.findOne({botid: req.params.botid}, { _id: false, auth: false })
BOTS.findOne({
  botid: req.params.botid,
}, async (err, bot) => {
    if(!bot) return res.redirect("/error")
    if(bot.status == "denied") return res.redirect("/error")
    var desc = ``;
    let isUrl = url2(bot.long.replace("\n", "").replace(" ", ""))
    if (isUrl) {
        desc = `<iframe src="${bot.long.replace("\n", "").replace(" ", "")}" width="600" height="400" style="width: 100%; height: 100vh; color: black;"><object data="${bot.long.replace("\n", "").replace(" ", "")}" width="600" height="400" style="width: 100%; height: 100vh; color: black;"><embed src="${bot.long.replace("\n", "").replace(" ", "")}" width="600" height="400" style="width: 100%; height: 100vh; color: black;"> </embed>${bot.long.replace("\n", "").replace(" ", "")}</object></iframe>`
    } else if (bot.long) desc = converter.makeHtml(bot.long);
    else desc = bot.long;
    if(req.body.vote){
      if(!req.user){
       return res.redirect("/login")
      }else{
      VOTES.findOne({
        user: req.user.id,
        clientid: req.params.botid}, async (err, bot2) => {
          if(!bot2){
            client.guilds.cache.get(config.guildid).channels.cache.get(config.votelogs).send(`<@${req.user.id}> has voted for <@${req.params.botid}>\n<${config.domain}/bots/${req.params.botid}>`)
            bot.votes = bot.votes- + -1;
            bot.save()
            await new VOTES({
              user: req.user.id,
              clientid: req.params.botid
            }).save()
            botlist = await BOTS.findOne({botid: req.params.botid}, { _id: false, auth: false })
            await client.users.fetch(botlist.botid) 
            await client.users.fetch(botlist.owner)
            return renderTemplate(res, req, "botpage.ejs", {desc: desc,isURL: isUrl, bots: botlist ,alert: "Successfully your vote has been recorded!", error: null});
          }else{
            botlist = await BOTS.findOne({botid: req.params.botid}, { _id: false, auth: false })
              await client.users.fetch(botlist.botid) 
              await client.users.fetch(botlist.owner)
            return renderTemplate(res, req, "botpage.ejs", {desc: desc,isURL: isUrl, bots: botlist ,alert: null, error: "You already voted for that bot!"});
          }
      })
    }
    }
    if(req.body.token){
      if(!req.user) return res.redirect("/login")
      if(bot.owner !== req.user.id) return renderTemplate(res, req, "botpage.ejs", {desc: desc,isURL: isUrl, bots: botlist ,alert: null, error: null});
     return renderTemplate(res, req, "botpage.ejs", {desc: desc,isURL: isUrl, bots: botlist ,alert: `Authorization Token: ${bot.auth}`, error: null});
    }
    if(req.body.newtoken){
      if(!req.user) return res.redirect("/login")
      if(bot.owner !== req.user.id) return renderTemplate(res, req, "botpage.ejs", {desc: desc,isURL: isUrl, bots: botlist ,alert: null, error: null});
     bot.auth = Math.random().toString(36).replace(/[^a-z]+/g, '').substr(0, 15) + Math.ceil(Math.random() * 52520) + Math.random().toString(36).replace(/[^a-z]+/g, '').substr(0, 15) + Math.ceil(Math.random() * 52520) + Math.random().toString(36).replace(/[^a-z]+/g, '').substr(0, 15)
     await bot.save()
     botlist = await BOTS.findOne({botid: req.params.botid}, { _id: false, auth: false })
     return renderTemplate(res, req, "botpage.ejs", {desc: desc,isURL: isUrl, bots: botlist ,alert: `New Authorization Token: ${bot.auth}`, error: null});
    }
    if(req.body.permdelete){
      if(!req.user) return res.redirect("/login")
      if(bot.owner !== req.user.id) return renderTemplate(res, req, "botpage.ejs", {desc: desc,isURL: isUrl, bots: botlist ,alert: null, error: null});
       await BOTS.findOne({botid: req.params.botid}, async (err, bot2) => {
       await bot2.deleteOne()
       client.guilds.cache.get(config.guildid).channels.cache.get(config.botlogs).send(`<@${req.params.botid}> has been deleted by (<@${bot2.owner}>)\nReason: **Owner requested to delete it.**`)
       if(client.guilds.cache.get(config.guildid).members.cache.get(req.params.botid)){
         let thebot = client.guilds.cache.get(config.guildid).members.cache.get(req.params.botid);
            thebot.kick().catch(() => {})
       }
       BOTS.find({
         owner: bot.owner,
         status: "approved"}, (err, bot3) => {
           if(bot3.length <= 1){
            let theowner = client.guilds.cache.get(config.guildid).members.cache.get(bot.owner);
            let role3 = client.guilds.cache.get(config.guildid).roles.cache.get(config.verifieddevs);
            theowner.roles.remove(role3).catch(() => {})
           }
       })
       const botlist = await BOTS.find({status: "approved"}, { _id: false, auth: false }).sort([['votes','descending']])
       botlist.filter(bot => bot)
       const botlist2 = await BOTS.find({status: "approved"}, { _id: false, auth: false }).sort([['date','descending']])
       botlist2.filter(bot => bot)
        for (i = 0; i < botlist.length; i++) { 
         await client.users.fetch(botlist[i].botid) 
            } 
       for (i = 0; i < botlist2.length; i++) { 
         await client.users.fetch(botlist2[i].botid) 
           } 

       return renderTemplate(res, req, "index.ejs", {bots2: botlist2, bots: botlist ,alert: "Your bot has been deleted.", error: null});
     })
    }
         });
  });
  app.get("/bots/:botid/edit", checkAuth, async (req, res) => {
    BOTS.findOne({
      botid: req.params.botid,
    }, async (err, bot) => {
        if(!bot) {
         return res.redirect("/error")
        }else{
          if(bot.status == "denied") return res.redirect("/error")
        if(bot.owner !== req.user.id) return res.redirect("/")
         let botlist = await BOTS.findOne({botid: req.params.botid}, { _id: false, auth: false })
          botlist = await BOTS.findOne({botid: req.params.botid}, { _id: false, auth: false })
         renderTemplate(res, req, "editbot.ejs", {bots: botlist ,alert: null, error: null})
        }
        });
     });
  app.post("/bots/:botid/edit", checkAuth, async (req, res) => {
    BOTS.findOne({
      botid: req.params.botid,
    }, async (err, bot) => {
        if(!bot){
          res.redirect("/error")
        }else{
        if(bot.owner !== req.user.id) return res.redirect("/")
        let botlist = await BOTS.findOne({botid: req.params.botid}, { _id: false, auth: false })
        if(req.body.shortdesc.length > 50){
          errormsg = "Short Description: Short description can't be more than 50 charactars"
          return renderTemplate(res, req, "editbot.ejs", {bots: botlist ,alert: alertmsg, error: errormsg});
        }else if(req.body.shortdesc.length < 10){
          return renderTemplate(res, req, "editbot.ejs", {bots: botlist ,alert: null, error: "Short Description: Short description can't be less than 10 charactars"});
        }
      if(req.body.longdesc.length < 100){
          return renderTemplate(res, req, "editbot.ejs", {bots: botlist ,alert: null, error: "Long Description: Long description can't be less than 100 charactars"});
      }
      if(req.body.prefix.length > 20){
        return renderTemplate(res, req, "editbot.ejs", {bots: botlist ,alert: null, error: "Prefix: prefix can't be more than 20 charactars"});
    }
    if(ishtml(req.body.longdesc)){
      return renderTemplate(res, req, "editbot.ejs", {bots: botlist ,alert: null, error: "Long Description: HTML is not supported at long description!"});
    }
    if(ishtml(req.body.shortdesc)){
      return renderTemplate(res, req, "editbot.ejs", {bots: botlist ,alert: null, error: "Short Description: HTML is not supported at short description!"});
    }
    let text = req.body.tags
    let tags2 = "";
    if(Array.isArray(text) == true){
      tags2 = text.join(", ") 
     if(text.length > 4) return renderTemplate(res, req, "editbot.ejs", {bots: botlist ,alert: null, error: "Tags : Max tags is 4"});
    }else{
      tags2 = text
    }
        bot.prefix = req.body.prefix || "No prefix";
        bot.library = req.body.library || "No librarys";
        bot.tags = tags2;
        bot.serverinvite = req.body.serverinvite || "https://discord.gg/WB4ZBRY3jV";
        bot.website = req.body.website || "#";
        bot.donate = req.body.donateurl || "#",
        bot.invite = req.body.botinvite || `https://discord.com/oauth2/authorize?client_id=${req.body.clientid}&permissions=0&scope=bot`;
        bot.short = req.body.shortdesc || "No short description";
        bot.long = req.body.longdesc || "No long description";
        await bot.save()
        botlist = await BOTS.findOne({botid: req.params.botid}, { _id: false, auth: false })
        client.guilds.cache.get(config.guildid).channels.cache.get(config.botlogs).send(`<@${req.user.id}> edited <@${req.body.clientid}>\n<${config.domain}/bots/${req.body.clientid}>`)
        await renderTemplate(res, req, "editbot.ejs", {bots: botlist ,alert: "Success your bot edits has been updated!", error: null})
        }
      });
  });
  app.get("/bots", async (req, res) => {
      const botlist = await BOTS.find({status: "approved"}, { _id: false, auth: false }).sort([['votes','descending']])
      botlist.filter(bot => bot)
      for (i = 0; i < botlist.length; i++) { 
        await client.users.fetch(botlist[i].botid) 
          } 
      renderTemplate(res, req, "bots.ejs", {bots: botlist ,alert: null, error: null});
           });
  app.post("/bots", async (req, res) => {
    if(req.body.searchbutton){
      return res.redirect("/search=" + req.body.search)
    }
      const botlist = await BOTS.find({status: "approved"}, { _id: false, auth: false }).sort([['votes','descending']])
      botlist.filter(bot => bot)
      for (i = 0; i < botlist.length; i++) { 
        await client.users.fetch(botlist[i].botid) 
          } 
      renderTemplate(res, req, "bots.ejs", {bots: botlist ,alert: null, error: null});
             });
  app.get("/profile", checkAuth, async (req, res) => {
              let users = await USERS.findOne({userID: req.user.id})
              USERS.findOne({userID: req.user.id}, (err, res) =>{
          if(!res){
            new USERS({
              userID: req.user.id,
              bio: "Iam a very mysterious person!"
            }).save()
          }
              })
              let userbots = await BOTS.find({owner: req.user.id})
              for (i = 0; i < userbots.length; i++) { 
                await client.users.fetch(userbots[i].botid) 
                  } 
              renderTemplate(res, req, "profile.ejs", {bots: userbots, profile: users, alert: null, error: null});
            });
  app.post("/profile", checkAuth, async (req, res) => {
              let userbots = await BOTS.find({owner: req.user.id})
              let users = await USERS.findOne({userID: req.user.id})
              let alertmsg = "";
              let errormsg = "";
              USERS.findOne({userID: req.user.id}, async (err, res) =>{
                if(!res){
                  await new USERS({
                    userID: req.user.id,
                    bio: req.body.changebio || "Iam a very mysterious person!"
                  }).save()
                }
                    })
              
              if(req.body.changebio){
                if(req.body.changebio.length > 50){
                  errormsg = "Max length for bio is 50 characters!"
                  return renderTemplate(res, req, "profile.ejs", {bots: userbots, profile: users, alert: alertmsg, error: errormsg});
                }else if(req.body.changebio.length < 10){
                  errormsg = "Bio can't be less than 10 characters!"
                  return renderTemplate(res, req, "profile.ejs", {bots: userbots, profile: users, alert: alertmsg, error: errormsg});
                }else{
                  if(users){
                  users.bio = req.body.changebio
                  await users.save()
                  alertmsg = "Your bio has been updated successfully!"
                  users = await USERS.findOne({userID: req.user.id})
                  return renderTemplate(res, req, "profile.ejs", {bots: userbots, profile: users, alert: alertmsg, error: errormsg});
                  }else{
                    users = await USERS.findOne({userID: req.user.id})
                    for (i = 0; i < userbots.length; i++) { 
                      await client.users.fetch(userbots[i].botid) 
                        } 
                    alertmsg = "Your bio has been updated successfully!"
                    return renderTemplate(res, req, "profile.ejs", {bots: userbots, profile: users, alert: alertmsg, error: errormsg});
                  }
                }
              }
          
              if(req.body.captcha == "delete"){
                if(req.body.requestdelete){
                      if(!users){
                        errormsg = "You don't have data in our site!"
                        return renderTemplate(res, req, "profile.ejs", {bots: userbots, profile: users, alert: alertmsg, error: errormsg});
                    }else{
                      await USERS.findOneAndDelete({userID: req.user.id})
                      await BOTS.find({owner: req.user.id}, (err, res) => {
                        res.forEach(bot => {
                          bot.deleteOne()
                        })
                      })
                      userbots = await BOTS.find({owner: req.user.id})
                      for (i = 0; i < userbots.length; i++) { 
                        await client.users.fetch(userbots[i].botid) 
                          } 
                      alertmsg = "Your data has been deleted!"
                      users = await USERS.findOne({userID: req.user.id})
                      return await renderTemplate(res, req, "profile.ejs", {bots: userbots, profile: users, alert: alertmsg, error: errormsg});
                    }
                }
              }else{
            errormsg = "You didn't complete captcha!"
            return renderTemplate(res, req, "profile.ejs", {bots: userbots, profile: users, alert: alertmsg, error: errormsg});
              }
            
              renderTemplate(res, req, "profile.ejs", {bots: userbots, profile: users, alert: alertmsg, error: errormsg});
            });
app.listen(config.port, null, null, () => console.log(`Dashboard is ready at ${config.port}.`));
};
