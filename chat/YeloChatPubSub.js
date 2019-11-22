var redis = require('redis');
var client = redis.createClient();
var comnFun = require("./ComnFun.js");

var EVENT_SET = '__keyevent@0__:hset';

client.on('message', function (channel, key) {
    switch (channel) {
        case EVENT_SET:
            console.log('Key "' + key + '" set!');
            comnFun.postContacts(key);
            break;
    }
    
});

client.subscribe(EVENT_SET);