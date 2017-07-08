// AWS
var AWS = require('aws-sdk');
var Lambda = new AWS.Lambda({ region: 'us-east-1' });
var Lex = new AWS.LexModelBuildingService({ region: 'us-east-1' });

// Other modules
var Static = require('./static');

/*
Get the ARN of the Lambda function created from the Serverless deployment and set this as the code hook
for each of the intents (i.e. they share the same code hook function).
*/
exports.getLambdaFunctionArn = function (callback) {

    console.log("Getting the ARN of the Holibot Lambda function handler");

    Lambda.getFunction({ FunctionName: Static.holibotFunctionHandler }, (err, data) => {
        holibotFunctionHandlerArn = data.Configuration.FunctionArn;
        console.log("* " + holibotFunctionHandlerArn);

        // add this arn to the intents as they both need to know which function to invoke when Lex uses them
        Static.intents.forEach((intent) => {
            intent.fulfillmentActivity.codeHook.uri = holibotFunctionHandlerArn;
        });

        callback(null);
    });
};