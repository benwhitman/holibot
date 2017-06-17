/*
Holibot installer

This script will deploy the holibot resources to your AWS account
*/
var program = require('commander');
var promptly = require('promptly');

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

function deploy(timeTasticToken) {
    console.log("Your token is " + timeTasticToken);
}
