const Joi = require('joi');
var jsonwebtoken = require('jsonwebtoken');
// var ComnFun = require('../../ComnFun.js');
// var conf = require('../../conf.json');
// var secretKey = conf.secretKey;
// var middleWare = require("../../Controller/dbMiddleware.js");
// var phoneUtil = require('google-libphonenumber').PhoneNumberUtil.getInstance();

var fcmUtil = require('./../FCM')

module.exports = [
    {
        method: 'POST',
        path: '/FCM/Push/Topic',
        config: {
            handler: function (req, reply) {
                /** Sample payload */
                var payload = {
                    notification: {
                        "body": "sample push!",
                        "title": "3embed",
                        "icon": "myicon"
                    },
                    data: {
                        name: 'rahul',
                        time: (new Date()).toString()
                    }
                }

                /** sample topic */
                var topic = 'mqttTestFCMPush'

                fcmUtil.push_topic(topic, payload, function (err, res) {
                    if (err) console.log(err.message)
                    if (res) {
                        console.log('res ', res)
                        return reply(res).code(200);
                    }
                })

            },
            description: 'Test FCM API',
            tags: ['api']
        }
    },
    {
        method: 'POST',
        path: '/FCM/Push/Token',
        config: {
            handler: function (req, reply) {
                /** Sample payload */
                var payload = {
                    notification: {
                        "body": "sample push!",
                        "title": "3embed",
                        "icon": "myicon"
                    },
                    data: {
                        name: 'rahul',
                        time: (new Date()).toString()
                    }
                }

                /** sample topic */
                var topic = 'mqttTestFCMPush'

                tokenArr = []
                fcmUtil.push_token(tokenArr, payload, function (err, res) {
                    if (err) console.log(err.message)
                    if (res) {
                        console.log('res ', res)
                        return reply(res).code(200);
                    }
                })

            },
            description: 'Test FCM API',
            tags: ['api']
        }
    }
];

