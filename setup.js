/*
Holibot installer

This script will deploy the holibot resources to your AWS account
*/
var program = require('commander');
var promptly = require('promptly');
var fs = require('fs');
var async = require('async');

var AWS = require('aws-sdk');
var Lambda = new AWS.Lambda({ region: 'us-east-1' });
var Lex = new AWS.LexModelBuildingService({ region: 'us-east-1' });

// set the region - it's fixed as Lex only exists in one region for now
AWS.config.update({ region: 'us-east-1' });

// the name of the lambda function that acts as a handler for all Holibot intents
const holibotFunctionHandler = "holibot-prod-handler";

// the configured intents for this bot
var intents = [];
intents.push(JSON.parse(fs.readFileSync("./lex-objects/CheckMyHolidays.json", 'utf-8')));
intents.push(JSON.parse(fs.readFileSync("./lex-objects/RequestTimeOff.json", 'utf-8')));
intents.push(JSON.parse(fs.readFileSync("./lex-objects/CheckAllowance.json", 'utf-8')));

var holibotFunctionHandlerArn;
var accountId;

program
    .version('1.0.0')
    .option('-t, --timetastic-token [value]')
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
function run(cmd, args) {
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
        return result;
    });
}

function deploy(timeTasticToken) {
    // write the token to the serverless yml file
    fs.writeFileSync('token.yml', 'timetastic: ' + timeTasticToken);

    // execute each operation in sequence
    async.waterfall([
        // create the serverless project in AWS (i.e. the lambda function)
        //deployServerlessProject,

        // get the AWS ARN of the created lambda function
        getLambdaFunctionArn]

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
            deleteBot,

            // create the bot
            createBot,

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
    console.log("Deploying Serverless project to AWS. This will create a stack in us-east-1 named holibot. Note your provided token are saved to ./token.yml. You may wish to delete them."); run("sls.cmd", ["deploy", "--stage", "prod", "--region", "us-east-1"]);
    callback(null);
}

/*
Get the ARN of the Lambda function created from the Serverless deployment and set this as the code hook
for each of the intents (i.e. they share the same code hook function).
*/
function getLambdaFunctionArn(callback) {

    console.log("Getting the ARN of the Holibot Lambda function handler");

    Lambda.getFunction({ FunctionName: holibotFunctionHandler }, (err, data) => {
        holibotFunctionHandlerArn = data.Configuration.FunctionArn;
        console.log("* " + holibotFunctionHandlerArn);

        // add this arn to the intents as they both need to know which function to invoke when Lex uses them
        intents.forEach((intent) => {
            intent.fulfillmentActivity.codeHook.uri = holibotFunctionHandlerArn;
        });

        callback(null);
    });
}

/*
Create the bot
*/
function createBot(callback) {
    console.log("Creating bot");
    // get the bot object, which starts out in the local ./lex-objects/bot.json file but needs
    // to be added to depending on which intents we are creating
    var bot = JSON.parse(fs.readFileSync('./lex-objects/bot.json', 'utf-8'));
    intents.forEach((intent) => {
        bot.intents.push({
            "intentVersion": "$LATEST",
            "intentName": intent.name
        });
    });
    Lex.putBot(bot, (err, data) => {
        callback(null);
    });
}

/*
Delete an existing 'prod' alias for Holibot if it exists
*/
function deleteBotAlias(callback) {
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
}

/*
Delete an existing Holibot if it exists
*/
function deleteBot(callback) {
    console.log("Deleting previous Holibot if necessary");

    // delete existing bot and intents if they exist
    Lex.getBot({ name: "Holibot", versionOrAlias: "$LATEST" },
        (err, existingBot) => {
            if (existingBot) {
                console.log("Holibot already exists - deleting");
                Lex.deleteBot({ name: existingBot.name },
                    (err, data) => {
                        console.log("existing bot deleted");
                        callback(null);
                    });
            } else {
                callback(null);
            }
        });
}

/*
Grant permissions for Lex to invoke the Lambda handler
*/
function addPermission(callback) {
    Lambda.addPermission({
        FunctionName: holibotFunctionHandler,
        Action: "lambda:InvokeFunction",
        Principal: "lex.amazonaws.com",
        StatementId: holibotFunctionHandler + "-" + makeid(5)
    }, (err, data) => {
        callback(null);
    });
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
}


/*
Create the 'prod' alias for the bot
*/
function createBotAlias(callback) {
    Lex.putBotAlias({
        name: 'prod',
        botName: 'Holibot',
        botVersion: '$LATEST'
    }, (err, data) => {
        console.log("Bot alias 'prod' created.");
        callback(null);
    });
}
