declare var process: any;

var slackToken = process.env.SlackToken;
import * as _ from 'lodash';
import { WebClient } from '@slack/client';
//var WebClient = require('@slack/client').WebClient;
var web = new WebClient(slackToken);

export function getEmailAddressFromSlackUserId(userId, callback) {
    console.log("getEmailAddressFromSlackUserId starting for " + userId);
    web.users.info(userId, (err, users) => {
        console.log("getting email address");

        if (err) {
            console.error("Error: " + JSON.stringify(err));
            return Error(err);
        } else {

            // find our user in the team's users
            var slackUsers = [];
            slackUsers.push(users);
            console.log("SlackUsers: " + JSON.stringify(slackUsers));

            callback(_.filter(slackUsers, (user) => user.user.id === userId)[0].user.profile.email);
        }
    });
}