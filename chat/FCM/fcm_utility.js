'use strict';

const admin = require("firebase-admin");

/** 
 * Get the 'service account credential' file (json)
 * and pass it to initialisze the app 
 */
admin.initializeApp({
    credential: admin.credential.cert(require('./creds/YELO-13c009faf073.json'))
});


/** 
 * Function to send push notification to a specified topic 
 * topic: should follow [a-zA-Z0-9-_.~%] format
 * payload: must be object 
        format: { 
            notification : { body : "string", title : "string", icon : "string" },
            data: { field1: 'value1', field2: 'value2' } // values must be string
 */
function sendPushToTopic(topic, payload, callback) {

    /** 
     * Send a message to devices subscribed to the provided topic.
     */
    admin.messaging().sendToTopic(topic, payload)
        .then(function (response) {
            /** Successfully sent message */
            return callback(null, { err: 0, message: "notification sent" })
        })
        .catch(function (error) {
            /** Error sending message  */
            return callback({ err: 1, message: error.message, error: error })
        });
}


/**
 * Function to send push notification to specified push tokens
 * registrationTokens: Array of registration tokens(push tokens)  
 * payload: must be object 
        format: { 
            notification : { body : "string", title : "string", icon : "string" },
            data: { field1: 'value1', field2: 'value2' } // values must be string
 */
function sendPushToToken(registrationTokens, payload, callback) {

    if (Array.isArray(registrationTokens) && registrationTokens.length > 0) {
        /** 
         * Send a message to devices subscribed to the provided topic.
         */
        admin.messaging().sendToDevice(registrationTokens, payload)
            .then(function (response) {
                /** Successfully sent message */
                return callback(null, { err: 0, message: "notification sent" })
            })
            .catch(function (error) {
                /** Error sending message  */
                return callback({ err: 1, message: error.message, error: error })
            });
    } else {
        return callback({ err: 1, message: 'registrationTokens: Array expected.', error: error })
    }

}

/** export the functions */
exports.sendPushToTopic = sendPushToTopic
exports.sendPushToToken = sendPushToToken

/**
 * Ref:
 *  Initialize: https://firebase.google.com/docs/admin/setup#initialize_the_sdk
 *  Send Message to a topic: https://firebase.google.com/docs/cloud-messaging/admin/send-messages#send_to_a_topic
 */