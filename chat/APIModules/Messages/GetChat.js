var jsonwebtoken = require('jsonwebtoken');
var conf = require('../../conf');
// var confAAA = require('../../Controller/dbMiddleware.js');
var secretKey = conf.secretKey;
var ObjectID = require('mongodb').ObjectID
var Joi = require('joi');
var async = require("async");
var middleWare = require("../../Controller/dbMiddleware.js");
var ComnFun = require('../../ComnFun.js');
var dbConfig = require('../../Controller/dbConfig.js');

/**
 * Define all related routes
 */
module.exports = [
    {
        method: 'GET',
        path: '/Chats/{pageNo}',
        handler: function (req, res) {
            /**
             * call the handler function
             */
            getChatListHandler(req, res);
        },
        config: {
            description: 'Get the chat lists for the user.',
            notes: 'Get the chat lists for the user. Header input: Basic aG91c2U6ZVNTNzlCakVncVlYbmlXNHJTYzI3UDdMOUcyN2p3WFFZMlA0dGZCZW5tekcwb21iRnVKZVNYQ2pYQ3JaNVAwOGIxODBRc3RROTE2ZWtqS3FpZDBMTWRHMmRLTmk1cDRBS1FiSUUxUFZFcnF1RTJuYUx6U0JxR1dYT0hFd0pmR2hKb2daNzdTT0lJYXdEQVpIM1JhUDlablZwQ0NxRVZJRHZRY1ZYaFFRS0tIcTRQaktsRmlubHVkbzBoOXQ3RE9UUklyMndqNmZXV1VHWmZyUTc4UVFURFBTbm1vTFB0U0FhbWxWbEZHZW5waGZYR1dTNks2QTJkQW1nSjlwcTZmbg==',
            tags: ['api', 'messages'],
            validate: {
                headers: Joi.object({
                    'authorization': Joi.string(),
                    'token': Joi.string(),
                }).unknown(),
                params: {
                    pageNo: Joi.string().description("PageNo"),
                }
            },

        },

    }];


/**
 * API Name: GET /Chats/{pageNo}
 */
function getChatListHandler(req, res) {

    // console.log('getChatListHandler ', JSON.stringify(req.headers))
    async.waterfall([
        function (validateCB) {
            /**
             * function to validate the input
             * and jwt token verification
             */

            if (!req.headers.token) {
                return res({ message: "mandatory headers is missing" }).code(406);
            } else {

                jsonwebtoken.verify(req.headers.token, secretKey, function (jwterr, decoded) {
                    if (jwterr) {
                        return res({ message: jwterr.message }).code(401);
                    } else {
                        /**
                         * JWT validated
                         */
                        validateCB(null, decoded);
                    }
                });
            }
        },
        function (JWTDecoded, cb) {

            var username = JWTDecoded.name;

            // console.log(JSON.stringify({ userName: username }))

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

            var limit = 10, skip = 0;
            if (req.params.pageNo.toString() != "") {
                skip = req.params.pageNo * 10;
                limit = 10 + skip;
            }

            var userID = "members." + userData[0]._id;
            var chatListAggr = [
                { "$match": { [userID]: { "$exists": true }, [userID + ".inactive"]: { "$exists": false } } },
                { "$project": { id: 1, initiatedBy: 1, messageDBId: { $slice: ["$message", -1] } } },
                { "$unwind": "$messageDBId" },
                {
                    "$lookup": {
                        "from": "messages", "localField": "messageDBId", "foreignField": "_id", as: "messageDetails"
                    }
                },
                { "$unwind": "$messageDetails" },
                {
                    "$project": {
                        initiatedBy: 1, "chatId": "$messageDetails.chatId", "secretId": "$messageDetails.secretId", "dTime": "$messageDetails.dTime", "messageId": "$messageDetails.messageId",
                        "payload": "$messageDetails.payload", "messageType": "$messageDetails.messageType", "offerType": "$messageDetails.offerType", "timestamp": "$messageDetails.timestamp",
                        "receiverId": "$messageDetails.receiverId", "members": "$messageDetails.members", "senderId": "$messageDetails.senderId", "isSold": "$messageDetails.isSold",
                        "targetUserId": {
                            "$cond": {
                                if: { $eq: ["$messageDetails.senderId", ObjectID(userData[0]._id)] },
                                then: "$messageDetails.receiverId",
                                else: "$messageDetails.senderId"
                            }
                        }
                    },
                },
                {
                    "$lookup": {
                        "from": "userList", "localField": "targetUserId", "foreignField": "_id", as: "targetDetails"
                    }
                },
                { "$unwind": "$targetDetails" },
                {
                    "$project": {
                        _id: 0, "initiatedBy": 1, "chatId": 1, "secretId": 1, "dTime": 1, "messageId": 1, "payload": 1, "members": 1, "messageType": 1, "offerType": 1, "timestamp": 1, "senderId": 1, "receiverId": 1, "isSold": 1,
                        "profilePic": "$targetDetails.profilePic", "userIdentifier": "$targetDetails.email", "userName": "$targetDetails.userName", "recipientId": "$targetDetails._id"
                    }
                },
                {
                    "$lookup": {
                        "from": "product", "localField": "secretId", "foreignField": "_id", as: "productDetails"
                    }
                },
                { "$unwind": "$productDetails" },
                {
                    "$project": {
                        _id: 0, "initiatedBy": 1, "chatId": 1, "secretId": 1, "dTime": 1, "messageId": 1, "payload": 1, "members": 1, "messageType": 1, "offerType": 1, "timestamp": 1, "senderId": 1, "receiverId": 1, "isSold": 1,
                        "profilePic": 1, "userIdentifier": 1, "userName": 1, "recipientId": 1, "productName": "$productDetails.name", "productId": "$productDetails._id", "productImage": "$productDetails.image", "productSold": "$productDetails.sold"
                    }
                },
                { "$sort": { "timestamp": -1 } },
                { "$skip": skip }, { "$limit": limit },
                { "$sort": { "messageId": -1 } }
            ];

            // console.log('')
            // console.log('chatListAggr' + JSON.stringify(chatListAggr));

            middleWare.AggreGate("chatList", chatListAggr, "Mongo", function (err, result) {
                if (err) {
                    return res({ message: "Unknown error occurred" }).code(503);
                }
                else if (result.length) {

                    var condition, userId, targetId, index = 0;
                    var unchatCount = [];

                    async.each(result, function (val, callbackloop) {

                        userId = "members." + userData[0]._id;
                        targetId = "messageDetails.members." + userData[0]._id + ".readAt";

                        condition = [
                            { "$match": { [userId]: { "$exists": true }, secretId: val.secretId } },
                            { "$unwind": "$message" },
                            { "$lookup": { "from": "messages", "localField": "message", "foreignField": "_id", as: "messageDetails" } },
                            { "$unwind": "$messageDetails" },
                            { "$match": { "messageDetails.payload": { $ne: "" } } },
                            { "$match": { "messageDetails.senderId": ObjectID(val.senderId) } },
                            { "$match": { "messageDetails.receiverId": ObjectID(userData[0]._id) } },
                            { "$match": { [targetId]: { "$exists": false } } },
                            { "$group": { _id: userData[0]._id, "totalUnread": { $sum: 1 } } }];

                        middleWare.AggreGate("chatList", condition, "Mongo", function (err, resultA) {
                            if (err) {
                                // result[index]["totalUnread"] = 0;
                                val["totalUnread"] = 0;
                                // index++;
                                // callbackloop(err, resultA);
                            } else if (resultA[0]) {
                                //   console.log("Result is : ", resultA);
                                // result[index]["totalUnread"] = resultA[0].totalUnread;
                                val["totalUnread"] = resultA[0].totalUnread;
                                // index++;
                                // callbackloop(err, resultA);
                            } else {
                                // result[index]["totalUnread"] = 0;
                                val["totalUnread"] = 0;
                                // index++;
                                // callbackloop(err, resultA);
                            }
                            //  delete result[index].senderId;
                            if (result[index].messageType != "1" && result[index].messageType != "2" && result[index].messageType != "7") {
                                delete result[index].thumbnail;
                            }
                            index++;
                            callbackloop(err, resultA);
                        });

                    }, function (err, resultLoop) {
                        if (err) {
                            return res({ code: 500, message: "DB Error" }).code(500);
                        } else {

                            /**
                             * Success status goes with API response. 
                             * Actual data goes through MQTT
                             */
                            var finalRes = []
                            async.eachSeries(result, function (resObj, resCB) {
                                /**
                                 * Loop throught the result and prepare the final data
                                 * 
                                 *  "productName", "productId", "productImage"
                                 */
                                finalRes.push({
                                    "initiated": ((resObj.initiatedBy).toString() == userData[0]._id) ? true : false,
                                    "chatId": resObj.chatId,
                                    "secretId": resObj.secretId,
                                    "messageId": resObj.messageId,
                                    "payload": resObj.payload,
                                    "messageType": resObj.messageType,
                                    "offerType": resObj.offerType,
                                    "timestamp": resObj.timestamp,
                                    "receiverId": resObj.receiverId,
                                    "senderId": resObj.senderId,
                                    "profilePic": resObj.profilePic,
                                    "userIdentifier": resObj.userIdentifier,
                                    "userName": resObj.userName,
                                    "recipientId": resObj.recipientId,
                                    "productId": resObj.productId,
                                    "productName": resObj.productName,
                                    "productImage": resObj.productImage,
                                    "productSold": resObj.productSold,
                                    "isSold": resObj.isSold,
                                    "status": (resObj.members[resObj.receiverId].status) ? resObj.members[resObj.receiverId].status : 1,
                                    "totalUnread": resObj.totalUnread
                                })
                                resCB(null);
                            },
                                function (finalLoopErr) {
                                    if (finalLoopErr) {
                                        return res({ message: finalLoopErr.message }).code(503);
                                    }

                                    console.log('Sending chatlist: ' + JSON.stringify({ "chats": finalRes }))
                                    ComnFun.publishMqtt("GetChats/" + userData[0]._id, JSON.stringify({ "chats": finalRes }))
                                    // return res({ code: 200, message: "success", response: result }).code(200);
                                    return res({ code: 200, message: "success" }).code(200);
                                })

                        }
                    })

                }
                else {
                    console.log('Sending empty chatlist')
                    ComnFun.publishMqtt("GetChats/" + userData[0]._id, JSON.stringify({ "chats": [] }))
                    return res({ code: 204, message: "No data Found." }).code(200);
                }
            })
        }
    ])

}

