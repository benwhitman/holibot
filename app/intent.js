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
    var approveIntent = intents[0];
    checkAndCreateFunctions = [];
    
    intents.forEach((intent) => { 
        checkAndCreateFunctions.push(buildCheckIntentFunction(intent));
        checkAndCreateFunctions.push(buildCreateOrReplaceIntentFunction(intent));
    });

    async.waterfall(checkAndCreateFunctions, (err, result) => {
        if (err) {
            callback(err);
        } else {
            callback(null);
        }
    });

    function buildCheckIntentFunction(intent) {
        return function (callback) {
            Lex.getIntent({ name: intent.name, version: '$LATEST' },
                function (err, existingIntent) {
                    if (/NotFoundException/.test(err)) {
                        console.log("intent not found");
                        callback(null, 'no-checksum');
                    } else if (err) {
                        console.log("error getting intent");
                        callback(err);
                    } else {
                        console.log("existing intent found");
                        callback(null, existingIntent.checksum);
                    }
                });
        }
    }
}

function buildCreateOrReplaceIntentFunction(intent) {
    return function (checksum, callback) {

        // create a params object for putIntent. Checksum should only be specified if this is a replacement operation
        var params = Object.assign(intent, { checksum: checksum === 'no-checksum' ? null : checksum });

        // console.log("params: " + JSON.stringify(params));
        Lex.putIntent(params,
            (err, result) => {
                //console.log(err, result);
                if (err) {
                    callback(err);
                } else {
                    callback(null);
                }
            });
    };

}