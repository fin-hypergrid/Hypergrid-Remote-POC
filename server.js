var express = require('express');
var app = express();
var path = require('path');
var expressWs = require('express-ws')(app);

/////////////////DB///////////////////
var NUM_OF_ROWS = 10000;
var NUM_OF_ROWS_UPDATING = Math.round(NUM_OF_ROWS / 3);
var DB = setupDB(NUM_OF_ROWS);
var UPDATE_PERIOD = 30; //ms
var randomFunc;
startSimulatedUpdates();


function generateRows(numRows){
    randomFunc = Math.random;
    var data = [];
    var firstNames = ['Olivia', 'Sophia', 'Ava', 'Isabella', 'Boy', 'Liam', 'Noah', 'Ethan', 'Mason', 'Logan', 'Moe', 'Larry', 'Curly', 'Shemp', 'Groucho', 'Harpo', 'Chico', 'Zeppo', 'Stanley', 'Hardy'];
    var lastNames = ['Wirts', 'Oneil', 'Smith', 'Barbarosa', 'Soprano', 'Gotti', 'Columbo', 'Luciano', 'Doerre', 'DePena'];
    var months = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
    var days = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21', '22', '23', '24', '25', '26', '27', '28', '29', '30'];
    var states = ['', 'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut', 'Delaware', 'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky', 'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan', 'Minnesota', 'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire', 'New Jersey', 'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio', 'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina', 'South Dakota', 'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington', 'West Virginia', 'Wisconsin', 'Wyoming'];

    var randomPerson = function(pos) {
        var firstName = Math.round((firstNames.length - 1) * randomFunc());
        var lastName = Math.round((lastNames.length - 1) * randomFunc());
        var number_of_assets = Math.round(10 * randomFunc());
        var birthyear = 1900 + Math.round(randomFunc() * 114);
        var birthmonth = Math.round(randomFunc() * 11);
        var birthday = Math.round(randomFunc() * 29);
        var birthstate = Math.round(randomFunc() * (states.length - 1));
        var residencestate = Math.round(randomFunc() * (states.length - 1));
        var debt = randomFunc() * -1000;
        var income = randomFunc() * 100000;
        var employed = Math.round(randomFunc());
        var person = {
            server_pos: pos,
            last_name: lastNames[lastName], //jshint ignore:line
            first_name: firstNames[firstName], //jshint ignore:line
            number_of_assets: number_of_assets,
            income: income,
            debt: debt,
            birthDate: birthyear + '-' + months[birthmonth] + '-' + days[birthday],
            birthState: states[birthstate],
            residenceState: states[residencestate],
            employed: employed === 1

        };
        return person;
    };

    for (var i = 0; i < numRows; i++) {
        data.push(randomPerson(i));
    }
    return data;
}

function setupDB(max) {
    return generateRows(max);
}

function getRows(start, end) {
    var result = [];

    start = Math.max(start, 0);
    start = Math.min(start, NUM_OF_ROWS);
    end = Math.max(end, 0);
    end = Math.min(end, NUM_OF_ROWS);

    if (start >= end) {
        return result;
    }

    for (; start < end; start++) {
        result.push(DB[start]);
    }
    return result;
}
////////////////UPDATES/////////////////

function startSimulatedUpdates() {
    var randomRowToUpdate = function() {
        return Math.floor(Math.random() * NUM_OF_ROWS);
    };
    var numberOfRowsToUpdate = function() {
        return Math.floor(Math.random() * NUM_OF_ROWS_UPDATING);
    };
    var updateRows = function() {
        //console.log("tick");
        for (var i = 0; i < numberOfRowsToUpdate(); i++) {
            var rowNum = randomRowToUpdate();
            DB[rowNum]["employed"] = Math.round(randomFunc()) === 1;
            DB[rowNum]["income"] = randomFunc() * 100000;
            DB[rowNum]["debt"] = randomFunc() * -1000;
            DB[rowNum]["number_of_assets"] = Math.round(10 * randomFunc());
        }
    };
    return setInterval(updateRows, UPDATE_PERIOD);
}


////////////////ROUTES//////////////////
app.use('/', express.static(path.join(__dirname, 'public'), {
    maxAge: 0
}));
app.ws('/', function(ws, req) {
    ws.on('message', function(msg) {
        var payload = JSON.parse(msg),
            raw;
        if (payload.initial) {
            raw = handleMetaDataReq();
        } else {
            raw = handleFrameReq(payload)
        }
        ws.send(JSON.stringify(raw));
    })
});

function handleFrameReq(payload) {
    var res = getRows(payload.start, payload.end),
        snippet;
        if (res[0]) {
            snippet = {
                start: res[0].server_pos,
                end: res[res.length - 1].server_pos
            };

            console.log(snippet);
        }
    return res;
}

function handleMetaDataReq(){
    return {dataLen: NUM_OF_ROWS};
}

/////////////////BOOTSTRAPPING/////////////
app.listen(3000);