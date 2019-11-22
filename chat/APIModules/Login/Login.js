const Joi = require('joi');
var jsonwebtoken = require('jsonwebtoken');
var conf = require('../../conf.json');
var secretKey = conf.secretKey;
var middleWare = require("../../Controller/dbMiddleware.js");
var objectId = require("mongodb").ObjectID;

var ComnFun = require('../../ComnFun.js');


module.exports = [
    {
        method: 'POST',
        path: '/User/Login',
        config: {
            handler: function (req, reply) {
                /**
                 * here we check all mendatory fields
                 */
                if (!req.headers.authorization) {
                    return reply({ message: "mandatory headers is missing" }).code(406);
                } else {
                    if (req.headers.authorization != conf.authorization) {
                        return reply({ message: "failed to authenticate, headers is Invalid " }).code(401);
                    }
                }
                if (!req.payload.manufacturer) {
                    return reply({ Message: "mandatory manufacturer is missing" }).code(400);
                }
                if (!req.payload.os) {
                    return reply({ Message: "mandatory OS is missing" }).code(400);
                }
                if (!req.payload.version) {
                    return reply({ Message: "mandatory Version is missing" }).code(400);
                }
                if (!req.payload.appVersion) {
                    return reply({ Message: "mandatory appVersion is missing" }).code(400);
                }
                if (!req.payload.deviceId) {
                    return reply({ Message: "mandatory DeviceId is missing" }).code(400);
                }

                if (!req.payload.mobileNo) {
                    return reply({ Message: "mandatory mobileNo is missing" }).code(400);
                }
                if (!req.payload.countryCode) {
                    return reply({ Message: "mandatory countryCode is missing" }).code(400);
                }
                if (!req.payload.pushToken) {
                    return reply({ Message: "mandatory PushToken is missing" }).code(400);
                }

                var profilePic = "", socialStatus = "";

                if (req.payload.profilePic) {
                    profilePic = req.payload.profilePic
                }

                if (req.payload.socialStatus) {
                    socialStatus = req.payload.socialStatus
                }

                /**
                 * In number variable take countryCode and MobileNo.
                 * In DeviceLog take some feild likeOS,AppVewresion And so on as requirement.This for take user history.
                 */
                var number = req.payload.countryCode + req.payload.mobileNo;
                var deviceLogs = {
                    manufacturer: req.payload.manufacturer,
                    os: req.payload.os,
                    version: req.payload.version,
                    appVersion: req.payload.appVersion,
                    deviceId: req.payload.deviceId,
                    phNumber: req.payload.mobileNo,
                    countryCode: req.payload.countryCode,
                };
                /**
                 * create randomCode for send to user for OTP.
                 */
                var randomCode = Math.floor(Math.random() * 100000);
                /**
                 * This is Send OTP Function
                 */

                var cond = { "number": number };

                /**
                 * Check requested user is exists in ower db or not.
                 * if yes then push device details in deviceLog.
                 * if no then check in inactiveUserList, 
                 * ** if user exist on inactiveUserList then get DB field as "existInUsers" and send MQTT message to "existInUsers"  for requested new user is now join ower App
                 * ** if user not exists in inactiveUserList then only add user in DB (here DB Maintain in ElasticSearch and mongoDB).
                 * then user call post OTP api to verify account.
                 */
                middleWare.Select("userList", cond, "Mongo", {}, function (err, result) {
                    if (err) {
                        return reply({ data: "unknown error occurred" }).code(500)
                    }
                    else if (result.length) {
                        /**
                         * if Request come here means user exists in ower DB.
                         * then only save OTP,PushToken and deviceLogs
                         */
                        var dataToPush = {
                            $push: { deviceLogs: deviceLogs },
                            $set: { otp: randomCode, pushToken: req.payload.pushToken }
                        };
                        middleWare.UpdateWithPush("userList", dataToPush, cond, "Mongo", function (err, result) {
                            if (err) {
                                console.log("Error : ", err)
                                return reply({ message: "DB Error" }).code(400)
                            } else {
                                return reply({ message: "Login Success" }).code(200)
                            }
                        });
                    }
                    else {
                        /**
                         * if Request come here means requested user not exists in ower DB.
                         * here we find user in inactiveUserList.
                         * if user exist on inactiveUserList then get DB field as "existInUsers" and send MQTT message to "existInUsers"  for requested new user is now join ower App
                         * if user not exists in inactiveUserList then only add user in DB (here DB Maintain in ElasticSearch and mongoDB).
                         * then user call post OTP api to verify account.
                         */

                        condition = [{ "match": { number: number } }, { "match": { number: req.payload.mobileNo } }];
                        middleWare.SelectWithOr("inactiveUserList", condition, "ESearch", {}, function (err, result) {
                            if (err) {
                                return reply({ message: "DB Error" }).code(400)
                            } else if (result.hits.hits[0]) {
                                /**
                                * if user exist on inactiveUserList then get DB field as "existInUsers" and send MQTT message to "existInUsers"  for requested new user is now join ower App
                                * then user call post OTP api to verify account,
                                * and also get "existInUsers" from DB
                                */

                                var sendMQTTMsg_id = result.hits.hits[0]._source.existInUsers;
                                for (index = 0; index < sendMQTTMsg_id.length; index++) {
                                    ComnFun.publishMqtt("user/newJoin/" + sendMQTTMsg_id[index], number + " is now Join");
                                }

                                var _idToDelete = result.hits.hits[0]._id;
                                condition = { _id: _idToDelete };
                                /**
                                 * Go for delete user from inactiveUserList. DB ElasticSearch
                                 */
                                middleWare.Delete("inactiveUserList", condition, "ESearch", function (err, result) {
                                    if (err) {
                                        return reply({ message: "DB Error" }).code(400)
                                    } else {
                                        /**
                                         * Go for delete user from inactiveUserList. DB MongoDB
                                         */
                                        condition = { _id: objectId(_idToDelete) };
                                        middleWare.Delete("inactiveUserList", condition, "Mongo", function (err, result) {
                                            if (err) {
                                                return reply({ message: "DB Error" }).code(400)
                                            } else {

                                                var dataToPush = {
                                                    "deviceLogs": [deviceLogs],
                                                    otp: randomCode,
                                                    countryCode: req.payload.countryCode,
                                                    mobileNo: req.payload.mobileNo,
                                                    number: number,
                                                    pushToken: req.payload.pushToken,
                                                    profilePic: profilePic,
                                                    socialStatus: socialStatus
                                                };
                                                /**
                                                 * Insert new user in MongoDB  
                                                 */
                                                middleWare.Insert("userList", dataToPush, {}, "Mongo", function (err, result) {
                                                    if (err) {
                                                        console.log("Error : ", err)
                                                        return reply({ message: "DB Error -Mongo" }).code(400)
                                                    } else {

                                                        /**
                                                         * Delete DeviceLog from Object, we not store deviceLogs in ElasticSearch.
                                                         * And also Add _id as mongo saved id for this user.so in mongo and elasticSearch both have save id for one user.
                                                         * so it become esy to do any opration in any DB like elasticSearch or MongoDB
                                                         */
                                                        delete dataToPush.deviceLogs;
                                                        dataToPush["_id"] = "" + result.ops[0]._id;

                                                        /**
                                                         * Insert new user in Elastic Search  
                                                         */
                                                        middleWare.Insert("userList", dataToPush, {}, "ESearch", function (err, result) {
                                                            if (err) {
                                                                console.log("Error : ", err)
                                                                return reply({ message: "DB Error -ESearch" }).code(400)
                                                            } else {
                                                                console.log("insert by inactiveList");
                                                                return reply({ message: "Login Success" }).code(201);
                                                            }
                                                        });

                                                    }
                                                });


                                            }
                                        });

                                    }
                                });
                            }
                            else {
                                /**
                                 * Insert new user in MongoDB  
                                 */
                                var dataToPush = {
                                    "deviceLogs": [deviceLogs],
                                    otp: randomCode,
                                    countryCode: req.payload.countryCode,
                                    mobileNo: req.payload.mobileNo,
                                    number: number,
                                    pushToken: req.payload.pushToken,
                                    profilePic: profilePic,
                                    socialStatus: socialStatus
                                };

                                middleWare.Insert("userList", dataToPush, {}, "Mongo", function (err, result) {
                                    if (err) {
                                        console.log("Error : ", err)
                                        return reply({ message: "DB Error -Mongo" }).code(400)
                                    } else {
                                        /**
                                          * Delete DeviceLog from Object, we not store deviceLogs in ElasticSearch.
                                          * And also Add _id as mongo saved id for this user.so in mongo and elasticSearch both have save id for one user.
                                          * so it become esy to do any opration in any DB like elasticSearch or MongoDB
                                          */

                                        delete dataToPush.deviceLogs;
                                        dataToPush["_id"] = "" + result.ops[0]._id;

                                        /**
                                          * Insert new user in Elastic Search  
                                          */
                                        middleWare.Insert("userList", dataToPush, {}, "ESearch", function (err, result) {
                                            if (err) {
                                                console.log("Error : ", err)
                                                return reply({ message: "DB Error -ESearch" }).code(400)
                                            } else {
                                                return reply({ message: "Login Success" }).code(201);
                                            }
                                        });

                                    }
                                });
                            }
                        });

                    }
                });

            },
            validate: {
                payload: {
                    manufacturer: Joi.string().description("manufacturer is required"),
                    os: Joi.string().description("OS is required"),
                    version: Joi.string().description("Version is required"),
                    appVersion: Joi.string().description("appVersion is required"),
                    deviceId: Joi.string().description("DeviceId is required"),
                    dateTime: Joi.string().description("DateTime is required"),
                    mobileNo: Joi.string().description("PhNumber is required"),
                    countryCode: Joi.string().description("CountryCode is required"),
                    pushToken: Joi.string().description("PushToken is required"),
                    profilePic: Joi.string().description("profilePic"),
                    socialStatus: Joi.string().description("socialStatus"),
                },
                headers: Joi.object({
                    'authorization': Joi.string()
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

    },
    {
        method: 'POST',
        path: '/User/LoginWithEmail',
        handler: function (req, res) {
            console.log('LoginWithEmailHandler')
            LoginWithEmailHandler(req, res)
        },
        config: {
            validate: {
                payload: {
                    deviceMake: Joi.string().description("deviceMake is required"),
                    deviceType: Joi.number().description("deviceType is required"),
                    deviceModel: Joi.string().description("deviceModel is required"),
                    email: Joi.string().description("Email is required"),
                    password: Joi.string().description("Password is required"),
                    deviceOs: Joi.string().description("deviceOs is required"),
                    versionCode: Joi.number().description("versionCode is required"),
                    appVersion: Joi.string().description("appVersion is required"),
                    deviceId: Joi.string().description("DeviceId is required"),
                    pushToken: Joi.string().description("PushToken is required").allow(''),
                    userName: Joi.string().description("userName is required"),
                },
                headers: Joi.object({
                    'authorization': Joi.string()
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
            notes: 'Checks the email and password and if correct logs in. Header input: KMajNKHPqGt6kXwUbFN3dU46PjThSNTtrEnPZUefdasdfghsaderf1234567890ghfghsdfghjfghjkswdefrtgyhdfghj',
            tags: ['api']
        },

    },
    {
        method: 'POST',
        path: '/User/SignupWithEmail',
        handler: function (req, res) {
            SignupWithEmailHandler(req, res)
        },
        config: {
            description: 'Login with email',
            notes: 'Login with email. Header input: KMajNKHPqGt6kXwUbFN3dU46PjThSNTtrEnPZUefdasdfghsaderf1234567890ghfghsdfghjfghjkswdefrtgyhdfghj',
            tags: ['api'],
            validate: {
                payload: {
                    email: Joi.string().description("Email is required"),
                    password: Joi.string().description("Email is required"),
                    userName: Joi.string().description("userName is required"),
                    deviceMake: Joi.string().description("deviceMake is required"),
                    deviceType: Joi.number().description("deviceType is required"),
                    deviceModel: Joi.string().description("deviceModel is required"),
                    deviceOs: Joi.string().description("deviceOs is required"),
                    versionCode: Joi.number().description("versionCode is required"),
                    appVersion: Joi.string().description("appVersion is required"),
                    deviceId: Joi.string().description("DeviceId is required"),
                    pushToken: Joi.string().description("PushToken is required").allow('')
                },
                headers: Joi.object({
                    'authorization': Joi.string()
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

            }
        },

    },
    {
        method: 'POST',
        path: '/User/verifyEmail',
        handler: function (req, res) {
            /** Call the handler function */
            verifyEmailHandler(req, res);
        },
        config: {
            description: 'Email exixtance check',
            notes: 'Checks the email exists in db. Header input: Basic aG91c2U6ZVNTNzlCakVncVlYbmlXNHJTYzI3UDdMOUcyN2p3WFFZMlA0dGZCZW5tekcwb21iRnVKZVNYQ2pYQ3JaNVAwOGIxODBRc3RROTE2ZWtqS3FpZDBMTWRHMmRLTmk1cDRBS1FiSUUxUFZFcnF1RTJuYUx6U0JxR1dYT0hFd0pmR2hKb2daNzdTT0lJYXdEQVpIM1JhUDlablZwQ0NxRVZJRHZRY1ZYaFFRS0tIcTRQaktsRmlubHVkbzBoOXQ3RE9UUklyMndqNmZXV1VHWmZyUTc4UVFURFBTbm1vTFB0U0FhbWxWbEZHZW5waGZYR1dTNks2QTJkQW1nSjlwcTZmbg==',
            tags: ['api'],
            validate: {
                payload: {
                    email: Joi.string().description("email id")
                },
                headers: Joi.object({
                    'authorization': Joi.string()
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

            }
        },

    },
    {
        method: 'GET',
        path: '/User',
        handler: function (req, res) {
            /** Call the handler function */
            getUsersHandler(req, res);
        },
        config: {
            description: 'List all the app users',
            notes: 'List all the app users. Header input: KMajNKHPqGt6kXwUbFN3dU46PjThSNTtrEnPZUefdasdfghsaderf1234567890ghfghsdfghjfghjkswdefrtgyhdfghj',
            tags: ['api'],
            validate: {
                headers: Joi.object({
                    'authorization': Joi.string()
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

            }
        },

    }
];



/**
 * Check wheather the specified email id exists in the userList collection or not
 */
function verifyEmailHandler(req, reply) {

    if (typeof req.payload.email === 'undefined')
        return reply({ code: 400, message: 'Email is missing' }).code(400);

    middleWare.Select("userList", { email: req.payload.email }, "Mongo", {}, function (err, doc) {
        console.log('doc', doc)
        if (err)
            return reply({ code: 500, message: 'Database error' }).code(500)

        if (doc.length > 0)
            return reply({ code: 200, message: 'Signup' }).code(200)

        return reply({ code: 201, message: 'Signup' }).code(201)
    })

}


function SignupWithEmailHandler(req, reply) {

    console.log('SignupWithEmailHandler')

    if (typeof req.payload.email === 'undefined')
        return reply({ code: 400, message: 'Email is missing' }).code(400);

    if (typeof req.payload.password === 'undefined')
        return reply({ code: 400, message: 'Password is missing' }).code(400);

    if (typeof req.payload.userName === 'undefined')
        return reply({ code: 400, message: 'Name is missing' }).code(400);

    var doc_mongoid = objectId()
    var token = jsonwebtoken.sign({ userId: doc_mongoid.toString() }, secretKey, { expiresIn: '14 days' });

    console.log('b4 insert');
    middleWare.Insert("userList",
        {
            _id: doc_mongoid,
            email: req.payload.email,
            password: req.payload.password,
            userName: req.payload.userName,
            deviceOs: req.payload.deviceOs,
            appVersion: req.payload.appVersion,
            deviceId: req.payload.deviceId,
            pushToken: req.payload.pushToken,
            versionCode: req.payload.versionCode,
            deviceMake: req.payload.deviceMake,
            deviceType: req.payload.deviceType,
            deviceModel: req.payload.deviceModel
        },
        {},
        "Mongo", function (err, insRes) {

            if (err)
                return reply({ code: 500, message: 'Database error' }).code(500);

            return reply({ code: 200, message: 'Success', data: { userId: doc_mongoid.toString(), token: token } });
        });

}


function LoginWithEmailHandler(req, reply) {
    /**
     * here we check all mendatory fields
     */

    if (!req.headers.authorization) {
        return reply({ message: "mandatory headers is missing" }).code(406);
    } else {
        if (req.headers.authorization != conf.authorization) {
            return reply({ message: "failed to authenticate, headers is Invalid " }).code(401);
        }
    }

    // email, deviceOs, appVersion, deviceId, pushToken, versionCode, deviceMake, deviceType, deviceModel
    if (!req.payload.email) {
        return reply({ Message: "mandatory email is missing" }).code(400);
    }

    if (!req.payload.deviceMake) {
        return reply({ Message: "mandatory manufacturer is missing" }).code(400);
    }

    if (!req.payload.deviceOs) {
        return reply({ Message: "mandatory OS is missing" }).code(400);
    }

    if (!req.payload.versionCode) {
        return reply({ Message: "mandatory Version is missing" }).code(400);
    }

    if (!req.payload.appVersion) {
        return reply({ Message: "mandatory appVersion is missing" }).code(400);
    }

    if (!req.payload.deviceId) {
        return reply({ Message: "mandatory DeviceId is missing" }).code(400);
    }

    if (!req.payload.deviceType) {
        return reply({ Message: "mandatory PushToken is missing" }).code(400);
    }

    if (!req.payload.deviceModel) {
        return reply({ Message: "mandatory PushToken is missing" }).code(400);
    }

    var profilePic = "", socialStatus = "";

    if (req.payload.profilePic) {
        profilePic = req.payload.profilePic
    }

    if (req.payload.socialStatus) {
        socialStatus = req.payload.socialStatus
    }

    var cond = { email: req.payload.email };

    /**
     * Check if the email exists or not
     */
    middleWare.Select("userList", cond, "Mongo", {}, function (err, result) {
        if (err) {
            return reply({ data: "unknown error occurred" }).code(500)
        }
        else if (result.length) {
            /**
             * User exists in DB. Update
             */
            var token = jsonwebtoken.sign({ userId: result[0]._id.toString() }, secretKey, { expiresIn: '14 days' });

            var dataToPush = {
                $set: {
                    deviceOs: req.payload.deviceOs,
                    version: req.payload.version,
                    appVersion: req.payload.appVersion,
                    deviceId: req.payload.deviceId,
                    pushToken: req.payload.pushToken,
                    versionCode: req.payload.versionCode,
                    deviceMake: req.payload.deviceMake,
                    deviceType: req.payload.deviceType,
                    deviceModel: req.payload.deviceModel
                }
            };
            middleWare.UpdateWithPush("userList", dataToPush, cond, "Mongo", function (err, upRes) {
                if (err) {
                    return reply({ message: "DB Error" }).code(400)
                } else {
                    return reply({
                        code: 200,
                        message: "Login Success", data: {
                            userId: result[0]._id.toString(),
                            userName: result[0].userName,
                            token: token
                        }
                    }).code(200)
                }
            });

        } else {
            /**
             * New user to be created
             */

            return reply({
                code: 201,
                message: "Login Failed", data: {}
            }).code(201);

            // var doc_mongoid = objectId()
            // var token = jsonwebtoken.sign({ userId: doc_mongoid.toString() }, secretKey, { expiresIn: '14 days' });

            // var dataToPush = {
            //     _id: doc_mongoid,
            //     email: req.payload.email,
            //     deviceOs: req.payload.deviceOs,
            //     versionCode: req.payload.versionCode,
            //     appVersion: req.payload.appVersion,
            //     deviceId: req.payload.deviceId,
            //     pushToken: req.payload.pushToken,
            //     deviceMake: req.payload.deviceMake,
            //     deviceType: req.payload.deviceType,
            //     deviceModel: req.payload.deviceModel
            // };

            // middleWare.Insert("userList", dataToPush, {}, "Mongo", function (err, result) {
            //     if (err) {
            //         return reply({ message: "DB Error -Mongo" }).code(400)
            //     } else {

            //         return reply({
            //             message: "Login Failed", data: {}
            //         }).code(201);
            //     }
            // });

        }
    });

}

function getUsersHandler(req, reply) {

    middleWare.Select("userList", {}, "Mongo", {}, function (err, result) {
        if (err) {
            return reply({ code: 500, message: 'Database error' }).code(500)
        } else if (result.length) {
            return reply({ code: 200, message: 'Success', data: result });
        }
    })

}
