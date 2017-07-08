# holibot

A Slackbot for booking annual leave in TimeTastic implemented in AWS Lex and Lambda. This is not a hosted service - everything in this repo allows you to create your own private bot using your own AWS account.

## what do I need in order to use Holibot?

* A Slack account
* An AWS subscription
* A TimeTastic account

## what can holibot do?

* request annual leave by chatting in Slack
* show your planned holidays
* approve holidays for others
* show your outstanding holiday allowance
* show which approvals are outstanding

## how do I set it up?

First install the AWS command line utility, and configure it with an appropriate security token that has the permissions:

* lex - full control
* lambda - create / update functions

* In Slack create an application according to instructions [here](http://docs.aws.amazon.com/lex/latest/dg/slack-bot-assoc-create-app.html)
* Clone this repository and run the command

```
npm install
node setup -t <your TimeTastic API token> 
```

You can get your Timetastic token here (having logged in already): [here](http://api.timetastic.com). 

When the installation is complete you will have a bot configured for your TimeTastic account that you can proceed to add to Slack.

* In AWS, create a channel association for Slack to your newly created Holibot with the instructions [here](http://docs.aws.amazon.com/lex/latest/dg/slack-bot-assoc-create-assoc.html) and [here](http://docs.aws.amazon.com/lex/latest/dg/slack-bot-back-in-slack-console.html).

* In the Slack page for your bot app under *Features* > *OAuth & Permissions* you need to add the following permissions to allow Holibot to read the email addresses of your team: team:read, users:read, users:read.email
* You also need to grab the 'OAuth Access Token' from the same page.
* Add this token as an extra environment variable to the AWS Lambda function holibot-prod-handler called SlackToken.
* Back in your Slack app page under *Settings* > *Manage Distribution* click the 'Add to Slack' button.

> Note: Users' email addresses must be the same in Slack as they are in Timetastic for Holibot to work.

`
aws lambda update-function-configuration --environment "Variables={SlackToken=<your Slack Oauth token>}" --function-name holibot-prod-handler
`