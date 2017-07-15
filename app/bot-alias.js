// AWS
var AWS = require('aws-sdk');
var Lambda = new AWS.Lambda({ region: 'us-east-1' });
var Lex = new AWS.LexModelBuildingService({ region: 'us-east-1' });

// 3rd party
var async = require('async');
var fs = require('fs');

exports.createBotAlias = function(callback) {
    console.log("Creating bot alias 'prod'");
        
    async.waterfall([
        buildCheckBotAliasFunction('prod'), 
        buildCreateOrReplaceBotAliasFunction('prod')
    ], (err, result) => {
        if (err) {
            callback(err);
        } else {
            callback(null);
        }
    });
};

function buildCheckBotAliasFunction(botAlias) {
    return function (callback) {
        Lex.getBotAlias({ name: botAlias, botName: 'Holibot' },
            function (err, existingBotAlias) {
                if (/NotFoundException/.test(err)) {
                    console.log("bot alias not found - creating...");
                    callback(null, 'no-checksum');
                } else if (err) {
                    console.log("error getting bot alias");
                    callback(err);
                } else {
                    console.log("bot alias already exists - replacing with new version...");
                    
                    callback(null, existingBotAlias.checksum);
                }
            });
    };
}

function buildCreateOrReplaceBotAliasFunction(botAlias) {
    return function (checksum, callback) {

        // create a params object for putBotAlias. Checksum should only be specified if this is a replacement operation
        var params = { 
            name: botAlias, 
            botName: 'Holibot', 
            botVersion: '$LATEST',
            checksum: checksum === 'no-checksum' ? null : checksum 
        };

        Lex.putBotAlias(params,
            (err, result) => {
                if (err) {
                    callback(err);
                } else {
                    callback(null);
                }
            });
    };
}