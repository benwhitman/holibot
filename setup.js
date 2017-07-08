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
const SlotTypes = require('./app/slotTypes');
const Static = require('./app/static');

// read the configured intents for this bot from the local JSON files
Static.loadIntents();
const intents = Static.intents;
const holibotFunctionHandler = Static.holibotFunctionHandler;
const slotTypes = Static.loadSlotTypes();

var holibotFunctionHandlerArn;
var accountId;

program
    .version('1.0.0')
    .option('-t, --timetastic-token [value]')
    .option('-i, --refresh-intents-only')
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
        []

            // create the serverless project in AWS (i.e. the lambda function)
            .concat([deployServerlessProject])

            // get the AWS ARN of the created lambda function
            .concat([Arn.getLambdaFunctionArn])

            // delete any previously existing Holibot slot types
            .concat(
            slotTypes.map((slotType) => (callback) => {
                try {
                    console.log("Deleting existing Holibot slot type " + slotType.name);
                    Lex.deleteSlotType({ name: slotType.name }, (err, data) => callback(null));
                }
                catch (error) {
                    console.log('Could not delete slot type ' + slotType.name + ': ' + error);
                }
            })
            )

            // create the employee name slot type
            .concat([async.apply(SlotTypes.populateEmployeeNameSlotType, timeTasticToken, slotTypes)])

            // delete any previously existing Holibot intents (we're going to recreate them)
            .concat(
            intents.map((intent) => (callback) => {
                try {
                    Lex.deleteIntent({ name: intent.name }, (err, data) => callback(null));
                }
                catch (error) {
                    console.log('Could not delete ' + intent.name + ': ' + error);
                }
            })
            )

            // create each intent
            .concat(
            intents.map((intent) => (callback) => {
                console.log("Creating intent: " + intent.name);
                Lex.putIntent(intent, (err, data) => callback(null));
            })
            )

            .concat([

                // add permissions for Lex to call Lambda
                addPermission,

                // delete the previously existing bot alias
                deleteBotAlias,

                // delete the previously existing bot
                async.apply(Bot.deleteBot, program.refreshIntentsOnly),

                // create the bot
                async.apply(Bot.createBot, program.refreshIntentsOnly, intents),

                // wait until AWS has finished building the bot
                waitForBotProvision,

                // create the alias
                createBotAlias
            ]), (err, results) => {
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
Delete an existing 'prod' alias for Holibot if it exists
*/
function deleteBotAlias(callback) {
    if (!program.refreshIntentsOnly) {
        console.log("Deleting previous Holibot prod alias if necessary");

        try {
            Lex.deleteBotAlias({ name: 'prod', botName: 'Holibot' }, () => {
                console.log("Bot alias deleted");
                callback(null);
            });
        }
        catch (error) {
            console.log("Error deleting previous alias: " + err);
            callback(null);
        }
    } else {
        console.log("Skipping deletion of previous bot alias as --refresh-intents-only.");
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
}

/*
Keep checking for the existence of our bot and then call the supplied callback
*/
function waitForBotProvision(callback) {
    if (!program.refreshIntentsOnly) {
        setTimeout(() => {
            var botCreated = Lex.getBot({
                name: 'Holibot',
                versionOrAlias: '$LATEST'
            }, (err, bot) => {
                console.log("Waiting for Holibot to be provisioned before creating the alias");

                if (err) {
                    waitForBotProvision(callback);
                } else {
                    // bot created, continue
                    callback(null);
                }
            });
        }, 2000);
    } else {
        console.log("--refresh-intents-only was specified so need to wait for a bot provisioning operation to happen.");
        callback(null);
    }
}

/*
Create the 'prod' alias for the bot
*/
function createBotAlias(callback) {
    if (!program.refreshIntentsOnly) {
        console.log("Adding 'prod' alias for Holibot.");
        Lex.putBotAlias({
            name: 'prod',
            botName: 'Holibot',
            botVersion: '$LATEST'
        }, (err, data) => {
            console.log("Bot alias 'prod' created.");
            callback(null);
        });
    } else {
        console.log("--refresh-intents-only was specified, so we're not creating a bot alias.");
        callback(null);
    }
}
