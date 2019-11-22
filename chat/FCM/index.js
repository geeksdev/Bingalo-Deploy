'use strict';

const fcmUtil = require('./fcm_utility');

exports.push_topic = fcmUtil.sendPushToTopic
exports.push_token = fcmUtil.sendPushToToken