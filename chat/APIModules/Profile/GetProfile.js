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
        path: '/User/Profile/{userId}',
        handler: function (req, res) {

            myHendler(req, res);
        },
        config: {

            description: 'Get user Details with  jsonwebtoken.',
            notes: 'This API is used to Get user Details with  jsonwebtoken.',
            tags: ['api'],
            validate: {
                params: {
                    userId: Joi.string().description(" UserId"),
                },

                headers: Joi.object({
                    'authorization': Joi.string(),
                    'token': Joi.string(),
                }).unknown(),
            },
            response: {
                status: {
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
    console.log(`\n||||||||||  GET PROFILE API |||||||||||||||||`);
    console.log(`\n||||||||||||||||||||||||||||||||||||||||||||| \n`);
    console.log(`\n*************************************** \n`);
    console.log(" headers " + JSON.stringify(req.headers));
    console.log(`\n----------------------------------------------- \n`);
    console.log(" payload " + JSON.stringify(req.params));
    console.log(`\n----------------------------------------------- \n`);
    console.log("AUTHORIZATION : " + JSON.stringify(req.headers.authorization));
    console.log(`\n***************************************** \n`);

    if (!req.headers.authorization) {
        return res({ code: 100, message: "mandatory headers is missing" }).code(200);
    } else {
        if (req.headers.authorization != conf.authorization) {
            return res({ code: 101, message: "failed to authenticate, headers is Invalid " }).code(200);
        }
    }

    if (!req.params.userId) {
        return res({ code: 102, message: "Mandatory userId is missing" }).code(200);
    }

    if (!req.headers.token) {
        return res({ code: 103, message: "mandatory headers is missing" }).code(200);
    } else {

        jsonwebtoken.verify(req.headers.token, secretKey, function (jwterr, decoded) {
            if (jwterr) {
                console.log("jwterr =>", jwterr);
                return res({ code: 104, message: "failed to authenticate, token is Invalid " }).code(200);
            } else {

                if (decoded.userId == req.params.userId) {
                    console.log("token is valid");

                    tokenIsValid();
                }
            }
        });
    }

    function tokenIsValid() {

        var getUser = { _id: ObjectID(req.params.userId) }

        middleWare.Select("userList", getUser, "Mongo", {}, function (err, result) {
            if (err) {
                return res({ code: 503, message: "Unknown error occurred" }).code(503);
            }
            else if (result.length > 0) {

                var dataToSend = {
                    userName: result[0].userName,
                    profilePic: result[0].profilePic,
                    socialStatus: result[0].socialStatus,
                };

                return res({ code: 200, message: "Success", response: dataToSend }).code(200);
            }
            else {
                return res({ code: 204, message: "User doesn't exist", response: {} }).code(200);
            }
        })

        /**
         * Since Elasticsearch not responding
         */
        // var cond = { "term": { _id: req.params.userId } };

        // middleWare.Select("userList", cond, "ESearch", {}, function (err, result) {
        //     if (err) {

        //         return res({ code: 503, message: "Unknown error occurred" }).code(503);
        //     }
        //     else if (result.hits.hits[0]) {

        //         var dataToSend = {
        //             userName: result.hits.hits[0]._source.userName,
        //             // phoneNumber: result.hits.hits[0]._source.mobileNo,
        //             // countryCode: result.hits.hits[0]._source.countryCode,
        //             profilePic: result.hits.hits[0]._source.profilePic,
        //             socialStatus: result.hits.hits[0]._source.socialStatus,

        //         };

        //         return res({ code: 200, message: "Success", response: dataToSend }).code(200);
        //     }
        //     else {
        //         return res({ code: 204, message: "User doesn't exist", response: {} }).code(200);
        //     }
        // })
    }

}

