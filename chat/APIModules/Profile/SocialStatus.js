const Joi = require('joi');
var jsonwebtoken = require('jsonwebtoken');
var ComnFun = require('../../ComnFun.js');
var conf = require('../../conf.json');
var secretKey = conf.secretKey;
var middleWare = require("../../Controller/dbMiddleware.js");
var phoneUtil = require('google-libphonenumber').PhoneNumberUtil.getInstance();
var async = require("async");
var objectId = require("mongodb").ObjectID;


module.exports = [
    {
        method: 'PUT',
        path: '/User/SocialStatus',
        config: {
            handler: function (req, reply) {

                
                if (!req.headers.authorization) {
                    return reply({ message: "mandatory headers is missing" }).code(406);
                } else {
                    if (req.headers.authorization != conf.authorization) {
                        return reply({ message: "failed to authenticate, headers is Invalid " }).code(401);
                    }
                }

                if (!req.payload.socialStatus) {
                    return reply({ message: "mandatory socialStatus is missing" }).code(400);
                }

                if (!req.headers.token) {
                    return reply({ message: "mandatory headers is missing" }).code(406);
                } else {

                    jsonwebtoken.verify(req.headers.token, secretKey, function (jwterr, decoded) {
                        if (jwterr) {
                            console.log("jwterr =>", jwterr);
                            return reply({ message: "failed to authenticate, token is Invalid " }).code(401);
                        } else {
                            tokenIsValid(decoded);
                        }
                    });
                }
                function tokenIsValid(decoded) {
                    var number = decoded.number;
                    var countryCode = decoded.countryCode;
                    var _id = decoded._id;

                    // function (callback) {
                    //     middleWare.Update("userList", { socialStatus: req.payload.socialStatus }, _id, "ESearch", function (err, result) {
                    //         callback(err, result);
                    //     });
                    // },
                    async.parallel([

                        function (callback) {
                            
                            middleWare.Update("userList", { socialStatus: req.payload.socialStatus }, { _id: objectId(_id) }, "Mongo", function (err, result) {
                                callback(err, result);
                            });
                        }
                    ], function (err, result) {

                        if (err) {
                            console.log("Error : ", err);
                            return reply({ message: "DB Error" }).code(500);
                        } else {
                            ComnFun.publishMqtt("UserUpdate/1/" + _id, JSON.stringify({ socialStatus: req.payload.socialStatus }));
                            return reply({ message: "Data Successfully Update" }).code(200);
                        }
                    });
                }
            },
            validate: {
                payload: {
                    socialStatus: Joi.string().default("Status")
                },
                headers: Joi.object({
                    'authorization': Joi.string(),
                    'token': Joi.string(),
                }).unknown()
            },
            plugins: {
                'hapi-swagger': {
                    responses: {
                        '200': {
                            'description': 'Success',
                        },
                        '400': {
                            'description': 'Bad requset'
                        },
                        '404': {
                            'description': 'Not found'
                        },
                        '422': {
                            'description': 'Email already exists'
                        }
                    }
                }

            },
            description: 'User Authentication',
            notes: 'Checks the email and password and if correct logs in. Header input: Basic aG91c2U6ZVNTNzlCakVncVlYbmlXNHJTYzI3UDdMOUcyN2p3WFFZMlA0dGZCZW5tekcwb21iRnVKZVNYQ2pYQ3JaNVAwOGIxODBRc3RROTE2ZWtqS3FpZDBMTWRHMmRLTmk1cDRBS1FiSUUxUFZFcnF1RTJuYUx6U0JxR1dYT0hFd0pmR2hKb2daNzdTT0lJYXdEQVpIM1JhUDlablZwQ0NxRVZJRHZRY1ZYaFFRS0tIcTRQaktsRmlubHVkbzBoOXQ3RE9UUklyMndqNmZXV1VHWmZyUTc4UVFURFBTbm1vTFB0U0FhbWxWbEZHZW5waGZYR1dTNks2QTJkQW1nSjlwcTZmbg==',
            tags: ['api']
        }

    }
];

