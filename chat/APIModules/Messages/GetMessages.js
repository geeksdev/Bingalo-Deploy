var jsonwebtoken = require('jsonwebtoken');
var conf = require('../../conf');
var confAAA = require('../../Controller/dbMiddleware.js');
var secretKey = conf.secretKey;
var ObjectID = require('mongodb').ObjectID
var async = require("async");
var Joi = require('joi');
var middleWare = require("../../Controller/dbMiddleware.js");
var ComnFun = require('../../ComnFun.js');

module.exports = [
    {
        method: 'GET',
        path: '/Messages/{chatId}/{timestamp}/{pageSize}',
        handler: function (req, res) {
            GetMessagesHendler(req, res);
        },
        config: {
            tags: ['api', 'messages'],
            description: 'Get the messages for the specified chat',
            notes: 'Get the messages for the specified chat. Header input: Basic aG91c2U6ZVNTNzlCakVncVlYbmlXNHJTYzI3UDdMOUcyN2p3WFFZMlA0dGZCZW5tekcwb21iRnVKZVNYQ2pYQ3JaNVAwOGIxODBRc3RROTE2ZWtqS3FpZDBMTWRHMmRLTmk1cDRBS1FiSUUxUFZFcnF1RTJuYUx6U0JxR1dYT0hFd0pmR2hKb2daNzdTT0lJYXdEQVpIM1JhUDlablZwQ0NxRVZJRHZRY1ZYaFFRS0tIcTRQaktsRmlubHVkbzBoOXQ3RE9UUklyMndqNmZXV1VHWmZyUTc4UVFURFBTbm1vTFB0U0FhbWxWbEZHZW5waGZYR1dTNks2QTJkQW1nSjlwcTZmbg==',
            validate: {
                headers: Joi.object({
                    'authorization': Joi.string(),
                    'token': Joi.string(),
                }).unknown(),
                params: {
                    chatId: Joi.string().description("Unique id for chat"),
                    timestamp: Joi.string().description("timestamp"),
                    pageSize: Joi.string().description("page size"),
                }
            },

        },

    }];


function GetMessagesHendler(req, res) {
    console.log('')
    console.log('GetMessagesHendler: ', JSON.stringify(req.headers));
    async.waterfall([
        function (validateCB) {

            if (!req.headers.token) {
                return res({ message: "mandatory headers is missing" }).code(406);
            } else if (!req.params.chatId) {
                return res({ message: "Mandatory uniqueKey is missing" }).code(400);
            } else {

                jsonwebtoken.verify(req.headers.token, secretKey, function (jwterr, decoded) {
                    if (jwterr) {
                        return res({ message: "failed to authenticate, token is Invalid " }).code(401);
                    } else {
                        validateCB(null, decoded);
                    }
                });
            }
        },
        function (JWTDecoded, cb) {

            var username = JWTDecoded.name;
            middleWare.Select("userList", { userName: username }, "Mongo", {}, function (e, d) {
                if (e) {
                    cb({ code: 500, message: 'internal server error', error: e }, null);
                } else if (!d || d.length === 0) {
                    cb({ code: 204, message: 'no data' }, null);
                } else {
                    cb(null, d);
                }
            });
        },
        function (userData, mainFuncCB) {

            console.log('UserID ', userData[0]._id)
            var pagesize = parseInt(req.params.pageSize);
            var _id = req.params.chatId;

            var usr_msg_del = "members." + userData[0]._id + ".del"
            var getMesg = [
                { "$match": { "chatId": ObjectID(req.params.chatId) } },
                { "$match": { "timestamp": { $lt: parseInt(req.params.timestamp) } } },
                { "$match": { $or: [{ "expDtime": 0 }, { "expDtime": { $gt: new Date().getTime() } }] } },
                { "$match": { [usr_msg_del]: { "$exists": false } } },
                {
                    "$project": {
                        _id: 0, messageId: 1, secretId: 1, senderId: 1, receiverId: 1, payload: 1, isSold: 1,
                        messageType: 1, offerType: 1, timestamp: 1, chatId: 1, userImage: 1, toDocId: 1, name: 1,
                        dTime: 1, dataSize: 1, thumbnail: 1, members: 1
                    }
                },
                { "$sort": { "timestamp": -1 } },
                { $limit: pagesize }
            ];

            middleWare.AggreGate("messages", getMesg, "Mongo", function (err, result) {
                if (err) {
                    return res({ message: err.message }).code(503);
                }
                else if (result.length) {
                    console.log(result[0])
                    async.waterfall([
                        function (func1CB) {
                            /**  Get participants details  */

                            console.log(JSON.stringify({
                                _id: {
                                    $in: [ObjectID(result[0].senderId), ObjectID(result[0].receiverId)]
                                }
                            }));

                            middleWare.Select("userList",
                                {
                                    _id: {
                                        $in: [ObjectID(result[0].senderId), ObjectID(result[0].receiverId)]
                                    }
                                },
                                "Mongo",
                                {},
                                function (ulErr, ulResult) {
                                    if (ulErr) {
                                        return res({ code: 503, message: ulErr.message }).code(503);
                                    }
                                    else if (ulResult.length == 2) {
                                        /** send data to next function */
                                        func1CB(null, {
                                            user1: { id: ulResult[0]._id.toString(), name: ulResult[0].userName },
                                            user2: { id: ulResult[1]._id.toString(), name: ulResult[1].userName }
                                        })
                                    }
                                    else {
                                        /** something wrong with the userdata */
                                        return res({ code: 204, message: "Users doesn't exist", response: {} }).code(200);
                                    }
                                })
                        }, function (participants, finalCB) {

                            var finalRes = [], oponentUid = '', secretId = '', dTime = ''
                            /**
                             * Loop through the result and prepare the final result 
                             */
                            async.eachSeries(result, function (resObj, resCB) {

                                /**
                                 * keeping the common fields out of the response array
                                 * OponentID and SecretID are common for all messages
                                 */
                                if (oponentUid == '') {
                                    oponentUid = (resObj.senderId == userData[0]._id) ? resObj.receiverId : resObj.senderId
                                    secretId = resObj.secretId
                                    dTime = resObj.dTime
                                }

                                var msgObj = {
                                    "messageId": resObj.messageId,
                                    "senderId": resObj.senderId,
                                    "receiverId": resObj.receiverId,
                                    "payload": resObj.payload,
                                    "messageType": resObj.messageType,
                                    "timestamp": resObj.timestamp,
                                    "userImage": resObj.userImage,
                                    "toDocId": resObj.toDocId,
                                    "name": resObj.name,
                                    "opponentName": (resObj.payload == '') ? (participants.user1.id == resObj.senderId) ? participants.user2.name : participants.user1.name : '',
                                    "status": (resObj.members[resObj.receiverId].status) ? resObj.members[resObj.receiverId].status : 1,
                                    "isSold": resObj.isSold,
                                    "delivered": (resObj.members[resObj.receiverId].deliveredAt) ? resObj.members[resObj.receiverId].deliveredAt : -1,
                                    "read": (resObj.members[resObj.receiverId].readAt) ? resObj.members[resObj.receiverId].readAt : -1,
                                }

                                if (resObj.messageType == '15')
                                    msgObj.offerType = resObj.offerType

                                /**
                                 * add dTime only if the its a secret chat
                                 */
                                if (secretId != '') {
                                    msgObj.dTime = resObj.dTime
                                }

                                /**
                                 * check if the message type is of image / video / audio / doodle
                                 * and add the additional fields (thumbnail, dataSize)
                                 */
                                switch (resObj.messageType) {
                                    case '1':
                                    case '2':
                                    case '7':
                                        msgObj.thumbnail = resObj.thumbnail
                                        msgObj.dataSize = resObj.dataSize
                                        break;
                                    case '5':
                                        msgObj.dataSize = resObj.dataSize
                                        break;
                                }

                                finalRes.push(msgObj);
                                resCB(null);
                            }, function (FinalLoopErr) {
                                if (FinalLoopErr) {
                                    return res({ message: finalLoopErr.message }).code(503);
                                }

                                /**
                                 * Success status goes with API response. 
                                 * Actual data goes through MQTT
                                 */
                                res({
                                    code: 200,
                                    message: "Success"
                                }).code(200);

                                console.log('Sending message: GetMessages/' + userData[0]._id, JSON.stringify({ "chatId": req.params.chatId, "opponentUid": oponentUid, "secretId": secretId, "dTime": dTime, "messages": finalRes }))
                                ComnFun.publishMqtt("GetMessages/" + userData[0]._id, JSON.stringify({
                                    "chatId": req.params.chatId, "opponentUid": oponentUid, "secretId": secretId, "dTime": dTime, "messages": finalRes
                                }))

                            })

                        }
                    ])

                }
                else {
                    /** No messages to send */
                    res({ code: 200, message: "No Data Found.", data: {} }).code(200);

                    console.log('sending empty GetMessages/' + userData[0]._id)
                    ComnFun.publishMqtt("GetMessages/" + userData[0]._id, JSON.stringify({
                        "chatId": req.params.chatId, "opponentUid": '', "secretId": '', "dTime": 0, "messages": []
                    }))
                }
            })
        }
    ])

}
