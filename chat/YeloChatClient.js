"use strict"

const mqtt = require('mqtt');
var middleWare = require("./Controller/dbMiddleware.js");// create object of crud module
var messages = require("./Controller/statusMessages.json");// create object of statusMessages module
var logFile = require("./Controller/einstonLogs.js");// create object of statusMessages module
var moment = require('moment');
var async = require("async");
var objectId = require("mongodb").ObjectID;
const config = require("./conf.json");
var messageTypes = config.MESSAGE_TYPES;

var userStatus = {},
    calls = {
        "callId will come in signal": {
            userId: "mongoId",
            targetId: "mongoId",
            ceartion: new Date().getTime(),
            typeOfCall: 0,
            callId: "callId will come in signal",
            endTime: "when we get type=2/3/7 on Call channal we assign server current time"
        }
    };

var mqtt_config = {};

mqtt_config.options = {
    keepalive: 1000,
    clientId: "yelo_chat_api_server",
    clean: false,
    will: { topic: "client/offline", payload: "Going offline", qos: 1, retain: 1 },
    username: config.mqttUserName,
    password: config.mqttPassword
};

/**
 * Connect to MQTT Broker
 */
console.log('mqtt://' + config.MQTT_BROKER_HOST + ':' + config.MQTT_BROKER_PORT)
const options = {
    username: config.mqttUserName,
    password: new Buffer(config.mqttPassword)
};
const client = mqtt.connect('mqtt://' + config.MQTT_BROKER_HOST + ':' + config.MQTT_BROKER_PORT, mqtt_config.options);

client.on('connect', () => {
    /**
     * On successfuly connection to MQTT Broker
     * As a client subscribes to all required topics
     */
    client.subscribe("Message/#", { qos: 1 });
    client.subscribe("Acknowledgement/#", { qos: 1 });
    client.subscribe("GetChats/#", { qos: 1 });
    client.subscribe("GetMessages/#", { qos: 1 });

    // console.log('>>> MQTT Connected and setup.');
});


/**
 * All the data to the client will recieved through 'message' event
 * topic: topic to which the message published (on of the subscribed topics)
 * message: actual message
 */
client.on('message', (topic, message) => {

    switch (topic) {

        case String(topic.match(/^Acknowledgement.*/)):
            {
                Acknowledgement(message.toString());
                break;
            }

        case String(topic.match(/^Message.*/)):
            {
                message = JSON.parse(message.toString());
                insertMessage(message);
                break;
            }

    }
    console.log("Message recieved >> " + message.toString() + ", topic : " + topic);
})


/**
 * On MQTT close connection event
 */
client.on("close", (packet) => {
    console.log('>>> MQTT Closed: ', packet);
});


/**
 * On MQTT disconnect event 
 */
client.on("disconnect", (packet) => {
    console.log('>>> MQTT Disconected: ', packet);
});


/**
 * On MQTT error event
 */
client.on("error", (packet) => {
    console.log('>>> MQTT Error: ', packet);
});


/**
 * 
 * @param {*fiberBaseUserId} fId :  Registered fiberBaseUserId
 * @param {*UserStatus} Status : Online,Offline,Timeout
 */
function setUserStatus(fId, Status) {
    /**
     * Update the mogoDB 'userList' collection 
     */
    middleWare.Update("userList", { status: Status }, { "fiberBaseUserId": fId }, "Mongo", (e, s) => {
        if (e) {
            logFile.loggerError(messages.UPDATE_ERROR + "--" + e);
            console.log(messages.UPDATE_ERROR + "--Mongo", e);
        }
    })

}


/**
 * Function to create a new message and insert into 'messages' collection in MongoDB 
 */
function insertMessage(message) {

    var name, userId, targetUserId, payload, type, messageId, creation, dataSize, secretId, thumbnail, dTime, userImage, toDocId;

    userId = message.from;
    targetUserId = message.to;
    payload = message.payload;
    type = message.type;
    messageId = message.id;
    secretId = (message.secretId) ? message.secretId : "";
    dTime = (message.dTime || message.dTime == 0) ? message.dTime : -1;
    creation = new Date().getTime();
    thumbnail = message.thumbnail;
    userImage = message.userImage;
    toDocId = message.toDocId;
    name = message.name;
    dataSize = message.dataSize

    async.waterfall([

        function (callback) {
            /**
             * Check if the ChatList exixts or not
             */
            var condition = [
                { "senderId": objectId(userId), "receiverId": objectId(targetUserId) },
                { "senderId": objectId(targetUserId), "receiverId": objectId(userId) }
            ];

            middleWare.Select("messages", { $or: condition, secretId: secretId }, "Mongo", {}, function (err, result) {
                if (err) {
                    callback(err, null);
                } else {
                    (result[0]) ? callback(null, result[0].chatId) : callback(null, 0);
                }
            });
        },
        function (chatId, callback) {

            var messageIdDB = objectId();

            if (chatId) {
                /**
                 * ChatList exists, Update the new message to the same ChatList
                 */
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
                /**
                 * No ChatList found, create one
                 */
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

            /**
             * create the message and update the 'messages' collection
             */
            var messageDB = {
                "_id": messageIdDB,
                "messageId": messageId,
                "secretId": secretId,
                "dTime": dTime,
                "senderId": objectId(userId),
                "receiverId": objectId(targetUserId),
                "payload": payload,
                "messageType": type,
                "timestamp": new Date().getTime(),
                "expDtime": 0,
                "chatId": chatId,
                "userImage": userImage,
                "toDocId": toDocId,
                "name": name,
                "dataSize": dataSize,
                "thumbnail": thumbnail,
                "members": {
                    [userId]: {
                        "memberId": objectId(userId),
                        // "status": ""
                    },
                    [targetUserId]: {
                        "memberId": objectId(targetUserId),
                        "status": 1,
                        // "readAt": 0,
                        // "deliveredAt": new Date().getTime()
                    }
                }
            }

            middleWare.Insert("messages", messageDB, {}, "Mongo", function (err, res) {
                if (err) console.log("error 203 : ", err);
            });

            callback(null, "message created.");
        }
    ]);
}


function saveMessageLog(data) {
    var currentDate = new Date().getFullYear() + "-" + (new Date().getMonth() + 1) + "-" + new Date().getDate();
    var condition = [
        { "term": { userId: data.from.toLowerCase() } },
        { "term": { dateAt: currentDate } }
    ];

    middleWare.SelectWithOr("messageLogs", condition, "ESearch", {}, function (err, result) {

        console.log("Data ====>>>", result)
        switch (!(result.hasOwnProperty('hits')) || !(result.hits.hasOwnProperty('hits'))) {
            // switch (typeof result.hits.hits[0] != undefined) {

            case (false): {
                // no Data Found
                console.log("No data Found");
                var dataToSave = {
                    userId: data.from,
                    dateAt: currentDate,
                    messageLogs: {},
                    callLogs: {},
                    receivedAudioCall: [],
                    initiatAudioCall: [],
                    initiatVideoCall: []
                };

                for (var index = 0; index < messageTypes.length; index++) {
                    dataToSave.messageLogs[messageTypes[index]] = 0;
                    if (index == data.type) {
                        dataToSave.messageLogs[messageTypes[index]] = 1;
                    }
                }

                middleWare.Insert("messageLogs", dataToSave, {}, "ESearch", function (err, res) { });
                middleWare.Insert("messageLogs", dataToSave, {}, "Mongo", function (err, res) { });
                break;
            }
            case (true): {
                var _id = result.hits.hits[0]._id;
                var incrise = result.hits.hits[0]._source.messageLogs[messageTypes[data.type]] + 1;
                //Data Found from DB
                console.log(" data Found successfully.");
                var dataToSave = {
                    messageLogs: {},
                };

                for (var index = 0; index < messageTypes.length; index++) {
                    if (index == data.type) {
                        dataToSave.messageLogs[messageTypes[index]] = incrise;
                    }
                }
                condition = [
                    { "term": { userId: data.from.toLowerCase() } },
                    { "term": { dateAt: currentDate } }
                ];

                middleWare.Update("messageLogs", dataToSave, _id, "ESearch", function (err, res) { });
                condition = {
                    userId: data.from,
                    dateAt: currentDate
                }
                middleWare.Update("messageLogs", dataToSave, condition, "Mongo", function (err, res) { });
                break;
            }
            default: {
                console.log("Error : 100 ", err);
            }
        }
    })
}



function Acknowledgement(data) {

    data = JSON.parse(data);
    console.log(">> Message Acknowledgement", data);
    /**
     { 
         to: '5988253b50e23910a3bd5a83',
         msgIds: [ '1502375529082' ],
         dTime: -1,
         secretId: 'wGtTnIJaYO80ZbuVFynJPnPLabs3Embed',
         from: '59847dbd3fe3042557c0745b',
         status: '2',
         doc_id: '3efb89ae-29cf-4242-b62d-4a7f1d5b0f97' 
      }
     */

    var userId = data.from;
    var messageId = data.msgIds;
    var status = parseInt(data.status);
    var dtime = (data.dTime) ? parseInt(data.dTime) : null;
    var targetId = data.to;
    var updaetStatus = "members." + userId + ".status";

    /**
     * status: 2- delivered, 3- read
     */
    switch (parseInt(status)) {
        case "2":
        case 2: {
            /**
             * Message Delivered to the recipients
             */
            var deliveredAt = "members." + userId + ".deliveredAt";

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
            break;
        }
        case "3":
        case 3: {
            /**
             * Message Read by the recipients
             */
            if (data.secretId && data.secretId != "") {
                /**
                 * secret chat
                 * get all the documents to update and update thier expiry time
                 */
                var condition = {
                    $and: [
                        { $and: [{ "receiverId": objectId(userId) }, { "senderId": objectId(targetId) }] },
                        { ["members." + userId + ".status"]: { $exists: true } },
                        { ["members." + userId + ".status"]: { $ne: 3 } },
                        { "timestamp": { "$lte": new Date().getTime() } },
                        { "payload": { $ne: "" } }
                    ]
                }

                middleWare.Select("messages", condition, "Mongo", {}, function (getMsgErr, getMsgResult) {
                    if (getMsgErr) {

                    } else if (getMsgResult.length > 0) {

                        async.each(getMsgResult, function (msgObj, msgCB) {
                            /**
                             * update the each doc
                             * get the 'dTime' and then calculate the 'expDtime'
                             */
                            var dataToUpdate = { ["members." + userId + ".status"]: 3, ["members." + userId + ".readAt"]: new Date().getTime() }
                            if (msgObj.dTime > 0) {
                                dataToUpdate['expDtime'] = new Date().getTime() + (msgObj.dTime * 1000)
                            }

                            middleWare.Update("messages", dataToUpdate, { _id: msgObj._id }, "Mongo", function (updtErr, updtResult) {
                                if (updtErr) {
                                    console.log("Error : messages 101 ", err);
                                }
                            });

                            msgCB(null);
                        })
                    }
                })

            } else {
                /**
                 * normal chat
                 * update all the document in single query
                 */

                var condition = {
                    $and: [
                        { $and: [{ "receiverId": objectId(userId) }, { "senderId": objectId(targetId) }] },
                        { ["members." + userId + ".status"]: { $exists: true } },
                        { ["members." + userId + ".status"]: { $ne: 3 } },
                        { "timestamp": { "$lte": new Date().getTime() } }
                    ]
                }

                var dataToUpdate = { ["members." + userId + ".status"]: 3, ["members." + userId + ".readAt"]: new Date().getTime() }

                middleWare.Update("messages", dataToUpdate, condition, "Mongo", function (err, result) {
                    if (err) {
                        console.log("Error : messages 102 ", err);
                    }
                });
            }
            break;
        }

    }
}
