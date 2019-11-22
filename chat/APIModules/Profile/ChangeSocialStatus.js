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
                    return reply({ code: 101, message: "mandatory headers is missing" }).code(200);
                } else {
                    if (req.headers.authorization != conf.authorization) {
                        return reply({ code: 102, message: "failed to authenticate, headers is Invalid " }).code(200);
                    }
                }

                if (!req.headers.token) {
                    return reply({ code: 104, message: "mandatory headers is missing" }).code(200);
                } else {

                    jsonwebtoken.verify(req.headers.token, secretKey, function (jwterr, decoded) {
                        if (jwterr) {
                            console.log("jwterr =>", jwterr);
                            return reply({ code: 105, message: "failed to authenticate, token is Invalid " }).code(200);
                        } else {
                            tokenIsValid(decoded);
                        }
                    });
                }

                function tokenIsValid(decoded) {

                    var _id = decoded.userId;

                    async.parallel([
                        // function (callback) {
                        //     middleWare.Update("userList", { socialStatus: req.payload.socialStatus }, _id, "ESearch", function (err, result) {
                        //         callback(err, result);
                        //     });
                        // },
                        function (callback) {
                            console.log("1111 ",req.payload.socialStatus);
                            if (req.payload.socialStatus == "" || req.payload.socialStatus == null || req.payload.socialStatus == undefined) {
                                console.log("In unset");
                                middleWare.UpdateWithPush("userList", { $unset: { socialStatus: "" } }, { _id: objectId(_id) }, "Mongo", function (err, result) {
                                    callback(err, result);
                                });
                            } else {
                                console.log("2222");
                                middleWare.Update("userList", { socialStatus: req.payload.socialStatus }, { _id: objectId(_id) }, "Mongo", function (err, result) {
                                    callback(err, result);
                                });
                            }

                        },
                        function (callback) {
                            middleWare.Select("userList", { _id: objectId(_id) }, "Mongo", {}, function (err, result) {
                                if (result[0].existInUsers) {
                                    for (index = 0; index < result[0].existInUsers.length; index++) {
                                        ComnFun.publishMqtt("UserUpdate/" + result[0].existInUsers[index], JSON.stringify({
                                            socialStatus: req.payload.socialStatus, type: 1,
                                            number: result[0].number, userId: _id
                                        }));
                                    }
                                    callback(err, result);
                                } else {
                                    callback(err, result);
                                }

                            });
                        }
                    ], function (err, result) {
                        switch (err) {
                            case undefined || null: {


                                return reply({ code: 200, message: "Data Successfully Update" }).code(200);
                                break;
                            }
                            default: {
                                console.log("Error : ", err);
                                return reply({ code: 503, message: "DB Error" }).code(503);
                            }
                        }

                    });
                }
            },
            validate: {
                payload: {
                    socialStatus: Joi.string()
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
            description: 'Update user Social Status.',
            notes: 'Checks the email and password and if correct logs in. Header input: Basic aG91c2U6ZVNTNzlCakVncVlYbmlXNHJTYzI3UDdMOUcyN2p3WFFZMlA0dGZCZW5tekcwb21iRnVKZVNYQ2pYQ3JaNVAwOGIxODBRc3RROTE2ZWtqS3FpZDBMTWRHMmRLTmk1cDRBS1FiSUUxUFZFcnF1RTJuYUx6U0JxR1dYT0hFd0pmR2hKb2daNzdTT0lJYXdEQVpIM1JhUDlablZwQ0NxRVZJRHZRY1ZYaFFRS0tIcTRQaktsRmlubHVkbzBoOXQ3RE9UUklyMndqNmZXV1VHWmZyUTc4UVFURFBTbm1vTFB0U0FhbWxWbEZHZW5waGZYR1dTNks2QTJkQW1nSjlwcTZmbg==',
            tags: ['api']
        }

    }
];

