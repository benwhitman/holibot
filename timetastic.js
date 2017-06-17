var slack = require('./slack');
var formatters = require('./formatters');
var _ = require('lodash');
var endpoint = "https://app.timetastic.co.uk/api/";

var request = require('request');
// create a base request used by all calls to the TimeTastic api.
var baseRequest = request.defaults({
    headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + process.env.TimeTasticToken
    }
});

// this function takes the user id supplied in the original intent, which is the slack id
function resolveUserId(slackUser) {
    console.log("resolveUserId starting for " + slackUser);
    return new Promise((resolve, reject) => {

        // get the email address of the slackUser using the Slack WebClient
        var email = slack.getEmailAddressFromSlackUserId(slackUser, (email) => {
            console.log("resolveTimeTasticUserId: got email address: " + email);

            // now we have the email address of the slack user, look up that user's id in TimeTastic
            var url = endpoint + "users";
            baseRequest.get(url, {}, function (error, response, body) {
                //console.log("Error: " + JSON.stringify(error));
                //console.log("body: " + JSON.stringify(body));
                //console.log("response:" + JSON.stringify(response));
                if (response.statusCode === 200) {

                    // body will now be an array of users for the team, so look up the id of the one with our email address
                    var timetasticUserId = _.filter(JSON.parse(body), (user) => user.email === email)[0].id;

                    resolve(timetasticUserId);
                } else {
                    reject(Error(error));
                }
            });
        });
    });
}

function bookHoliday(userId, slots, callback, close, outputSessionAttributes) {
    // create a TimeTastic holiday approval request based on the supplied intent request data
    var leaveRequest = {
        "from": slots.startDate,
        "to": slots.endDate,
        "leaveTypeId": 122848,
        "reason": "Holiday",
        "userOrDepartmentId": userId,
        "bookFor": "User",
        "suppressEmails": false,
        "override": true
    };

    var url = endpoint + "holidays";

    console.log("POST: " + JSON.stringify(leaveRequest));

    baseRequest.post(url, { json: leaveRequest }, function (error, response, body) {
        console.log("Error: " + JSON.stringify(error));
        console.log("body: " + JSON.stringify(body));

        if (body.success) {
            callback(null, close(outputSessionAttributes, 'Fulfilled', {
                contentType: 'PlainText',
                content: `Okay, I have booked your holiday. Bon voyage!`
            }));
        } else {
            callback(null, close(outputSessionAttributes, 'Fulfilled', {
                contentType: 'PlainText',
                content: body.response
            }));
        }
    });
}

function getHolidaysForUser(userId, slots, callback, close, outputSessionAttributes) {
    var getHolidaysRequest = {
        "from": slots.startDate,
        "fromTime": "AM",
        "to": slots.endDate,
        "toTime": "PM",
        "userIds": userId
    };

    var url = endpoint + "holidays";

    console.log("GET: " + JSON.stringify(getHolidaysRequest));

    baseRequest.get(url, { json: getHolidaysRequest }, function (error, response, body) {
        console.log("Error: " + JSON.stringify(error));
        console.log("body: " + JSON.stringify(body));

        if (response.statusCode === 200) {
            callback(null, close(outputSessionAttributes, 'Fulfilled', {
                contentType: 'PlainText',
                content: formatters.holidayList(body.holidays) + 
                    `\n\nIf you would like to modify one of these bookings enter *modify <id>*`
            }));
        } else {
            callback(null, close(outputSessionAttributes, 'Fulfilled', {
                contentType: 'PlainText',
                content: body.response
            }));
        }
    });
}

module.exports.bookHoliday = bookHoliday;
module.exports.getHolidaysForUser = getHolidaysForUser;
module.exports.resolveUserId = resolveUserId;