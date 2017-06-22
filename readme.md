# holibot

A Slackbot for booking annual leave in TimeTastic implemented in AWS Lex and Lambda. This is not a hosted service - everything in this repo allows you to create your own private bot.

## what do I need in order to use Holibot?

* A Slack account
* An AWS subscription
* A TimeTastic account

## what does this bot enable me to do?

* request annual leave by chatting in Slack
* show your planned holidays

## how do I set it up?

First install the AWS command line utility, and configure it with an appropriate security token that has the permissions:

* lex - create intents / bots lex:PutIntent
* lambda - create / update functions

Clone this repository and run npm setup. This command will ask you for your TimeTastic API token which you can get [here](http://api.timetastic.com). When the installation is complete you will have a bot configured for your TimeTastic account that you can proceed to add to Slack.