// AWS
var AWS = require('aws-sdk');
var Lambda = new AWS.Lambda({ region: 'us-east-1' });
var Lex = new AWS.LexModelBuildingService({ region: 'us-east-1' });

// Other
var fs = require('fs');

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
                        console.log("existing bot deleted");
                        callback(null);
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
        callback(null);
    });
};

/*
Delete an existing 'prod' alias for Holibot if it exists
*/
exports.deleteBotAlias = function (callback) {
    console.log("Deleting previous Holibot prod alias if necessary");

    try {
        Lex.deleteBotAlias({ name: 'prod', botName: 'Holibot' }, () => {
            console.log("Bot alias deleted");
            callback(null);
        });
    }
    catch (error) {
        callback(err);
    }
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
        console.log("Bot alias 'prod' created.");
        callback(null);
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
                exports.waitForBotProvision(callback);
            } else {
                // bot created, continue
                callback(null);
            }
        });
    }, 2000);
};