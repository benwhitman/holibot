var fs = require('fs');

exports.intents = [];

exports.loadIntents = function () {
    exports.intents.push(JSON.parse(fs.readFileSync("./lex-objects/Approve.json", 'utf-8')));
    exports.intents.push(JSON.parse(fs.readFileSync("./lex-objects/CheckAllowance.json", 'utf-8')));
    exports.intents.push(JSON.parse(fs.readFileSync("./lex-objects/CheckApprovals.json", 'utf-8')));
    exports.intents.push(JSON.parse(fs.readFileSync("./lex-objects/CheckMyHolidays.json", 'utf-8')));
    exports.intents.push(JSON.parse(fs.readFileSync("./lex-objects/RequestTimeOff.json", 'utf-8')));
};

// the name of the lambda function that acts as a handler for all Holibot intents
exports.holibotFunctionHandler = "holibot-prod-handler";

exports.loadSlotTypes = function() {
    var slotTypes = [
        { 
            name: 'EmployeeNames', 
            description: 'A list of all the unique first name and firstname/lastname combiniations of the employees from Timetastic' 
        }
    ];
    return slotTypes;
};