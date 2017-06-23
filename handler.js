"use strict";

// import other functions
var Timetastic = require('./timetastic');
var request = require('request');

var endpoint = process.env.TimeTasticEndpoint;

// create a base request used by all calls to the TimeTastic api.
var baseRequest = request.defaults({
    headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + process.env.TimeTasticToken
    }
});

function close(sessionAttributes, fulfillmentState, message, responseCard) {
    return {
        sessionAttributes: sessionAttributes,
        dialogAction: {
            type: 'Close',
            fulfillmentState: fulfillmentState,
            message: message,
            responseCard: responseCard
        }
    };
}

// -------------------- intents ----------------------- //
function checkMyHolidays(intentRequest, slackUser, callback) {
    const outputSessionAttributes = intentRequest.sessionAttributes || {};

    Timetastic.resolveUserId(slackUser)
        .then((userId) => {
            console.log("TT user id: " + userId);

            var slots = {
                startDate: intentRequest.currentIntent.slots.StartDate,
                endDate: intentRequest.currentIntent.slots.EndDate
            };

            Timetastic.getHolidaysForUser(userId, slots, callback, close, outputSessionAttributes);
        });
}

function requestTimeOff(intentRequest, slackUser, callback) {
    const outputSessionAttributes = intentRequest.sessionAttributes || {};

    Timetastic.resolveUserId(slackUser)
        .then((userId) => {
            console.log("TT user id: " + userId);

            var slots = {
                startDate: intentRequest.currentIntent.slots.StartDate,
                endDate: intentRequest.currentIntent.slots.EndDate
            };

            Timetastic.bookHoliday(userId, slots, callback, close, outputSessionAttributes);
        });
}

function handleIntent(intentRequest, callback) {
    console.log(`handleIntent userId=${intentRequest.userId}, intent=${intentRequest.currentIntent.name}`);
    console.log("intent: " + JSON.stringify(intentRequest));

    // extract the Slack user id from the used id in the AWS Lex intentRequest
    var slackUser = intentRequest.userId.split(":")[2];

    switch (intentRequest.currentIntent.name) {
        case 'RequestTimeOff':
            return requestTimeOff(intentRequest, slackUser, callback);

        case 'CheckMyHolidays':
            return checkMyHolidays(intentRequest, slackUser, callback);

        default:
            throw new Error(`Intent with name ${name} not supported`);
    }
}

// main handler
exports.handler = function (event, context, callback) {
    try {
        console.log(`event.bot.name=${event.bot.name}`);

        if (event.bot.name !== 'Holibot') {
            callback('Invalid Bot Name');
        }

        handleIntent(event, callback);
    } catch (err) {
        callback(err);
    }
};