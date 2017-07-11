/*
Holibot installer

This script will deploy the holibot resources to your AWS account
*/

// AWS
var AWS = require('aws-sdk');
var Lambda = new AWS.Lambda({ region: 'us-east-1' });
var Lex = new AWS.LexModelBuildingService({ region: 'us-east-1' });

// Other
var fs = require('fs');
var program = require('commander');
var promptly = require('promptly');
var async = require('async');
var request = require('request');
var _ = require('lodash');

// import task functions
const Arn = require('./app/arn');
const Bot = require('./app/bot');
const Intent = require('./app/intent');
const Static = require('./app/static');

// read the configured intents for this bot from the local JSON files
Static.loadIntents();
const intents = Static.intents;
const holibotFunctionHandler = Static.holibotFunctionHandler;

var holibotFunctionHandlerArn;
var accountId;

program
    .version('1.0.0')
    .option('-t, --timetastic-token [value]')
    .option('-i, --refresh-intents-only')
    .option('-s, --skip-serverless')
    .parse(process.argv);

console.log("Holibot installer.");
if (!program.timetasticToken) {
    console.log("Please specify your Timetastic API token with -t");
    process.exit();
}
else {
    deploy(program.timetasticToken);
}

// generic function to execute a shell command and return the stdout
function run(cmd, args, callback) {
    var spawn = require('child_process').spawn;
    var command = spawn(cmd, args);
    var result = '';
    command.stdout.on('data', function (data) {
        console.log(data.toString());
        result += data.toString();
    });
    command.on('error', (err) => {
        console.log('Failed to start child process: ' + err);
    });
    command.on('close', function (code) {
        callback(null);
    });
}

function deploy(timeTasticToken) {
    // write the token to the serverless yml file
    fs.writeFileSync('token.yml', 'timetastic: ' + timeTasticToken);

    // execute each operation in sequence
    async.waterfall(
        // create the serverless project in AWS (i.e. the lambda function) unless overridden at the command line
        (!program.skipServerless ? [deployServerlessProject] : [])

            .concat([
                // get the AWS ARN of the created lambda function
                Arn.getLambdaFunctionArn,

                // add permissions for Lex to call Lambda
                addPermission,

                // create or replace intents
                async.apply(Intent.replaceAll, intents)
            ])

            // add tasks in the case that --refresh-intents-only was NOT specified
            .concat(!program.refreshIntentsOnly ? [

                // delete the previously existing bot alias
                Bot.deleteBotAliasWithBackOff,

                // delete the previously existing bot
                Bot.deleteBot,

                // create the bot
                async.apply(Bot.createBot, intents),

                // wait until AWS has finished creating the bot
                Bot.waitForBotProvision,

                // wait until AWS has finished building the bot
                Bot.waitForBotBuild,

                // create the alias
                Bot.createBotAlias
            ] : []
            ), (err, results) => {
                if (err) {
                    console.log("There was an error executing one of the setup steps: " + err);
                    process.exit();
                } else {
                    console.log("All done. Now you need to do the following:");
                    console.log("1. Follow the AWS instructions to create an app in Slack: http://docs.aws.amazon.com/lex/latest/dg/slack-bot-assoc-create-app.html");
                    console.log("2. Then follow these steps to add a channel association to Slack in AWS: http://docs.aws.amazon.com/lex/latest/dg/slack-bot-assoc-create-assoc.html");
                    console.log("   As well as the Slack permissions mentioned in the AWS instructions, you need to add users:read and users:read.email.");
                    console.log("3. Visit https://api.slack.com/apps/");
                    console.log("4. Select the app you created and click Manage Distribution > Add to Slack");
                    console.log("5. Capture the OAuth access token from Slack and find your Lambda function in the AWS console");
                    console.log("6. Add an environment variable to the Lambda function called SlackToken containing the OAuth access token value from Slack.");
                    console.log("You should be good to start chatting!");
                }
            });
}

/*
Execute an sls deploy for the project to package up and deploy the Lambda function.
*/
function deployServerlessProject(callback) {
    console.log("Deploying Serverless project to AWS. This will create a stack in us-east-1 named holibot. Note your provided token is saved to ./token.yml. You may wish to delete this after installation is complete.");

    if (!program.refreshIntentsOnly) {
        run("sls.cmd", ["deploy", "--stage", "prod", "--region", "us-east-1"], callback);
    } else {
        callback(null);
    }
}

/*
Grant permissions for Lex to invoke the Lambda handler
*/
function addPermission(callback) {
    if (!program.refreshIntentsOnly) {
        console.log("Adding permission for " + holibotFunctionHandler + " to be invokeable by Lex.");
        Lambda.addPermission({
            FunctionName: holibotFunctionHandler,
            Action: "lambda:InvokeFunction",
            Principal: "lex.amazonaws.com",
            StatementId: holibotFunctionHandler + "-" + makeid(5)
        }, (err, data) => {
            callback(null);
        });
    } else {
        console.log("Skipping adding permission for the Lambda handler as --refresh-intents-only was specified.");
    }
}

/*
Conjur a random identifier of length n for use as a Lambda permission name
*/
function makeid(n) {
    var text = "";
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

    for (var i = 0; i < n; i++)
        text += possible.charAt(Math.floor(Math.random() * possible.length));

    return text;
};