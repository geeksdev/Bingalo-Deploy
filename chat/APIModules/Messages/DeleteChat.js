var jsonwebtoken = require('jsonwebtoken');
var conf = require('../../conf');
var confAAA = require('../../Controller/dbMiddleware.js');
var secretKey = conf.secretKey;
var ObjectID = require('mongodb').ObjectID
var Joi = require('joi');
var async = require("async");
var middleWare = require("../../Controller/dbMiddleware.js");
var ComnFun = require('../../ComnFun.js');

/**
 * Define all related routes
 */
module.exports = [
    {
        method: 'DELETE',
        path: '/Chats/{recipientId}/{secretId}',
        handler: function (req, res) {
            /**
             * call the handler function
             */
            deleteChatListHandler(req, res);
        },
        config: {
            description: 'Delete the chat from chatlist for the user.',
            notes: "Delete the chat from chatlist for the user. <br>Header input: Basic aG91c2U6ZVNTNzlCakVncVlYbmlXNHJTYzI3UDdMOUcyN2p3WFFZMlA0dGZCZW5tekcwb21iRnVKZVNYQ2pYQ3JaNVAwOGIxODBRc3RROTE2ZWtqS3FpZDBMTWRHMmRLTmk1cDRBS1FiSUUxUFZFcnF1RTJuYUx6U0JxR1dYT0hFd0pmR2hKb2daNzdTT0lJYXdEQVpIM1JhUDlablZwQ0NxRVZJRHZRY1ZYaFFRS0tIcTRQaktsRmlubHVkbzBoOXQ3RE9UUklyMndqNmZXV1VHWmZyUTc4UVFURFBTbm1vTFB0U0FhbWxWbEZHZW5waGZYR1dTNks2QTJkQW1nSjlwcTZmbg==",
            tags: ['api', 'messages'],
            validate: {
                headers: Joi.object({
                    'authorization': Joi.string().required(),
                    'token': Joi.string().required(),
                }).unknown(),
                params: {
                    recipientId: Joi.string().description("Recipient Id"),
                    secretId: Joi.string().description("Secret Id").optional()
                }
            },

        },

    }];

function deleteChatListHandler(req, res) {

    console.log('deleteChatListHandler: ' + JSON.stringify(req.params))
    console.log('deleteChatListHandler: ' + JSON.stringify(req.headers))

    async.waterfall([
        function (validateCB) {

            if (!req.headers.token) {
                return res({ message: "mandatory headers is missing" }).code(406);
            } else if (!req.params.recipientId) {
                return res({ message: "Mandatory uniqueKey is missing" }).code(400);
            } else if (!req.params.secretId) {
                return res({ message: "Mandatory uniqueKey is missing" }).code(400);
            } else {

                jsonwebtoken.verify(req.headers.token, secretKey, function (jwterr, decoded) {
                    if (jwterr) {
                        console.log("jwterr =>", jwterr);
                        return res({ message: "failed to authenticate, token is Invalid " }).code(401);
                    } else {
                        validateCB(null, decoded);
                    }
                });
            }
        },
        function (JWTDecoded, cb) {

            middleWare.Select("userList", { userName: JWTDecoded.name }, "Mongo", {}, function (e, d) {
                if (e) {
                    cb({ code: 500, message: 'internal server error', error: e }, null);
                } else if (!d || d.length === 0) {
                    cb({ code: 204, message: 'no data' }, null);
                } else {
                    cb(null, d);
                }
            });
        },
        function (userData, updtChatsCB) {

            // userData[0]._id

            console.log('userid: ', userData[0]._id)

            /**
             * update the 'chatList' with 'members.{userData[0]._id}.inactive: true
             * 
             * fetch all the message ids in 'message' and update from the bottom till we reach last active message 
             */
            var getChat = {
                ["members." + userData[0]._id]: { $exists: true },
                ["members." + req.params.recipientId]: { $exists: true },
                "secretId": (req.params.secretId != "null") ? req.params.secretId : ""
            }

            console.log('getChat >> ' + JSON.stringify(getChat))
            /**
             * find and modify
             * mark the member as inactive for the specified chat list
             * get the members array for updating
             */
            middleWare.FindAndModify("chatList",
                { $set: { ["members." + userData[0]._id + ".inactive"]: true } },
                getChat,
                "Mongo",
                { message: 1 }, { new: true },
                function (getChatErr, getChatRes) {
                    if (getChatErr) {
                        return res({ code: 503, message: getChatErr.message }).code(503);
                    } else if (getChatRes.value) {

                        /**  iterate from last message till the one wich is already deleted */
                        var c = 0;
                        async.eachSeries((getChatRes.value.message).reverse(), function (msgId, msgCB) {

                            console.log('msgId >> ', msgId)
                            /**
                             * update the message marking its deleted for the specified member 
                             */
                            middleWare.FindAndModify("messages",
                                { $set: { ["members." + userData[0]._id + ".del"]: true } },
                                { _id: msgId, ["members." + userData[0]._id + ".del"]: { $exists: false } },
                                "Mongo",
                                { messageId: 1 }, { new: true },
                                function (updtErrr, updtResult) {
                                    if (updtErrr) {
                                        console.log('updtErrr: ', updtErrr)
                                    } else {
                                        /**
                                         * check if the findAndModify found any document to update
                                         * if yes then continue else skip message updates
                                         */
                                        if (updtResult.lastErrorObject.updatedExisting) {
                                            console.log(++c + '. continue')
                                            msgCB(null)
                                        } else {
                                            console.log('stop looping')
                                            updtChatsCB(null)
                                        }
                                    }

                                })

                        }, function (msgUpdtErr) {
                            /** Message loop completes */
                            if (msgUpdtErr) {
                                return res({ code: 200, message: msgUpdtErr.message }).code(503)
                            }

                            updtChatsCB(null)
                        });

                    }
                    else {
                        /** No messages to update */
                        updtChatsCB(null)
                    }
                })
        }
    ], function (asyncErr) {
        if (asyncErr) {
            return res({ code: 200, message: asyncErr.message }).code(503)
        } else {
            return res({ code: 200, message: "chat deleted." }).code(200)
        }
    })

}