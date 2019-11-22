const Joi = require('joi')
const async = require('async')
const jsonwebtoken = require('jsonwebtoken')
var conf = require('../../conf.json');
const secretKey = conf.secretKey;
var middleWare = require("../../Controller/dbMiddleware.js");
var objectId = require("mongodb").ObjectID;

var ComnFun = require('../../ComnFun.js');


module.exports = [
    {
        method: 'POST',
        path: '/Profile/Login',
        handler: function (req, res) { 
            ProfileLoginHandler(req, res)
        },
        config: {
            validate: {
                payload: {
                    userName: Joi.string().description("userName is required"),
                    // deviceType: Joi.number().description("deviceType is required"),
                    // deviceOs: Joi.string().description("deviceOs is required"),
                    // deviceMake: Joi.string().description("deviceMake is required"),
                    // deviceModel: Joi.string().description("deviceModel is required"),
                    // deviceId: Joi.string().description("DeviceId is required"),
                    pushToken: Joi.string().description("PushToken is required"),
                    // appVersion: Joi.string().description("appVersion is required"),
                    // versionCode: Joi.number().description("versionCode is required"),
                    profilePic: Joi.string().description("profilePic is required").allow(""),
                },
                headers: Joi.object({
                    'authorization': Joi.string()
                }).unknown()
            },
            description: 'User Login',
            notes: 'User login into the app. Header input: KMajNKHPqGt6kXwUbFN3dU46PjThSNTtrEnPZUefdasdfghsaderf1234567890ghfghsdfghjfghjkswdefrtgyhdfghj',
            tags: ['api']
        },

    }
];


function ProfileLoginHandler(req, reply) {

    async.waterfall([
        function (validateCB) {
            /**
             * check all mendatory fields
             */
            if (!req.headers.authorization) {
                return reply({ message: "mandatory headers is missing" }).code(406);
            } else {
                if (req.headers.authorization != conf.authorization) {
                    return reply({ message: "failed to authenticate, headers is Invalid " }).code(401);
                }
            }

            if (!req.payload.userName) {
                return reply({ Message: "mandatory userName is missing" }).code(400);
            }

            // if (req.payload.deviceType || req.payload.deviceType !== 0) {
            //     return reply({ Message: "mandatory deviceType is missing" }).code(400);
            // }

            // if (!req.payload.deviceOs) {
            //     return reply({ Message: "mandatory OS is missing" }).code(400);
            // }

            // if (!req.payload.deviceMake) {
            //     return reply({ Message: "mandatory manufacturer is missing" }).code(400);
            // }

            // if (!req.payload.deviceModel) {
            //     return reply({ Message: "mandatory deviceModel is missing" }).code(400);
            // }

            // if (!req.payload.deviceId) {
            //     return reply({ Message: "mandatory DeviceId is missing" }).code(400);
            // }

            if (!req.payload.pushToken) {
                return reply({ Message: "mandatory pushToken is missing" }).code(400);
            }


            // if (!req.payload.appVersion) {
            //     return reply({ Message: "mandatory appVersion is missing" }).code(400);
            // }

            // if (req.payload.versionCode || req.payload.versionCode != 0) {
            //     return reply({ Message: "mandatory Version is missing" }).code(400);
            // }

            validateCB(null);
        },

        function (mainCB) {

            const check_user = { userName: (req.payload.userName).toLowerCase() };
            var user_data = {
                userName: req.payload.userName,
                // deviceType: req.payload.deviceType,
                // deviceOs: req.payload.deviceOs,
                // deviceMake: req.payload.deviceMake,
                // deviceModel: req.payload.deviceModel,
                // deviceId: req.payload.deviceId,
                pushToken: req.payload.pushToken,
                // appVersion: req.payload.appVersion,
                // versionCode: req.payload.versionCode,
                profilePic: req.payload.profilePic
            };

            middleWare.FindAndModify("userList", user_data, check_user, "Mongo", {}, { new: true, upsert: true }, function (famUserErr, famUserRes) {
                if (famUserErr) return reply({ Message: famUserErr.message }).code(500)
                if (famUserRes) {
                    console.log('famUserRes: ', famUserRes);
                    return reply({ code: 200, data: famUserRes }).code(200);
                }
            })
        }
    ]);
}
