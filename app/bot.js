// AWS
var AWS = require('aws-sdk');
var Lambda = new AWS.Lambda({ region: 'us-east-1' });
var Lex = new AWS.LexModelBuildingService({ region: 'us-east-1' });

// Other
var fs = require('fs');

// backoffs
const MAX_BACKOFFS = 4;
var deleteBotAliasBackOffs = 0;

/*
Delete an existing Holibot if it exists
*/
exports.deleteBot = function (callback) {

    console.log("Deleting previous Holibot if necessary");

    // delete existing bot and intents if they exist
    Lex.getBot({ name: "Holibot", versionOrAlias: "$LATEST" },
        (err, existingBot) => {
            if (existingBot) {
                console.log("Holibot already exists - deleting");
                Lex.deleteBot({ name: existingBot.name },
                    (err, data) => {
                        if (err) {
                            callback(err);
                        } else {
                            console.log("existing bot deleted");
                            callback(null);
                        }
                    });
            } else {
                callback(null);
            }
        });
};

/*
Create the bot
*/
exports.createBot = function (intents, callback) {

    console.log("Creating bot");
    // get the bot object, which starts out in the local ./lex-objects/bot.json file but needs
    // to be added to depending on which intents we are creating
    var bot = JSON.parse(fs.readFileSync('./lex-objects/bot.json', 'utf-8'));
    intents.forEach((intent) => {
        bot.intents.push({
            "intentVersion": "$LATEST",
            "intentName": intent.name
        });
    });
    Lex.putBot(bot, (err, data) => {
        if (err) {
            callback(err);
        } else {
            callback(null);
        }
    });
};

/*
Delete an existing 'prod' alias for Holibot if it exists.

Because AWS operations are asynchronous, we may need to wait before this works so this incorporates
a back-off system
*/
exports.deleteBotAliasWithBackOff = function (callback) {
    setTimeout(() => {
        console.log("Deleting previous Holibot prod alias if necessary");
        Lex.deleteBotAlias({ name: 'prod', botName: 'Holibot' },
            (err, bot) => {
                if (err && !/NotFoundException/.test(err)) {
                    console.log("Error deleting alias");
                    if (deleteBotAliasBackOffs < MAX_BACKOFFS) {
                        deleteBotAliasBackOffs ++;
                       
                        console.log("Back off " + deleteBotAliasBackOffs);
                        exports.deleteBotAliasWithBackOff(callback);
                    } else {
                        // maximum backoffs reached, quit
                        callback(err);
                    }
                } else {
                    // bot created, continue
                    callback(null);
                }
            });
    }, 2000 * deleteBotAliasBackOffs);
};

/*
Create the 'prod' alias for the bot
*/
exports.createBotAlias = function (callback) {
    console.log("Adding 'prod' alias for Holibot.");
    Lex.putBotAlias({
        name: 'prod',
        botName: 'Holibot',
        botVersion: '$LATEST'
    }, (err, data) => {
        if (err) {
            callback(err);
        } else {
            console.log("Bot alias 'prod' created.");
            callback(null);
        }
    });
};

/*
Keep checking for the existence of our bot and then call the supplied callback
*/
exports.waitForBotProvision = function (callback) {
    setTimeout(() => {
        var botCreated = Lex.getBot({
            name: 'Holibot',
            versionOrAlias: '$LATEST'
        }, (err, bot) => {
            console.log("Waiting for Holibot to be provisioned before creating the alias");

            if (err) {
                console.log(err);
                exports.waitForBotProvision(callback);
            } else {
                // bot created, continue
                callback(null);
            }
        });
    }, 2000);
};

exports.waitForBotBuild = function (callback) {
    setTimeout(() => {
        var botCreated = Lex.getBot({
            name: 'Holibot',
            versionOrAlias: '$LATEST'
        }, (err, bot) => {
            console.log("Waiting for Holibot to be built before creating the alias");

            if (err || bot.status === "READY") {
                console.log(err);
                exports.waitForBotBuild(callback);
            } else {
                // bot created, continue
                callback(null);
            }
        });
    }, 2000);
};