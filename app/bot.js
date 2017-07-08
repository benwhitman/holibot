// AWS
var AWS = require('aws-sdk');
var Lambda = new AWS.Lambda({ region: 'us-east-1' });
var Lex = new AWS.LexModelBuildingService({ region: 'us-east-1' });

// Other
var fs = require('fs');

/*
Delete an existing Holibot if it exists
*/
exports.deleteBot = function(refreshIntentsOnly, callback) {
    if (!refreshIntentsOnly) {
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
    } else {
        console.log("Skipping deletion of previous bot as --refresh-intents-only was specified.");
        callback(null);
    }
};

/*
Create the bot
*/
exports.createBot = function (refreshIntentsOnly, intents, callback) {
    if (!refreshIntentsOnly) {
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
    } else {
        console.log("Skipping bot creation as --refresh-intents-only was specified");
        callback(null);
    }
};