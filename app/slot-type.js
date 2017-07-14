// AWS
var AWS = require('aws-sdk');
var Lex = new AWS.LexModelBuildingService({ region: 'us-east-1' });

// 3rd party
var _ = require('lodash');
var request = require('request');
var async = require('async');

/*
Create a slot type on AWS Lex for Departments containing the departments setup in Timetastic
*/
exports.createDepartmentsSlotType = function (token, endpoint, callback) {

    // get the departments data from timetastic
    request.get(endpoint + '/departments', {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + token
        }
    },
        (err, response, body) => {
            if (response.statusCode === 200) {
                var departments = JSON.parse(body);

                // create a slot type object based on these values
                var departmentValues = _.map(departments, 
                    (department) => { return { "value": department.name }; });
                
                var departmentsSlotType = { name: 'Departments', description: 'A list of all of the departments from your Timetastic account', enumerationValues: departmentValues };
//console.log(JSON.stringify(departmentsSlotType));
                
                // create the slot type in AWS
                async.waterfall([
                    buildCheckSlotTypeFunction(departmentsSlotType), 
                    buildCreateOrReplaceSlotTypeFunction(departmentsSlotType)
                ], (err, result) => {
                    if (err) {
                        callback(err);
                    } else {
                        callback(null);
                    }
                });
            } else {
                callback("Error invoking Timetastic api /departments: " + err);
            }
        });
}

function buildCheckSlotTypeFunction(slotType) {
    return function (callback) {
        Lex.getSlotType({ name: slotType.name, version: '$LATEST' },
            function (err, existingSlotType) {
                console.log(slotType.name);
                if (/NotFoundException/.test(err)) {
                    console.log("slot type not found - creating...");
                    callback(null, 'no-checksum');
                } else if (err) {
                    console.log("error getting slot type");
                    callback(err);
                } else {
                    console.log("slot type already exists - replacing...");
                    callback(null, existingSlotType.checksum);
                }
            });
    };
}

function buildCreateOrReplaceSlotTypeFunction(slotType) {
    return function (checksum, callback) {

        // create a params object for putSlotType. Checksum should only be specified if this is a replacement operation
        var params = Object.assign(slotType, { checksum: checksum === 'no-checksum' ? null : checksum });

        Lex.putSlotType(params,
            (err, result) => {
                //console.log(err, result);
                if (err) {
                    callback(err);
                } else {
                    callback(null);
                }
            });
    };
}