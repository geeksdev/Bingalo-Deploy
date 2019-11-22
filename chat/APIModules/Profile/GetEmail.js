var jsonwebtoken = require('jsonwebtoken');
var conf = require('../../conf');
var confAAA = require('../../Controller/dbMiddleware.js');
var secretKey = conf.secretKey;
var ObjectID = require('mongodb').ObjectID
var Joi = require('joi');
var middleWare = require("../../Controller/dbMiddleware.js");


module.exports = [
    {

        method: 'GET',
        path: '/Email/{fIberUUId}',
        handler: function (req, res) {

            myHendler(req, res);
        },
        config: {

            description: 'Get user Details with  jsonwebtoken.',
            notes: 'This API is used to Get user Details with  jsonwebtoken.',
            tags: ['api'],
            validate: {
                headers: Joi.object({
                    'authorization': Joi.string(),
                    'cCode': Joi.string().default("+91"),
                    'mob': Joi.string().default("1234567890"),
                }).unknown(),
            },
            response: {
                status: {
                    200: { message: Joi.any(), data: Joi.any() },
                    400: { message: Joi.any().description("Mandatory feild is missing") },
                    401: { message: Joi.any().description("headers is Invalid") },
                    406: { message: Joi.any() },
                    409: { message: Joi.any().description("User already exists use other email id to signUp") },
                    503: { message: Joi.any() },

                },

            },
        },

    }];


function myHendler(req, res) {



    console.log(`\n|||||||||||||||||||||||||||||||||||||||||||||`);
    console.log(`\n||||||||||  GET EMAIL API |||||||||||||||||`);
    console.log(`\n||||||||||||||||||||||||||||||||||||||||||||| \n`);
    console.log(`\n*************************************** \n`);
    console.log(" headers " + JSON.stringify(req.headers));
    console.log(`\n----------------------------------------------- \n`);
    console.log("AUTHORIZATION : " + JSON.stringify(req.headers.authorization));
    console.log(`\n***************************************** \n`);

    if (!req.headers.authorization) {
        return res({ message: "mandatory headers is missing" }).code(406);
    } else {
        if (req.headers.authorization != conf.authorization) {
            return res({ message: "failed to authenticate, headers is Invalid " }).code(401);
        }
    }
    if (!req.headers.cCode) {
        return res({ message: "Mandatory cCode is missing" }).code(400);
    }
    if (!req.headers.mob) {
        return res({ message: "Mandatory mob is missing" }).code(400);
    }



    var cond = [
        { "term": { "mobileno": req.headers.mob } },
        { "term": { "countrycode": req.headers.cCode } }
    ];

    middleWare.Select("users", cond, "ESearch", {}, function (err, result) {
        if (err) {

            return res({ message: "Unknown error occurred" }).code(503);
        }
        else if (result) {
            console.log("in success ", result);
            var email = result.hits.hits[0]["_source"].email;

            return res({ message: "SUCCESS", data: { email: email } }).code(200);
        }
        else {
            return res({ message: "Mobile Number Not Found.", data: {} }).code(200);
        }
    })


}

