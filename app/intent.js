// AWS
var AWS = require('aws-sdk');
var Lex = new AWS.LexModelBuildingService({ region: 'us-east-1' });

// 3rd party
var async = require('async');
var _ = require('lodash');

/*
Create or replace an array of intents.
*/
exports.replaceAll = async function (intents, callback) {

    // get the current intents in AWS
    try {
        var existingIntents = await Lex.getIntents().promise();

        intents.forEach(async (intent) => {
            console.log("Looking for " + intent.name);

            var foundIntent = _.find(existingIntents.intents, (i) => i.name === intent.name);
            if (foundIntent) {
                // ok the intent exists, so get the checksum
                var existingIntent = await Lex.getIntent({ name: intent.name, version: '$LATEST' }).promise();

                console.log("Found " + intent.name + ", checksum: " + existingIntent.checksum);

                // replace the intent
                await Lex.putIntent(Object.assign(intent, { checksum: existingIntent.checksum })).promise();
                console.log(intent.name + " replaced.");
                return;
            } else {
                // create the intent
                await Lex.putIntent(intent).promise();
                console.log(intent.name + " created.");
                return;
            }
        });

        callback(null);
    }
    catch (error) {
        callback(error);
    }

};