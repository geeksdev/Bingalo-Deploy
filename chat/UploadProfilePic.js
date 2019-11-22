
var mqtt = require('mqtt'); //includes mqtt server 
var express = require('express');
var app = express();
var fs = require('fs');

app.listen(8009);


var multer = require('multer');

var storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, '/var/www/html/YeloChat/profilePics')
    },
    filename: function (req, file, cb) {
        cb(null, file.originalname)
    }
})

var upload = multer({ storage: storage, limits: { fieldSize: 25 * 1024 * 1024 } });


var bodyParser = require('body-parser');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());


var storage = multer.diskStorage({
            destination: function (req, file, cb) {
                cb(null, '/var/www/html/YeloChat/profilePics')
            },
            filename: function (req, file, cb) {
                cb(null, file.originalname)
            }
        });
var upload1 = multer({ storage: storage, limits: { fieldSize: 25 * 1024 * 1024 } });



app.post('/upload/profile', upload1.single('photo'), function (req, res, next) {
    if (req)
        console.log(req.file);

    if (res) {

        return res.json({
            code: 200,
            url : req.file.path 
        });
        console.log("Done")
    }

});

app.post('/upload', upload.single('photo'), function (req, res, next) {
    if (req)
        console.log(req.file);

    if (res) {

        return res.json({
            code: 200,
            url : req.file.path
        });
        console.log("Done")
    }

});
