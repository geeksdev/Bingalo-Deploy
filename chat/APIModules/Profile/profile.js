const Joi = require('joi');
var jsonwebtoken = require('jsonwebtoken');
var ComnFun = require('../../ComnFun.js');
var conf = require('../../conf.json');
var secretKey = conf.secretKey;
var middleWare = require("../../Controller/dbMiddleware.js");
var phoneUtil = require('google-libphonenumber').PhoneNumberUtil.getInstance();
var async = require("async");
var objectId = require("mongodb").ObjectID;
var dbConfig = require("../../Controller/dbConfig.js");

module.exports = [
    {
        method: 'PUT',
        path: '/profile',
        config: {
            handler: function (req, reply) {
                updateProfileHandler(req, reply)
            },
            validate: {
                payload: {
                    token: Joi.string().description("token is required"),
                    profilePic: Joi.string().description("profilePic is required").allow(''),
                    userName: Joi.string().description("userName is required")
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
            notes: 'Checks the email and password and if correct logs in. Header input: Basic KMajNKHPqGt6kXwUbFN3dU46PjThSNTtrEnPZUefdasdfghsaderf1234567890ghfghsdfghjfghjkswdefrtgyhdfghj',
            tags: ['api']
        }

    }
];

function updateProfileHandler(req, reply) {
    var isDeleteProfile = false, isUnserProfile = false
    async.waterfall([
        function (validateCB) {
            if (!req.headers.authorization) {
                return reply({ code: 101, message: "mandatory headers is missing" }).code(401);
            } else {
                if (req.headers.authorization != conf.authorization) {
                    return reply({ code: 102, message: "failed to authenticate, headers is Invalid " }).code(401);
                }
            }
            if (!req.payload.profilePic || req.payload.profilePic == "null") {
                isDeleteProfile = true;
                delete req.payload.profilePic;
            }
            if (!req.payload.userName) return reply({ code: 103, message: "mandatory userName  is missing" }).code(422);
            if (!req.headers.token) {
                return reply({ code: 104, message: "mandatory headers is missing" }).code(422);
            } else {
                var token = req.headers.token.trim();
                jsonwebtoken.verify(token, secretKey, function (jwterr, decoded) {
                    if (jwterr) {
                        return reply({ code: 105, message: "failed to authenticate, token is Invalid " }).code(401);
                    } else {
                        validateCB(null, decoded);
                    }
                });
            }

        },
        function (decoded, funcMainCB) {
            var username = decoded.name;
            var responseobj = {};
            dataToSave = {
                userName: req.payload.userName,
                profilePic: req.payload.profilePic
            };
            middleWare.Update("userList", dataToSave, { userName: username }, "Mongo", function (err, result) {
                if (err) {
                    responseobj = {
                        code: 500,
                        message: 'internal server error while updating user data',
                        error: err
                    };
                    
                    funcMainCB(responseobj, null);
                } else {
                    responseobj = {
                        code: 200,
                        message: 'success',
                        data: result
                    };
                    
                    funcMainCB(null, responseobj);
                }
            });
        }
    ], function (err, data) {
        if (err) return reply(err).code(500);
        else return reply(data).code(200);
    });
}

