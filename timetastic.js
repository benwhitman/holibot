var Slack = require('./slack');
var Formatters = require('./formatters');
var _ = require('lodash');
var request = require('request');
var moment = require('moment');

var endpoint = process.env.TimeTasticEndpoint;

// create a base request used by all calls to the TimeTastic api.
var baseRequest = request.defaults({
    headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + process.env.TimeTasticToken
    }
});

// this function takes the user id supplied in the original intent, which is the slack id
exports.resolveUserId = function (slackUser) {
    console.log("resolveUserId starting for " + slackUser);
    return new Promise((resolve, reject) => {

        // get the email address of the slackUser using the Slack WebClient
        var email = Slack.getEmailAddressFromSlackUserId(slackUser, (email) => {
            console.log("resolveTimeTasticUserId: got email address: " + email);

            // now we have the email address of the slack user, look up that user's id in TimeTastic
            var url = endpoint + "users";
            baseRequest.get(url, {}, function (error, response, body) {
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
};

// given a name which we assume to be distinct (because it was passed in from a distinct list), return the timetastic user id
// of the employee with that name
var resolveUserIdFromName = function (name) {
    console.log("Resolving user id from name [" + name + "]");

    return new Promise((resolve, reject) => {
        var url = endpoint + "users";
        baseRequest.get(url, {}, function (error, response, body) {
            if (response.statusCode === 200) {

                // body will now be an array of users for the team, so look up the id of the one with our email address
                var timetasticUserId = _.filter(JSON.parse(body),
                    (user) => user.firstname.toLowerCase() === name.toLowerCase() ||
                        (user.firstname + " " + user.surname).toLowerCase() === name.toLowerCase()
                )[0].id;

                console.log("User id is " + timetasticUserId);

                resolve(timetasticUserId);
            } else {
                reject(Error(error));
            }
        });
    });
};

exports.bookHoliday = function (userId, slots, callback, close, outputSessionAttributes) {
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

        callback(null, close(outputSessionAttributes, 'Fulfilled', {
            contentType: 'PlainText',
            content: body.response
        }));
    });
};

exports.getHolidaysForUser = function (userId, slots, callback, close, outputSessionAttributes) {
    var url = endpoint + "holidays?userids=" + userId + "&start=" + moment().format("YYYY-MM-DD");

    console.log("GET: " + url);

    baseRequest.get(url, function (error, response, body) {
        console.log("Error: " + JSON.stringify(error));
        console.log("body: " + body);

        if (response.statusCode === 200) {
            callback(null, close(outputSessionAttributes, 'Fulfilled', {
                contentType: 'PlainText',
                content: Formatters.holidayList(JSON.parse(body).holidays, false)
            }));
        } else {
            callback(null, close(outputSessionAttributes, 'Fulfilled', {
                contentType: 'PlainText',
                content: body.response
            }));
        }
    });
};

exports.getAllowanceForUser = function (userId, callback, close, outputSessionAttributes) {
    var url = endpoint + "users/" + userId;

    console.log("GET: " + url);

    baseRequest.get(url, function (error, response, body) {
        console.log("Error: " + JSON.stringify(error));
        console.log("body: " + body);

        var userDetail = JSON.parse(body);

        if (response.statusCode === 200) {
            callback(null, close(outputSessionAttributes, 'Fulfilled', {
                contentType: 'PlainText',
                content: Formatters.allowance(userDetail.allowanceRemaining, userDetail.allowanceUnit, 'remaining') + ' for the year.'
            }));
        } else {
            callback(null, close(outputSessionAttributes, 'Fulfilled', {
                contentType: 'PlainText',
                content: 'Sorry there was an error retrieving your allowance'
            }));
        }
    });
};

exports.getApprovals = function (callback, close, outputSessionAttributes) {
    var url = endpoint + "holidays?status=Pending";

    console.log("GET: " + url);

    baseRequest.get(url, function (error, response, body) {
        console.log("Error: " + JSON.stringify(error));
        console.log("body: " + body);

        if (response.statusCode === 200) {
            callback(null, close(outputSessionAttributes, 'Fulfilled', {
                contentType: 'PlainText',
                content: Formatters.holidayList(JSON.parse(body).holidays, false, true, 'There are no outstanding approvals')
            }));
        } else {
            callback(null, close(outputSessionAttributes, 'Fulfilled', {
                contentType: 'PlainText',
                content: body.response
            }));
        }
    });
};

// approve a specific holiday
function approveHoliday(holiday, callback) {
    console.log("Approving holiday id " + holiday.id);

    var url = endpoint + "holdiays/" + holiday.id + "&holidayUpdateAction=Approve";
    var approvalRequest = {
        reason: 'Approved via Holibot',
        suppressEmails: false
    };

    baseRequest.post(url, approvalRequest, function (error, response, body) {
        if (response.statusCode === 200) {
            console.log("Holiday " + holiday.id + " approved successfully");
            callback();
        } else {
            console.error("Error approving holiday id " + holiday.id);
            callback(body.message);
        }
    });
};

/*
Approve all holidays for the user [name] which should refer to a firstname or a firstname + ' ' + surname
in the team.
*/
exports.approve = function (name, callback, close, outputSessionAttributes) {
    resolveUserIdFromName(name)
        .then((userId) => {
            // get all holidays for this user
            var url = endpoint + "holidays?status=Pending&userids=" + userId;

            baseRequest.get(url, function (error, response, body) {
                if (response.statusCode === 200) {
                    var holidays = JSON.parse(body).holidays;

                    // first verify that there are some outstanding holidays for this user
                    if (holidays === []) {
                        callback(null, close(outputSessionAttributes, 'Fulfilled', {
                            contentType: 'PlainText',
                            content: 'There are no pending holiday bookings for ' + name
                        }));
                    } else {
                        // for each booking, submit an approve api call
                        async.each(holidays, approveHoliday, function (err) {
                            console.log("Could not approve one on more holidays");
                            callback(null);
                        });

                        callback(null, close(outputSessionAttributes, 'Fulfilled', {
                            contentType: 'PlainText',
                            content: 'All holidays approved for ' + name
                        }));
                    }
                } else {
                    callback(null, close(outputSessionAttributes, 'Fulfilled', {
                        contentType: 'PlainText',
                        content: body.response
                    }));
                }
            });
        });
};