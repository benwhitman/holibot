// AWS
var AWS = require('aws-sdk');
var Lex = new AWS.LexModelBuildingService({ region: 'us-east-1' });

// 3rd party
var async = require('async');
var _ = require('lodash');

/*
Create or replace an array of intents.
*/
exports.replaceAll = function (intents, callback) {
    // build an array of functions to firstly check each intent's existence and 
    // secondly create or replace the intent in AWS
    checkAndCreateFunctions = [];

    intents.forEach((intent) => {
        checkAndCreateFunctions.push(buildCheckIntentFunction(intent));
        checkAndCreateFunctions.push(buildCreateOrReplaceIntentFunction(intent));
    });

    // execute the functions in sequence
    async.waterfall(checkAndCreateFunctions, (err, result) => {
        if (err) {
            callback(err);
        } else {
            callback(null);
        }
    });
};

function buildCheckIntentFunction(intent) {
    return function (callback) {
        Lex.getIntent({ name: intent.name, version: '$LATEST' },
            function (err, existingIntent) {
                console.log(intent.name);
                if (/NotFoundException/.test(err)) {
                    console.log("intent not found - creating...");
                    callback(null, 'no-checksum');
                } else if (err) {
                    console.log("error getting intent");
                    callback(err);
                } else {
                    console.log("intent already exists - replacing...");
                    callback(null, existingIntent.checksum);
                }
            });
    };
}

function buildCreateOrReplaceIntentFunction(intent) {
    return function (checksum, callback) {

        // create a params object for putIntent. Checksum should only be specified if this is a replacement operation
        var params = Object.assign(intent, { checksum: checksum === 'no-checksum' ? null : checksum });

        Lex.putIntent(params,
            (err, result) => {
                if (err) {
                    callback(err);
                } else {
                    callback(null);
                }
            });
    };
}