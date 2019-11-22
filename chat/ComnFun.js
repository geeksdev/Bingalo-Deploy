var conf = require('./conf');
var middleWare = require("./Controller/dbMiddleware.js");
const mqtt = require('mqtt');
var async = require("async");
var phoneUtil = require('google-libphonenumber').PhoneNumberUtil.getInstance();
var objectId = require("mongodb").ObjectID;


var mqtt_config = {};

mqtt_config.options = {
    keepalive: 1000,
    clientId: "yelo_chat_api_server",
    clean: false,
    will: { topic: "client/offline", payload: "Going offline", qos: 1, retain: 1 },
    username: conf.mqttUserName,
    password: conf.mqttPassword
};

const options = {
    username: conf.mqttUserName,
    password: new Buffer(conf.mqttPassword)
};
const client = mqtt.connect('mqtt://' + conf.MQTT_BROKER_HOST + ':' + conf.MQTT_BROKER_PORT, mqtt_config.options);

// var config = {
//     mqtt: {
//         options: {
//             clientId: "Client_" + new Date().getTime()
//         }
//     }
// };
// var MQTTClient = mqtt.connect('mqtt://104.236.32.23:1884', config.mqtt.options);

module.exports = {

    sendFCMPush: function (pushToken, message, OData) {

        var FCM = require('fcm-node');

        var fcm = new FCM(conf.SERVER_FCM_KEY);

        var message = {
            to: pushToken,
            collapse_key: 'your_collapse_key',


            notification: {
                //   title: 'send Push',
                body: message
            },

            data: {  //you can send only notification or only data(or include both)
                body: { test: 123 }
                // my_another_key: 'my another value'
            }

        };

        //callback style
        fcm.send(message, function (err, response) {
            if (err) {
                console.log("Something has gone wrong!", err);
            } else {
                console.log("Successfully sent with response: ", response);

            }
        });

    },

    postContacts: function (_id) {
        var _id = _id, countryCode = "", number = "", mobileNo = "";
        var localNumber = "";
        var localContacts = {};
        var numberStr = "";
        var swissNumberProto;
        var contacts = [], userContacts;

        middleWare.Select(_id + '', "hgetall", "Redis", {}, function (err, result) {

            console.log("result at Redis", result);
            if (err) {
                console.log("DB Error 101: ", err);
            } else if (result.number) {
                console.log("103");
                userContacts = JSON.parse(result.number);

                async.waterfall([

                    function (callback) {
                        middleWare.Select("userList", { _id: objectId(_id) }, "Mongo", {}, function (err, result) {
                            if (err) {
                                console.log("in defualt err 200 :", err);
                            }
                            else if (result[0]) {
                                countryCode = result[0].countryCode;
                                number = result[0].number;
                                mobileNo = result[0].mobileNo;

                                for (index = 0; index < userContacts.length; index++) {
                                    try {
                                        console.log("userContacts[index].number : ", userContacts[index]);
                                        numberStr = userContacts[index].number.replace(/[^0-9 ]/g, "");
                                        numberStr = "+" + Number(numberStr).toString();

                                        swissNumberProto = phoneUtil.parse(numberStr, null);

                                        if (phoneUtil.isValidNumber(swissNumberProto) && number != userContacts[index].number) {
                                            //console.log("patel testing " + numberStr + " : actual type : " + phoneUtil.getNumberType(swissNumberProto)+ "our type : "+ userContacts[index].type + " boolean : " + phoneUtil.isValidNumber(swissNumberProto));
                                            if (phoneUtil.getNumberType(swissNumberProto) == userContacts[index].type || phoneUtil.getNumberType(swissNumberProto) == 2 || phoneUtil.getNumberType(swissNumberProto) < 0 || phoneUtil.getNumberType(swissNumberProto) == 0) {
                                                contacts.push(userContacts[index].number);
                                                localContacts[userContacts[index].number] = userContacts[index].number;
                                            }
                                        } else {
                                            localNumber = userContacts[index].number;
                                            userContacts[index].number = userContacts[index].number.replace(/[^0-9 ]/g, "");
                                            userContacts[index].number = countryCode + Number(userContacts[index].number).toString();

                                            numberStr = userContacts[index].number;
                                            swissNumberProto = phoneUtil.parse(numberStr, null);
                                            //console.log(swissNumberProto);
                                            //console.log("patel testing1 " + numberStr + " : actual type : " + phoneUtil.getNumberType(swissNumberProto)+ "our type : "+ userContacts[index].type + " boolean : " + phoneUtil.isValidNumber(swissNumberProto));
                                            if (phoneUtil.isValidNumber(swissNumberProto) && number != userContacts[index].number) {
                                                if (phoneUtil.getNumberType(swissNumberProto) == userContacts[index].type || phoneUtil.getNumberType(swissNumberProto) == 2 || phoneUtil.getNumberType(swissNumberProto) < 0 || phoneUtil.getNumberType(swissNumberProto) == 0) {
                                                    contacts.push(userContacts[index].number);
                                                    localContacts[userContacts[index].number] = localNumber;
                                                }

                                            }
                                        }
                                        // console.log(swissNumberProto.values_);
                                    } catch (err) {
                                        try {


                                            //console.log("patel testing2 " + numberStr + " : actual type : " + phoneUtil.getNumberType(swissNumberProto)+ "our type : "+ userContacts[index].type);
                                            console.log("NumberParseException was thrown: " + err);
                                            localNumber = userContacts[index].number;
                                            userContacts[index].number = userContacts[index].number.replace(/[^0-9 ]/g, "");
                                            userContacts[index].number = countryCode + Number(userContacts[index].number).toString()
                                            numberStr = userContacts[index].number;
                                            console.log("numberStr : " + numberStr);
                                            swissNumberProto = phoneUtil.parse(numberStr, "");
                                            if (phoneUtil.isValidNumber(swissNumberProto) && number != userContacts[index].number) {
                                                if (phoneUtil.getNumberType(swissNumberProto) == userContacts[index].type || phoneUtil.getNumberType(swissNumberProto) == 2 || phoneUtil.getNumberType(swissNumberProto) < 0 || phoneUtil.getNumberType(swissNumberProto) == 0) {
                                                    contacts.push(userContacts[index].number);
                                                    localContacts[userContacts[index].number] = localNumber;
                                                    console.log("add in local suucessfully");
                                                }
                                            }
                                        } catch (err) {

                                        }
                                    }

                                }
                                /**
                                 * In contacts[] have numbers with countryCode
                                 * at now we assum all contact are inactive so we also push in inactiveContacts[] and when we get active contact we remove active contact from inactive contact.
                                 */

                                var condition = [{ number: "xyz" }];
                                var activeContacts = [];
                                var inactiveContacts = [];

                                for (index = 0; index < contacts.length; index++) {
                                    inactiveContacts.push(contacts[index]);
                                    condition.push({ "number": contacts[index] });
                                }
                                console.log("condition : ", condition);
                                console.log("inactiveContacts : ", inactiveContacts);
                                /**
                                 * now we have condition[] for elastic search and inactiveContact[]
                                 * 
                                 * now we go for get all active contacts from elastic search
                                 */
                                middleWare.Select("userList", { $or: condition }, "Mongo", {}, function (err1, result) {

                                    if (err1) {
                                        console.log("Error 300 : ", err1);
                                    }
                                    else {

                                        console.log("result : ", result);

                                        var mqttDataTosend = [];
                                        for (index = 0; index < result.length; index++) {
                                            /**
                                             * In this for loop we got all active contacts.
                                             * so,
                                             * we push in activeContacts[],
                                             * remove from inactiveContacts[],
                                             * send MQTT msg to notify that find number is now join.
                                             */
                                            activeContacts.push(result[index].number);
                                            indexId = inactiveContacts.indexOf(result[index].number);
                                            inactiveContacts.splice(indexId, 1);
                                            mqttData = {
                                                _id: result[index]._id,
                                                localNumber: localContacts[result[index].number],
                                                number: result[index].number,
                                                profilePic: result[index].profilePic,
                                                socialStatus: result[index].socialStatus
                                            }
                                            mqttDataTosend.push(mqttData);
                                        }
                                        publishMqtt("ContactSync/" + _id, JSON.stringify({ "contacts": mqttDataTosend }));
                                        console.log("msg send successfully.", localContacts);


                                        async.parallel([

                                            function (callback) {
                                                if (activeContacts[0]) {
                                                    console.log("at active conctact 111");
                                                    /**
                                                     * Here we Set contacts to db at user Account
                                                     */
                                                    var dataToPush = {
                                                        $set: { contacts: activeContacts }
                                                    };
                                                    var cond = { number: number };
                                                    middleWare.UpdateWithPush("userList", dataToPush, cond, "Mongo", function (err, result) {
                                                        if (err) {
                                                            console.log("err : 1 :", err);
                                                        }
                                                    });


                                                    for (index = 0; index < activeContacts.length; index++) {

                                                        dataToPush = { $addToSet: { "existInUsers": objectId(_id) } }
                                                        condition = { number: activeContacts[index] };
                                                        middleWare.UpdateWithPush("userList", dataToPush, condition, "Mongo", function (err, result) {
                                                            if (err) {
                                                                console.log("err : 3 :", err);
                                                            }
                                                        });
                                                    }

                                                    callback();
                                                } else {
                                                    var dataToPush = {
                                                        $set: { contacts: [] }
                                                    };
                                                    var cond = { number: number };
                                                    middleWare.UpdateWithPush("userList", dataToPush, cond, "Mongo", function (err, result) {
                                                        if (err) {
                                                            console.log("err : 1 :", err);
                                                        }
                                                    });
                                                    callback();
                                                }
                                            },
                                            function (callback) {

                                                if (inactiveContacts.length > 0) {
                                                    condition = [];
                                                    for (index = 0; index < inactiveContacts.length; index++) {
                                                        condition.push({ "number": inactiveContacts[index] });
                                                    }
                                                    /**
                                                     * Here we check inactive user is already exists or not
                                                     * if exist then push _id to find User,
                                                     * else create new doc for that inactivecontact user
                                                     */
                                                    middleWare.Select("inactiveUserList", { $or: condition }, "Mongo", {}, function (err, result) {

                                                        console.log("condition of inactiveUserList ", condition);
                                                        console.log("result of inactiveUserList ", result);
                                                        if (err) {
                                                            callback(err);
                                                        }
                                                        else if (result[0]) {
                                                            console.log("else if inactive ");
                                                            /**
                                                              * In elastic search we got morethen 1 contact or 0 contact which exist in inactive contacts
                                                              */
                                                            for (index = 0; index < result.length; index++) {
                                                                /**
                                                                 * if we got inactive user then push that _id at inactive Number(user)
                                                                 * else we create new one.
                                                                 */
                                                                indexId = inactiveContacts.indexOf(result[index].number);
                                                                inactiveContacts.splice(indexId, 1);

                                                                var dataToPush = {
                                                                    $addToSet: { existInUsers: objectId(_id) }
                                                                };
                                                                var cond = { number: result[index].number };

                                                                middleWare.UpdateWithPush("inactiveUserList", dataToPush, cond, "Mongo", function (err, result1) { });

                                                                cond = [{ "term": { "number": result[index].number.replace("+", "") } }];

                                                                // dataToPush = { "inline": "ctx._source.existInUsers.add(" + 111 + ")", lang: 'painless' },
                                                                //     middleWare.UpdateWithPush("inactiveUserList", dataToPush, cond, "ESearch", function (err, result1) {
                                                                //     if (err) {
                                                                //         console.log("Error ElasticSearch 103 : ", err);
                                                                //     } else {
                                                                //         console.log("result ElasticSearch 103 :", result1);
                                                                //     }
                                                                // });
                                                                console.log("AAAAAAAAAAAAAAAAAAAAAAAAAAAAA");
                                                                addtosetWithElasticSearch(cond, cond, cond, cond);
                                                                console.log("BBBBBBBBBBBBBBBBBBBBBBBBBBBBB");

                                                            }

                                                            if (inactiveContacts.length > 0) {
                                                                /**
                                                                 * if still exitst user at inactive arry means this number is not exists at DB.
                                                                 * so we create new entry for this user(number) exists at inactiveContacts[]
                                                                 */
                                                                for (index = 0; index < inactiveContacts.length; index++) {
                                                                    dataToSave = {
                                                                        number: inactiveContacts[index],
                                                                        _id: new objectId(),
                                                                        existInUsers: [objectId(_id)]
                                                                    }
                                                                    middleWare.Insert("inactiveUserList", dataToSave, {}, "Mongo", function (err, resultUser) { });

                                                                    middleWare.Insert("inactiveUserList", dataToSave, {}, "ESearch", function (err, resultUser) {
                                                                        if (err) {
                                                                            console.log("Error ElasticSearch 102 : ", err);
                                                                        } else {
                                                                            console.log("result ElasticSearch 102 :", resultUser);
                                                                        }
                                                                    });

                                                                }
                                                            }
                                                            callback();
                                                        }
                                                        else {
                                                            console.log("else inactive ");
                                                            if (inactiveContacts.length > 0) {
                                                                console.log("at inactive");
                                                                /**
                                                                 * if still exitst user at inactive arry means this number is not exists at DB.
                                                                 * so we create new entry for this user(number) exists at inactiveContacts[]
                                                                 */
                                                                for (index = 0; index < inactiveContacts.length; index++) {
                                                                    dataToSave = {
                                                                        number: inactiveContacts[index],
                                                                        _id: new objectId(),
                                                                        existInUsers: [objectId(_id)]
                                                                    }

                                                                    middleWare.Insert("inactiveUserList", dataToSave, {}, "Mongo", function (err, resultUser) { });
                                                                    middleWare.Insert("inactiveUserList", dataToSave, {}, "ESearch", function (err, resultUser) {


                                                                        if (err) {
                                                                            console.log("Error ElasticSearch 101 : ", err);
                                                                        } else {
                                                                            console.log("result ElasticSearch 101 :", resultUser);
                                                                        }
                                                                    });


                                                                }
                                                            }
                                                        }
                                                    });
                                                } else {
                                                    callback();
                                                }
                                            }
                                        ]);
                                    }
                                });
                            } else {
                                console.log("no data found 201 :", result);
                            }
                        });
                    },
                    function (callback) {
                        middleWare.Delete(_id, {}, "Redis", function (err, result) {
                            switch (err) {
                                case undefined: {
                                    console.log("Data Successfully deleted From Redis ", _id);
                                    break;
                                }
                                default: {
                                    console.log("Data Delete in defualt err :", err);
                                    break;
                                }
                            }
                            callback();
                        });
                    }
                ]);
            } else {
                console.log("Noresult in redis 102");
            }

        });
    },


    publishMqtt: function (topic, message) {

        var config = {
            mqtt: {
                options: {
                    // keepalive: 100,
                    clientId: "Client_" + new Date().getTime(),
                    // clean: false,
                    // will: { topic: "test1", payload: "i m goto offline-232323232222", qos: 1, retain: 1 }
                }
            }
        };

        // // config.mqtt.options = {
        // //     // keepalive: 100,
        // //     clientId: "Client_" + new Date().getTime(),
        // //     // clean: false,
        // //     // will: { topic: "test1", payload: "i m goto offline-232323232222", qos: 1, retain: 1 }
        // // };

        // /**
        //  * IS IT NECCESSARY TO CONNECT EVERY TIME ?
        //  */
        // var client = mqtt.connect('mqtt://104.236.32.23:1883', config.mqtt.options);

        console.log("Publishing to > " + topic);
        client.publish(topic, message, { qos: 1 })
        console.log('Published..');

    },

}

function publishMqtt(topic, message) {
    var config = {};
    config.mqtt = {};

    config.mqtt.options = {

        // keepalive: 100,
        clientId: "Client_11111" + new Date().getTime(),
        // clean: false,
        // will: { topic: "test1", payload: "i m goto offline-232323232222", qos: 1, retain: 1 }
    };

    // var client = mqtt.connect('mqtt://104.236.32.23:1883', config.mqtt.options);

   

    console.log('abcdefgh');
    console.log('abcdefgh');
    console.log('abcdefgh');
    console.log('abcdefgh');
    console.log(client);
    client.publish(topic, message, { qos: 1 })
    console.log('MQTT publish: ', topic, message)

}

function addtosetWithElasticSearch(tableName, key, value, condition) {
    middleWare.SelectWithOr("inactiveUserList", condition, "ESearch", {}, function (err, result) {
        if (err) {
            console.log("Error ElasticSearch 103 : ", err);
        } else if (result.hits.hits[0]) {
            console.log("result ElasticSearch 103 :", result.hits.hits[0]);
            result = result.hits.hits[0]._source;
            if (result.existInUsers.indexOf("597f1dd9fc451b423675a9fb") > -1) {
                //In the array!
                console.log("in array");
            } else {
                console.log("not in array");
                //Not in the array
                addInArrayElasticSearch(condition);
            }
        }
    });
}

function addInArrayElasticSearch(condition) {
    var cond = condition;

    var dataToPush = { "inline": "ctx._source.existInUsers.add(" + 111 + ")", lang: 'painless' };

    middleWare.UpdateWithPush("inactiveUserList", dataToPush, cond, "ESearch", function (err, result1) {
        if (err) {
            console.log("Error ElasticSearch 103 : ", err);
        } else {
            console.log("result ElasticSearch 103 :", result1);
        }
    });
}