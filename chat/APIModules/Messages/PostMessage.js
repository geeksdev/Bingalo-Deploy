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
        method: 'POST',
        path: '/Messages',
        config: {
            handler: function (req, reply) {
                postMessageHandler(req, reply)
            },
            validate: {
                /**
                 * type: 15: offer
                 * offerType: if 'type == 15' then only | 1 - offer made, 2 - counter offer, 0 - accepted
                 */
                payload: Joi.object({
                    name: Joi.string().description("name is required"),
                    from: Joi.string().description("from is required"),
                    to: Joi.string().description("to is required"),
                    payload: Joi.string().description("payload is required"),
                    type: Joi.string().description("type is required"),
                    offerType: Joi.string().description("offerType is required").allow(''),
                    id: Joi.string().description("id is required"),
                    secretId: Joi.string().description("secretId is required"),
                    thumbnail: Joi.string().description("thumbnail is required").allow(''),
                    userImage: Joi.string().description("userImage is required").allow(''),
                    toDocId: Joi.string().description("toDocId is required"),
                    dataSize: Joi.number().description("dataSize is required"),
                    isSold: Joi.string().description("isSold is required")
                }).unknown().required(),
                headers: Joi.object({
                    'authorization': Joi.string().description("required")
                }).unknown()
            },
            description: 'Post a message',
            notes: 'Header input: KMajNKHPqGt6kXwUbFN3dU46PjThSNTtrEnPZUefdasdfghsaderf1234567890ghfghsdfghjfghjkswdefrtgyhdfghj',
            tags: ['api']
        }

    }
];

function postMessageHandler(req, reply) {

    // console.log('postMessageHandler: ', req.payload);

    async.waterfall([
        function (validateCB) {
            /**
             * validate the input
             */
            if (!req.headers.authorization) {
                return reply({ code: 101, message: "mandatory headers is missing" }).code(200);
            } else {
                if (req.headers.authorization != conf.authorization) {
                    return reply({ code: 102, message: "failed to authenticate, headers is Invalid " }).code(200);
                }
            }

            if (!req.payload.from) {
                return reply({ code: 103, message: "mandatory 'from' is missing" }).code(200);
            }
            if (!req.payload.to) {
                return reply({ code: 103, message: "mandatory 'to' is missing" }).code(200);
            }
            if (!req.payload.payload) {
                return reply({ code: 103, message: "mandatory 'payload' is missing" }).code(200);
            }
            if (!req.payload.type) {
                return reply({ code: 103, message: "mandatory 'type' is missing" }).code(200);
            }
            if (!req.payload.id) {
                return reply({ code: 103, message: "mandatory 'id' is missing" }).code(200);
            }
            if (!req.payload.secretId) {
                return reply({ code: 103, message: "mandatory 'secretId' is missing" }).code(200);
            }
            if (!req.payload.toDocId) {
                return reply({ code: 103, message: "mandatory 'toDocId' is missing" }).code(200);
            }
            if (!req.payload.name) {
                return reply({ code: 103, message: "mandatory 'name' is missing" }).code(200);
            }
            if (!req.payload.dataSize) {
                return reply({ code: 103, message: "mandatory 'dataSize' is missing" }).code(200);
            }
            /**
             * All Ok. Continue
             */
            validateCB(null)
        },
        function (funcMainCB) {

            var userExists = "members." + req.payload.from;
            var targetExists = "members." + req.payload.to;
            var condition = { [userExists]: { $exists: true }, [targetExists]: { $exists: true }, secretId: req.payload.secretId };

            /**
             * Check if the ChatList exixts or not
             */
            middleWare.Select("chatList", condition, "Mongo", {}, function (err, result) {
                if (err) {
                    return reply({ message: err.message }).code(500);
                } else {
                    (result[0]) ? funcMainCB(null, result[0]._id) : funcMainCB(null, 0);
                }
            });

        },
        function (chatId, finalCB) {
            /**
             * type: 15-offer
             */
            var name, userId, targetUserId, payload, type, messageId, creation, dataSize, secretId, thumbnail, dTime, userImage, toDocId, offerType;
            var prodName, prodImage, prodId, prodPrice, isSold;

            name = req.payload.name;
            userId = req.payload.from;
            targetUserId = req.payload.to;
            payload = req.payload.payload;
            type = req.payload.type;
            messageId = req.payload.id;
            secretId = (req.payload.secretId) ? req.payload.secretId : "";
            dTime = -1;
            creation = new Date().getTime();
            thumbnail = req.payload.thumbnail;
            userImage = req.payload.userImage;
            toDocId = req.payload.toDocId;
            dataSize = req.payload.dataSize;
            isSold = req.payload.isSold;

            if (type == '15') {
                offerType = req.payload.offerType;
                prodImage = req.payload.productImage
                prodId = req.payload.productId
                prodName = req.payload.productName
                prodPrice = req.payload.productPrice

            }
            var messageIdDB = objectId();
            if (chatId) {

                var data = {
                    $unset: { ["members." + userId + ".inactive"]: "", ["members." + targetUserId + ".inactive"]: "" },
                    $push: { "message": messageIdDB }
                };
                var condition = { _id: chatId };

                middleWare.FindAndModify("chatList",
                    data,
                    condition,
                    "Mongo",
                    { _id: 1 }, {},
                    function (getChatErr, getChatRes) {
                        if (getChatErr) console.log('error 203 : ', getChatErr)
                    })

            } else {
                // console.log('Chatlist not found')
                chatId = objectId();
                var chatDB = {
                    "_id": chatId,
                    "message": [messageIdDB],
                    "members": {
                        [userId]: {
                            "memberId": objectId(userId),
                            "status": "NormalMember",
                            "added": new Date().getTime()
                        },
                        [targetUserId]: {
                            "memberId": objectId(targetUserId),
                            "status": "NormalMember",
                            "added": new Date().getTime()
                        }
                    },
                    "initiatedBy": objectId(userId),
                    "createdAt": new Date().getTime(),
                    "chatType": "NormalChat",
                    "secretId": secretId
                }
                middleWare.Insert("chatList", chatDB, {}, "Mongo", function (err, res) {
                    if (err) console.log("error 202 : ", err);
                });

            }

            var messageDB = {
                "_id": messageIdDB,
                "messageId": messageId,
                "secretId": secretId,
                "dTime": dTime,
                "senderId": objectId(userId),
                "receiverId": objectId(targetUserId),
                "payload": payload,
                "messageType": type,
                "offerType": offerType,
                "timestamp": new Date().getTime(),
                "expDtime": 0,
                "chatId": chatId,
                "userImage": userImage,
                "toDocId": toDocId,
                "name": name,
                "dataSize": dataSize,
                "thumbnail": thumbnail,
                "isSold": (isSold) ? isSold : "",
                "members": {
                    [userId]: {
                        "memberId": objectId(userId),
                    },
                    [targetUserId]: {
                        "memberId": objectId(targetUserId),
                        "status": 1
                    }
                }
            };

            middleWare.Insert("messages", messageDB, {}, "Mongo", function (err, res) {
                if (err) console.log("error 203 : ", err);
                console.log('Message created: ' + JSON.stringify(messageDB))
            });

            //  name, from, to, payload, type, id, secretId, dTime, thumbnail, userImage, toDocId, dataSize
            var msg_mqtt_data = {
                name: name,
                from: userId,
                to: targetUserId,
                payload: payload,
                type: type, // string
                id: messageId,
                secretId: secretId, // 'product id' in this case
                dTime: -1,
                timestamp: new Date().getTime(),
                thumbnail: thumbnail,  // non mandatory
                userImage: userImage,
                toDocId: toDocId,
                dataSize: dataSize,
                isSold: isSold
            };

            if (type == '15') {
                msg_mqtt_data.offerType = offerType

                msg_mqtt_data.productId = prodId;
                msg_mqtt_data.productName = prodName;
                msg_mqtt_data.productImage = prodImage;
                msg_mqtt_data.productPrice = prodPrice;


            }
            ComnFun.publishMqtt("MessageOffer/" + userId, JSON.stringify(msg_mqtt_data));
            ComnFun.publishMqtt("MessageOffer/" + targetUserId, JSON.stringify(msg_mqtt_data));
            return reply({ message: "message sent successfully" }).code(200);

        }
    ])

}