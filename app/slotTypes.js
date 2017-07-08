// AWS
var AWS = require('aws-sdk');
var Lambda = new AWS.Lambda({ region: 'us-east-1' });
var Lex = new AWS.LexModelBuildingService({ region: 'us-east-1' });

// Other
var request = require('request');
var _ = require('lodash');

/*
Get the list of employee names from the Timetastic API. Reduce this to an array of names, which are...

just a first name, if that first name is unique within the company
the first and second names of each employee assuming there are no duplicates within the company
(if there are, these won't be included and sorry, won't be approvable using Holibot)
*/
exports.populateEmployeeNameSlotType = function(timetasticToken, slotTypes, callback) {
    var baseRequest = request.defaults({
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + timetasticToken
        }
    });

    var url = 'https://app.timetastic.co.uk/api/users';

    baseRequest.get(url, function (error, response, body) {
        var users = JSON.parse(body);

        // console.log('Timetastic users: ' + JSON.stringify(users));

        // produce a simple list of firstname, firstname + lastname from TimeTastic
        var names = _.map(users, (user) => { return { firstName: user.firstname, fullName: user.firstname + ' ' + user.surname }; });

        var firstNames = _(names)
            .groupBy('firstName')
            // we only want names that exist once
            .map((users, name) => users.length === 1 ? {
                value: name
            } : {});

        var fullNames = _(names)
            .groupBy('fullName')
            // we only want names that exist once
            .map((users, name) => users.length === 1 ? {
                value: name
            } : {});

        var employees = firstNames.concat(fullNames);
        console.log("Creating " + slotTypes[0].name + " slot type.");

        // create the employeeName slot type with this data
        var slotType = {
            name: slotTypes[0].name,
            description: slotTypes[0].description,
            enumerationValues: employees
        };
        console.log("Slot type: " + JSON.stringify(slotType));
        Lex.putSlotType(slotType, (err, data) => {
            callback(null);
        });
    });
};