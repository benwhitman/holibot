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
const holibotFunctionHandler = "holibot-prod-lex-handler";

// the configured intents for this bot
var intents = [];
intents.push(JSON.parse(fs.readFileSync("./lex-intents/CheckMyHolidays.json", 'utf-8')));
intents.push(JSON.parse(fs.readFileSync("./lex-intents/RequestTimeOff.json", 'utf-8')));

var holibotFunctionHandlerArn;
var accountId;

program
    .version('1.0.0')
    .option('-t, --timetastic-token [value]')
    .parse(process.argv);

console.log("holibot installer.");
if (!program.timetasticToken) {
    promptly.prompt("Please enter your TimeTastic API token", (err, timeTasticToken) => {
        deploy(timeTasticToken);
    });
} else {
    deploy(program.timetasticToken);
}

// generic function to execute a shell command and return the stdout
function run(cmd, args, callback) {
    var spawn = require('child_process').spawn;
    var command = spawn(cmd, args);
    var result = '';
    command.stdout.on('data', function (data) {
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

function deploy(timeTasticToken) {
    // write the token to the serverless yml file
    fs.writeFileSync('token.yml', 'timetastic: ' + timeTasticToken);

    // install npm dependencies
    run("npm", ["install"], deployServerlessProject);
}

function deployServerlessProject(result) {
    console.log("Deploying Serverless project to AWS. This will create a stack in us-east-1 named holibot");

    //run("sls", ["deploy", "--stage", "prod", "--region", "us-east-1"], getLambdaFunctionArn);
    getLambdaFunctionArn();
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

function deployLexObjects() {
    console.log("Deploying AWS Lex objects");

    intents.forEach((intent) => {
        console.log("* intent: " + intent.name);
        Lambda.addPermission({
            FunctionName: holibotFunctionHandler,
            Action: "lambda:InvokeFunction",
            Principal: "lex.amazonaws.com",
            StatementId: holibotFunctionHandler + "-" + intent.name + makeid(5)
        }, (err, data) => {
            if (err) {
                console.log("Error: " + err);
                process.exit();
            }
            console.log("Lambda permissions granted for " + intent.name);

            Lex.putIntent(intent, (err, data) => {
                if (err) {
                    console.log("Error: " + err);
                    process.exit();
                }
                console.log("Lex model created for " + intent.name);
            });
        });
    });

    function makeid(n) {
        var text = "";
        var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

        for (var i = 0; i < n; i++)
            text += possible.charAt(Math.floor(Math.random() * possible.length));

        return text;
    }
}