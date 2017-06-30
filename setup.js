/*
Holibot installer

This script will deploy the holibot resources to your AWS account
*/
var program = require('commander');
var promptly = require('promptly');
var fs = require('fs');

var AWS = require('aws-sdk');
var Lambda = new AWS.Lambda({ region: 'us-east-1' });
var Lex = new AWS.LexModelBuildingService({ region: 'us-east-1' });

// set the region - it's fixed as Lex only exists in one region for now
AWS.config.update({ region: 'us-east-1' });
//Lambda.config.update({ region: 'us-east-1' });

// the name of the lambda function that acts as a handler for all Holibot intents
const holibotFunctionHandler = "holibot-prod-handler";

// the configured intents for this bot
var intents = [];
intents.push(JSON.parse(fs.readFileSync("./lex-objects/CheckMyHolidays.json", 'utf-8')));
intents.push(JSON.parse(fs.readFileSync("./lex-objects/RequestTimeOff.json", 'utf-8')));

var holibotFunctionHandlerArn;
var accountId;

program
    .version('1.0.0')
    .option('-t, --timetastic-token [value]')
    .option('-s, --slack-token [value]')
    .parse(process.argv);

console.log("Holibot installer.");
if (!program.timetasticToken || !program.slackToken) {
    console.log("Please specify both your Timetastic API token with -t and your Slack Oauth token with -s");
    process.exit();
}
else {
    deploy(program.timetasticToken, program.slackToken);
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
        process.exit();
    });
    command.on('close', function (code) {
        return callback(result);
    });
}

function deploy(timeTasticToken, slackToken) {
    // write the token to the serverless yml file
    fs.writeFileSync('token.yml', 'timetastic: ' + timeTasticToken + '\nslack: ' + slackToken);

    // install npm dependencies
    run("npm", ["install"], deployServerlessProject);
}

function deployServerlessProject(result) {
    console.log("Deploying Serverless project to AWS. This will create a stack in us-east-1 named holibot. Note your provided tokens are saved to ./token.yml. You may wish to delete them.");

    run("sls", ["deploy", "--stage", "prod", "--region", "us-east-1"], getLambdaFunctionArn);
}

function getLambdaFunctionArn(result) {

    console.log("Getting the ARN of the Holibot Lambda function handler");

    Lambda.getFunction({ FunctionName: holibotFunctionHandler }, (err, data) => {
        if (err) {
            console.log(err, err.stack);
        } else {
            holibotFunctionHandlerArn = data.Configuration.FunctionArn;
            console.log("* " + holibotFunctionHandlerArn);

            // add this arn to the intents as they both need to know which function to invoke when Lex uses them
            intents.forEach((intent) => {
                intent.fulfillmentActivity.codeHook.uri = holibotFunctionHandlerArn
            });
            deployLexObjects();
        }
    });
}

async function deployLexObjects() {
    console.log("Deploying AWS Lex objects");

    // delete existing bot and intents if they exist
    try {
        existingBot = await Lex.getBot({ name: "Holibot", versionOrAlias: "$LATEST" }).promise();

        if (existingBot) {
            console.log("Holibot already exists - deleting");
            await Lex.deleteBot({ name: existingBot.name }).promise();
            console.log("existing bot deleted");
        };
    }
    catch (error) {
        console.log("No existing bot: " + error);
    }

    await intents.forEach(async (intent) => {
        try {
            let existingIntent = await Lex.getIntent({ name: intent.name, version: "$LATEST" }).promise();

            if (existingIntent) {
                console.log("intent " + intent.name + " exists - deleting");
                await Lex.deleteIntent({ name: existingIntent.name }).promise();
                console.log("existing intent " + existingIntent.name + " deleted");
            }
        }
        catch (error) {
            console.log("no existing intent " + intent.name);
        }
    });

    var ops = [];

    // add permission for Lex to invoke the Lambda function
    ops.push(
        Lambda.addPermission({
            FunctionName: holibotFunctionHandler,
            Action: "lambda:InvokeFunction",
            Principal: "lex.amazonaws.com",
            StatementId: holibotFunctionHandler + "-" + makeid(5)
        }).promise());

    // create each intent
    intents.forEach((intent) => {
        console.log("* intent: " + intent.name);

        ops.push(
            Lex.putIntent(intent).promise()
        );
    });

    // after all commands to create and permission intents have been carried out, create the bot itself
    Promise.all(ops)
        .then(() => {
            // create the bot
            Lex.putBot(JSON.parse(fs.readFileSync('./lex-objects/bot.json', 'utf-8')))
                .promise()
                .then((result) => {
                    console.log("Bot created successfully. Now you need to add the bot to Slack: Follow guidelines from Step 2 at http://docs.aws.amazon.com/lex/latest/dg/slack-bot-association.html");
                })
                .catch((error) => {
                    console.error("Error creating bot: " + error);
                });
        })
        .then(() => {
            // wait for AWS to provision the bot, and then continue to create the alias
            waitForBotProvision(createBotAlias);
        })
        .catch((err) => {
            console.error("Error creating or permissioning an intent:" + err);
            process.exit();
        });
}


function makeid(n) {
    var text = "";
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

    for (var i = 0; i < n; i++)
        text += possible.charAt(Math.floor(Math.random() * possible.length));

    return text;
}

function waitForBotProvision(callback) {
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
                callback()
            }
        })
    }, 2000);
}

function createBotAlias() {
    // create the prod alias for the bot
    Lex.putBotAlias({
        name: 'prod',
        botName: 'Holibot',
        botVersion: '$LATEST'
    })
        .promise()
        .then(() => {
            console.log("Bot alias 'prod' created.");
        })
        .catch((error) => {
            console.error("Error creating prod alias: " + error);
        });
}