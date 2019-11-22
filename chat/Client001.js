var mqtt = require('mqtt');
var count = 0;

var config = {};
config.mqtt = {};

config.mqtt.options = {

    keepalive: 160,
    clientId: 'mqtt-sub-0010081',
    clean: false,
    will: { topic: "user/timeout", payload: "1008", qos: 1, retain: 1 }
};


var client = mqtt.connect("mqtt://104.236.32.23:1884", config.mqtt.options);

client.on('connect', function () {
    console.log('mqtt client connected');
    var data = "{\"name\": \"Alok1\",\"id\": \"111\",\"toDocId\": \"123\",\"from\": \"mBSIO1\",\"sentDate\": \"2017-07-12\",\"to\": \"1008\",\"payload\": \"SGV5\",\"timeStamp\": \"11\",\"type\": \"0\"  }";

    // client.publish("user/message", data, { qos: 1 })
    // client.publish("user/online", "1008", { qos: 1 })
    client.subscribe("user/newJoin/#", { qos: 1 });
    data = "{\"userId\":\"mBSIO1\",\"activeUserId\":\"1008\"}";
    client.publish("user/activate", data, { qos: 1 })


});
client.on('error', function (error) {
    console.log(error);
});

client.on('reconnect', function (error) {
    console.log('reconnecting');
});
client.on("close", (packet) => {
    console.log('closeAA', packet);
});
client.on("disconnect", (packet) => {
    console.log('Disconected');
    var json = { from: "1008", msg: "hello dipen", to: "2006" };
    client.publish("user/offline", JSON.stringify(json), { qos: 1 })
});

client.on('message', (topic, message, packet) => {
    console.log("received message " + message.toString() + ", topic : " + topic);

});