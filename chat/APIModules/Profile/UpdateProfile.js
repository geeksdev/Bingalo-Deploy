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
        path: '/User/Profile',
        config: {
            handler: function (req, reply) {
                updateProfileHandler(req, reply)
            },
            validate: {
                payload: {
                    deviceId: Joi.string().description("deviceId is required").allow(''),
                    deviceType: Joi.number().description("deviceType is required").allow(''),
                    deviceModel: Joi.string().description("deviceModel is required").allow(''),
                    deviceMake: Joi.string().description("deviceMake is required").allow(''),
                    deviceOs: Joi.string().description("deviceOs is required").allow(''),
                    pushToken: Joi.string().description("pushToken is required").allow(''),
                    appVersion: Joi.string().description("appVersion is required").allow(''),
                    profilePic: Joi.string().description("profilePic is required").allow(''),
                    userName: Joi.string().description("userName is required"),
                    versionCode: Joi.number().description("versionCode is required").allow(''),
                },
                headers: Joi.object({
                    'authorization': Joi.string().description("authorization is required"),
                    'token': Joi.string().description("token is required"),
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
                        '409': {
                            'description': 'Duplicate'
                        },
                        '422': {
                            'description': 'Unprocessable Entity'
                        },
                        '500': {
                            'description': 'Internal Server Error'
                        }

                    }
                }

            },
            description: 'Update user profile details.',
            notes: 'Header input: Basic aG91c2U6ZVNTNzlCakVncVlYbmlXNHJTYzI3UDdMOUcyN2p3WFFZMlA0dGZCZW5tekcwb21iRnVKZVNYQ2pYQ3JaNVAwOGIxODBRc3RROTE2ZWtqS3FpZDBMTWRHMmRLTmk1cDRBS1FiSUUxUFZFcnF1RTJuYUx6U0JxR1dYT0hFd0pmR2hKb2daNzdTT0lJYXdEQVpIM1JhUDlablZwQ0NxRVZJRHZRY1ZYaFFRS0tIcTRQaktsRmlubHVkbzBoOXQ3RE9UUklyMndqNmZXV1VHWmZyUTc4UVFURFBTbm1vTFB0U0FhbWxWbEZHZW5waGZYR1dTNks2QTJkQW1nSjlwcTZmbg==',
            tags: ['api']
        }

    }
];

function updateProfileHandler(req, reply) {

    var isDeleteProfile = false, isUnserProfile = false

    async.waterfall([
        function (validateCB) {
            if (!req.headers.authorization) {
                return reply({ code: 101, message: "mandatory headers is missing" }).code(200);
            } else {
                if (req.headers.authorization != conf.authorization) {
                    return reply({ code: 102, message: "failed to authenticate, headers is Invalid " }).code(200);
                }
            }
            if (!req.payload.profilePic || req.payload.profilePic == "null") {
                isDeleteProfile = true;
                delete req.payload.profilePic;
            }
            if (!req.payload.userName) return reply({ code: 103, message: "mandatory userName  is missing" }).code(200);
            if (!req.headers.token) {
                return reply({ code: 104, message: "mandatory headers is missing" }).code(200);
            } else {
                jsonwebtoken.verify(req.headers.token, secretKey, function (jwterr, decoded) {
                    if (jwterr) {
                        console.log("jwterr =>", jwterr);
                        return reply({ code: 105, message: "failed to authenticate, token is Invalid " }).code(200);
                    } else {
                        console.log("decoded ", decoded);
                        console.log("req.headers.token ", req.headers.token);
                        validateCB(null, decoded);
                    }
                });
            }

        },
        function (decoded, funcMainCB) {
            var _id = decoded.userId;
            var dataToSave = {
                deviceId: req.payload.deviceId,
                deviceType: parseInt(req.payload.deviceType),
                deviceModel: req.payload.deviceModel,
                deviceMake: req.payload.deviceMake,
                deviceOs: req.payload.deviceOs,
                pushToken: req.payload.pushToken,
                appVersion: req.payload.appVersion,
                userName: req.payload.userName,
                versionCode: parseInt(req.payload.versionCode)
            };

            var mqttProfilePic = "";
            if (req.payload.profilePic) {
                dataToSave.profilePic = req.payload.profilePic;
                mqttProfilePic = req.payload.profilePic;
            }


            async.series([
                function (callback) {
                    middleWare.Select("userList", { _id: objectId(_id) }, "Mongo", {}, function (err, result) {
                        if (req.payload.profilePic || isDeleteProfile) {
                            if (typeof result[0].existInUsers != 'undefined') {
                                for (index = 0; index < result[0].existInUsers.length; index++) {
                                    ComnFun.publishMqtt("UserUpdate/" + result[0].existInUsers[index], JSON.stringify({
                                        profilePic: req.payload.profilePic, type: 2,
                                        number: result[0].number, userId: _id, profilePic: mqttProfilePic
                                    }));
                                }
                                if (isDeleteProfile && result[0].profilePic && result[0].profilePic != req.payload.profilePic) {
                                    if (req.payload.profilePic == null || req.payload.profilePic == undefined) {
                                        isUnserProfile = true;
                                    }

                                    try {
                                        var fs = require('fs');
                                        var filePath = result[0].profilePic;

                                        filePath = filePath.replace(/http:\/\/104.236.32.23/gi, "/var/www/html");
                                        console.log("file Deleted suucessfully.", filePath);
                                        if (fs.existsSync(filePath)) {
                                            fs.unlinkSync(filePath);
                                            console.log("file Deleted suucessfully.", filePath);
                                        }

                                    } catch (exception) {
                                        console.log("File delete exception : ", exception);
                                    }
                                }
                                callback(err, result);
                            } else {
                                callback(err, result);
                            }
                        } else {
                            callback(err, result);
                        }
                    });
                },
                function (callback) {
                    if (isUnserProfile) {
                        console.log("in isUnserProfile");
                        middleWare.UpdateWithPush("userList", { $unset: { profilePic: "" } }, { _id: objectId(_id) }, "Mongo", function (err, result) {
                            callback(err, "done");
                        });
                    } else {
                        callback(null, "done");
                    }
                },
                function (callback) {
                    middleWare.Update("userList", dataToSave, { _id: objectId(_id) }, "Mongo", function (err, result) {
                        callback(err, "done");
                    });
                }
            ], function (err, result) {
                if (err) return reply({ code: 503, message: err.message }).code(503);
                return reply({ code: 200, message: "Data Successfully Updated" }).code(200);
            });
        }
    ]);
}

