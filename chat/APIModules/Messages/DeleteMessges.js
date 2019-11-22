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
        path: '/Messages/{all}/{messageIds}',
        handler: function (req, res) {
            /**
             * call the handler function
             */
            deleteMessageHandler(req, res);
        },
        config: {
            description: 'Delete a specific message.',
            notes: 'Delete a specific message. Header input: Basic aG91c2U6ZVNTNzlCakVncVlYbmlXNHJTYzI3UDdMOUcyN2p3WFFZMlA0dGZCZW5tekcwb21iRnVKZVNYQ2pYQ3JaNVAwOGIxODBRc3RROTE2ZWtqS3FpZDBMTWRHMmRLTmk1cDRBS1FiSUUxUFZFcnF1RTJuYUx6U0JxR1dYT0hFd0pmR2hKb2daNzdTT0lJYXdEQVpIM1JhUDlablZwQ0NxRVZJRHZRY1ZYaFFRS0tIcTRQaktsRmlubHVkbzBoOXQ3RE9UUklyMndqNmZXV1VHWmZyUTc4UVFURFBTbm1vTFB0U0FhbWxWbEZHZW5waGZYR1dTNks2QTJkQW1nSjlwcTZmbg==',
            tags: ['api', 'messages'],
            validate: {
                headers: Joi.object({
                    'authorization': Joi.string(),
                    'token': Joi.string(),
                }).unknown(),
                params: {
                    all: Joi.string().description("Delete all / selected"),
                    messageIds: Joi.array().description("Array of message ids").allow([]),
                }
            },

        },

    }];

function deleteMessageHandler(req, res) {

    async.waterfall([
        function (validateCB) {

            if (!req.headers.token) {
                return res({ message: "mandatory headers is missing" }).code(406);
            } else if (!req.params.messageIds) {
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
        function (JWTDecoded, funcMainCB) {

            console.log('JWTDecoded: ', JWTDecoded.userId)

            if (req.params.all && req.params.all == 'true') {
                /**
                 * delete all messages
                 */

            } else {
                /**
                 * delete selected messages
                 */
                console.log(typeof req.params.messageIds);

                if (req.params.messageIds && (Array.isArray(req.params.messageIds) && ((req.params.messageIds).length > 0))) {
                    var updtMsgs = []
                    // async.eachSeries(req.params.messageIds, function (msgid, msgCB) {
                    //     try {
                    //         updtMsgs.push(ObjectID(msgid));
                    //     } catch (exec) { }
                    //     msgCB(null);
                    // }, function (msgidLoopErr) {
                    //     if (msgidLoopErr) {

                    //     } else {

                    //"senderId" : ObjectId("59847dbd3fe3042557c0745b"),
                    // "receiverId" : ObjectId("5988253b50e23910a3bd5a83")

                    var or_clause = []
                    try {
                        or_clause.push({ senderId: ObjectID(JWTDecoded.userId) })
                        or_clause.push({ receiverId: ObjectID(JWTDecoded.userId) })
                    } catch (exec) {
                        return res({ message: exec.message }).code(400);
                    }

                    var usr_msg_del = "members." + JWTDecoded.userId + ".del"
                    middleWare.Update("messages",
                        { [usr_msg_del]: true },
                        { $and: [{ messageId: { $in: req.params.messageIds } }, { $or: or_clause }] },
                        "Mongo",
                        function (updtErr, updtResult) {
                            if (updtErr) {
                                console.log("Error : messages 101 ", err);
                            }
                        });

                    // middleWare.Select("messages", { _id: { $in: updtMsgs } }, "Mongo", { }, function (getMsgsErr, getMsgs) {
                    //     if (getMsgsErr) {

                    //     } else if(getMsgs.length > 0) {

                    //         console.log('get messages: '+JSON.stringify(getMsgs));
                    //     }
                    // })
                    // }
                    // })


                }

            }
            /**
             * update the status of the message as deleted
             * and publish to the same user (multi device support)
             */

            /**
             * var deliveredAt = "members." + userId + ".deliveredAt";
 
           var dataToUpdate = {
               [updaetStatus]: status
           }
           dataToUpdate[deliveredAt] = new Date().getTime();
 
           for (var index = 0; index < messageId.length; index++) {
               middleWare.Update("messages", dataToUpdate, { messageId: messageId[index] }, "Mongo", function (err, result) {
                   if (err) {
                       console.log("Error : messages 101 ", err);
                   }
               });
 
           }
             */

            return res({ code: 200, message: "In progress.." }).code(200);
        }
    ])

}