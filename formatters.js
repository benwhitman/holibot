var moment = require('moment');
var _ = require('lodash');

// takes a moment object and formats it
function prettyDate(d) {
    return d.year === moment().year ?
        d.format("ddd, Do MMM") : d.format("ddd, Do MMM yyyy");
}

/*
Takes in a list of booked holidays and presents them as a list of holidays in a readable format
grouped by status

Optionally include " (id xxx)" after each row
Optionally include " - (user)" after each row (this is for approvals where the holidays will be for multiple people)
*/
exports.holidayList = function (holidays, includeIds, includeUsers, noMatchingHolidaysText) {
    console.log(JSON.stringify(holidays));
    if (holidays.length === 0) {
        return noMatchingHolidaysText || "You have no planned holidays booked or in a pending status";
    } else {
        var response = "You have the following holidays booked:\n";
        
        // filter out holidays in the past
        _.forEach(holidays,
            (holiday) => {
                var holidayDurationDays = holiday.bookingUnit === "Hours" ? holiday.duration / 24 : holiday.duration;

                // add s if no. of days > 1
                var holidayDuration;
                if (holidayDurationDays > 1) {
                    holidayDuration = holidayDurationDays + " days";
                } else {
                    holidayDuration = holidayDurationDays + " day";
                }

                // convert date ranges to moments for formatting
                var startDate = moment(holiday.startDate);
                var endDate = moment(holiday.endDate);

                // omit the year if the booking is for this year
                var startDateFormatted = prettyDate(startDate);
                var endDateFormatted = prettyDate(endDate);

                response += `\n${holidayDuration}: ${startDateFormatted} to ${endDateFormatted} ` + 
                (includeIds ? `(id ${holiday.id})` : ``) + 
                (includeUsers ? ` - ${holiday.userName}` : ``);
        });
        return response;
    }
};

exports.allowance = function(n, units, type) {
    var text = 'You have ';
    units = units.toLowerCase();

    switch (n) {
        case 0: 
            text += 'no ' + units;
        break;

        case 1: 
            text += '1' + units.replace('s', '');
        break;

        default:
            text += n.toString() + ' ' + units;
        break;
    }
    text += ' ' + type;
    return text;
}