/*
Holibot installer

This script will deploy the holibot resources to your AWS account
*/
var program = require('commander');
var promptly = require('promptly');
var exec = require('child_process').exec;
var fs = require('fs');

program
    .version('0.0.1')
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
    run("aws", ["lambda", "get-function", "--function-name", "holibot-prod-handler", "--region", "us-east-1"], deployLexObjects);
}

function deployLexObjects(result) {
    // stdout should contain the JSON describing the holibot lambda function
    //console.log('stdout: ' + result);
    var holibotLambda = JSON.parse(result);

    console.log("Deploying AWS Lex objects");

    let fulfillment = {
        type: "CodeHook",
        "codeHook": {
            "messageVersion": "1.0",
            "uri": holibotLambda.Configuration.FunctionArn
        }
    };

    // aws lambda add-permission --function-name OrderFlowersCodeHook --statement-id LexGettingStarted-OrderFlowersBot
    // --action lambda:InvokeFunction --principal lex.amazonaws.com --source-arn "arn:aws:lex:region:account ID:intent:OrderFlowers:*"
    var intents = ["CheckMyHolidays", "RequestTimeOff"];

    // start running the statements which are required per intent
    runNext(0);
}

function runNext(intent) {
    if (intent < intents.length) {

        var lambdaAddPermissionParams = ["lambda", "add-permission", "--function-name", "holibot-prod-handler", 
            "--statement-id", "holibot-statement-" + intent, "--action", "lambda:InvokeFunction", 
            "--principal", "lex.amazonaws.com", "--source-arn"];
        var lexCreateIntentParams = ["lex-models", "put-intent", "--name", "CheckMyHolidays",
            "--cli-input-json", "file://lex-intents/checkMyHolidays.json",
            "--fulfillment-activity", "'" + JSON.stringify(fulfillment) + "'"];

        run("aws", lambdaAddPermissionParams,
            (result) => {
                run("aws", lexCreateIntentParams,
                    (result) => {
                        runNext(intent++);
                    });
            })
    } else {
        postInstall();
    }
}

function postInstall() {
    console.log("Now complete the following steps to add the bot to Slack:");
}