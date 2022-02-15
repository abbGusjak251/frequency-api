const { randomBytes } = require('crypto');
const { exec } = require('child_process');
const express = require('express');
const fs = require('fs');
const app = express();
const PORT = 5000;
let keys = {};

function genKey() {
    let key = "";
    do {
        key = randomBytes(8).toString('hex');
    } while(keys[key]);
    keys[key] = {answer: 0};
    return key;
}

function removeFile(file) {
    try {
        fs.unlinkSync(__dirname + '/sounds/' + file + '.ogg')
    } catch(err) {
        console.error(err);
    }
}

function createSound(freq, fname) {
    console.log(freq);
    return new Promise(function(resolve, reject) {
        exec(__dirname + '/sox/sox -n ' + __dirname + '/sounds/' + fname + '.ogg synth 3 sine ' + freq + ' gain -3', (error, stdout, stderr) => {
            if (error) {
                reject(error);
                return;
            }

            resolve(stdout.trim());
        });
    });
}

app.get('/get-freq', (req, res) => {
    if(req.query.name && req.query.secret) {
        console.log(keys);
        let name = req.query.name;
        let secret = req.query.secret;
        let rawdata = fs.readFileSync('users.json');
        let users = JSON.parse(rawdata);
        if(users[name]) {
            if(users[name]["secret"] == secret) {
                let key = genKey();
                res.status(200).json({key: key}).send("Success");
            }
        } else {
            users[name] = {secret: secret, points: 0};
            fs.writeFileSync('users.json', JSON.stringify(users));
            let key = genKey();
            res.status(200).json({key: key}).send("Success"); 
        }
        return res.status(401).send("Bad Auth");
    }
    return res.status(400).send("Bad Request");

});
app.get('/get-audio', (req, res) => {
    let key = req.query.key;
    let freq = 500 + Math.round(Math.random()*( 1000 ) + Math.round(Math.random()*2000) + Math.round(Math.random()*500) + Math.round(Math.random()*1500));
    if(Math.random() > .6) {
        freq += Math.round(Math.random()*3000);
    }
    try {
        keys[key]["answer"] = freq;
    } catch(err) {
        console.log(err);
        return res.status(401).send("Bad Auth");
    }
    console.log(freq);
    let fname = randomBytes(8).toString('hex');
    createSound(freq, fname).then(() => {
        setTimeout(() => {
            removeFile(fname);
        }, 10000);
        res.sendFile(__dirname + "/sounds/" + fname + ".ogg");
    });
});
app.get('/guess', (req, res) => {
    if(req.query.name && req.query.secret) {
        if(!keys[req.query.key]) return res.status(300).send("Bad Key");
        let name = req.query.name;
        let secret = req.query.secret;
        let rawdata = fs.readFileSync('users.json');
        let users = JSON.parse(rawdata);
        if(users[name]) {
            if(users[name]["secret"] == secret) {
                let freq = keys[req.query.key]["answer"];
                delete keys[req.query.key];
                let guess = req.query.guess;
                let diff;
                if(guess > freq) {
                    diff = (guess-freq)/freq;
                } else {
                    diff = (freq-guess)/freq;
                }
                let point = false;
                if(diff < 0.1) {
                    users[name]["points"] += 1;
                    point = true;
                }
                fs.writeFileSync('users.json', JSON.stringify(users));
                return res.status(200).json({diff: diff, point: point, freq: freq}).send();
            }
        }
        return res.status(401).send("Bad Auth");
    }
    return res.status(400).send("Bad Request");

});
app.get('/leaderboard', (req, res) => {
    let rawdata = fs.readFileSync('users.json');
    let users = JSON.parse(rawdata);
    let keys = Object.keys(users);
    let sorted = [];
    keys.sort((a, b) => {
        return users[a]["points"] - users[b]["points"];
    }); 
    keys.forEach((key) => {
        sorted.push(users[key]);
    });
    res.send(sorted.reverse());
});

app.listen(PORT, () => console.log("Listening on port", PORT));