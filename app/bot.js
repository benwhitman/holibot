// AWS
var AWS = require('aws-sdk');
var Lambda = new AWS.Lambda({ region: 'us-east-1' });
var Lex = new AWS.LexModelBuildingService({ region: 'us-east-1' });

// 3rd party
var async = require('async');
var fs = require('fs');

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

exports.createBot = function(intents, callback) {
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
        
    async.waterfall([
        buildCheckBotFunction(bot), 
        buildCreateOrReplaceBotFunction(bot)
    ], (err, result) => {
        if (err) {
            callback(err);
        } else {
            callback(null);
        }
    });
};

function buildCheckBotFunction(bot) {
    return function (callback) {
        Lex.getBot({ name: 'Holibot', versionOrAlias: '$LATEST' },
            function (err, existingBot) {
                if (/NotFoundException/.test(err)) {
                    console.log("bot not found - creating...");
                    callback(null, 'no-checksum');
                } else if (err) {
                    console.log("error getting bot");
                    callback(err);
                } else {
                    console.log("bot already exists - replacing with new version...");
                    callback(null, existingBot.checksum);
                }
            });
    };
}

function buildCreateOrReplaceBotFunction(bot) {
    return function (checksum, callback) {

        // create a params object for putBot. Checksum should only be specified if this is a replacement operation
        var params = Object.assign(bot, { checksum: checksum === 'no-checksum' ? null : checksum });

        Lex.putBot(params,
            (err, result) => {
                if (err) {
                    callback(err);
                } else {
                    callback(null);
                }
            });
    };
}