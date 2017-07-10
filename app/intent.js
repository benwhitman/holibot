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
        var promises = [];
        intents.forEach((intent) => {
            console.log("Looking for " + intent.name);

            var foundIntent = _.find(existingIntents.intents, (i) => i.name === intent.name);
            if (foundIntent) {
                promises.push(new Promise((resolve, reject) => {
                    // ok the intent exists, so get the checksum
                    Lex.getIntent({ name: intent.name, version: '$LATEST' },
                        (err, existingIntent) => {

                            console.log("Found " + intent.name + ", checksum: " + existingIntent.checksum);

                            // replace the intent
                            Lex.putIntent(Object.assign(intent, { checksum: existingIntent.checksum }),
                                (err, result) => {
                                    if (err) {
                                        return reject(err);
                                    } else {
                                        console.log(intent.name + " replaced.");
                                        return resolve();
                                    }
                                });
                        });
                })
                );
            } else {
                // create the intent
                promises.push(Lex.putIntent(intent).promise());
                console.log(intent.name + " created.");
            }
        });

        Promise.all(promises)
            .then(() => {
                callback(null);
            })
            .catch((err) => {
                callback(err);
            });
    }
    catch (error) {
        callback(error);
    }
};