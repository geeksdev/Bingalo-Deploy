const moment = require('moment');
const async = require('async');
const pushController = require('./PushController');
const config = require('../config');
const request = require('request');
const http = require('http');
const qs = require("querystring");

module.exports = function (app, express) {
    var Router = express.Router();

    /**
     * API to make offers
     * @updated 21st April 2017
     * @param {} offerStatus
     * @param {} postId
     * @param {} type
     * @param {} membername
     */

    Router.post('/makeOffer', function (req, res) {
        // console.log(req.body);
        var username = req.decoded.name;
        var offerStatus;
        var query = '';
        var responseObj = {};
        var label;
        var time = moment().valueOf();

        if (!(req.body.offerStatus.toString())) return res.send({ code: 422, message: 'mandatory parameter offerStatus missing' }).status(422);
        switch (req.body.offerStatus) {
            case "0": //rejected
                offerStatus = 0;
                break;
            case "1": //make
                offerStatus = 1;
                // if (!(req.body.location || req.body.latitude || req.body.longitude))
                //     return res.send({ code: 422, message: 'mandatory paramters location, latitude and longitude missing' }).status(422);
                break;
            case "2": //accepted
                offerStatus = 2;
                break;

            case "3": //counter
                offerStatus = 3;
                break;

            default:
                return res.send({ code: 400, message: 'offerStatus value invalid' }).status(400);
        }

        if (!req.body.postId)
            return res.send({ code: 422, message: 'mandatory parameter postId missing' }).status(422);
        if (!req.body.price)
            return res.send({ code: 422, message: 'mandatory parameter price missing' }).status(422);
        if (!req.body.type.toString())
            return res.send({ code: 422, message: 'mandatory parameter type missing' }).status(422);
        if (!req.body.membername)
            return res.send({ code: 422, message: 'mandatory parameter membername missing' }).status(422);
        if (username === req.body.membername.trim() && offerStatus === 1)
            return res.send({ code: 409, message: 'can not make offer to self' }).status(409);

        switch (req.body.type.toString()) {
            case "0":
                label = 'Photo';
                break;
            case "1":
                label = 'Video';
                break;
            default:
                return res.send({ code: 422, message: 'illegal value for type' }).status(422);
        }


        async.waterfall([
            //function to check if the product has been marked as sold, if not make offser else return 
            function checkOfferstatus(callback) {

                // var checkOfferStatusQuery = `MATCH (a : User)-[o : offer {offerType : ` + 2 + `}]->(posts : ` + label + ` {postId : ` + parseInt(req.body.postId) + `}) `
                //     + `WHERE a.username <> "` + req.body.membername.trim() + `" RETURN DISTINCT COUNT(o) AS offerAccepted; `;

                var checkSoldQuery = `MATCH (posts : ` + label + ` {postId : ` + parseInt(req.body.postId) + `}) `
                    + `WHERE toInt(posts.sold) = ` + 1 + ` OR toInt(posts.sold) = ` + 2 + ` `
                    + `RETURN DISTINCT COUNT(posts) AS sold; `;
                // console.log(checkSoldQuery);
                dbneo4j.cypher({ query: checkSoldQuery }, (err, data) => {
                    if (err) {
                        responseObj = {
                            code: 500,
                            message: 'internal server error',
                            error: err
                        };
                        callback(responseObj, null);
                    }
                    // return res.send(data);
                    else if (data[0].sold >= 1) {
                        responseObj = {
                            code: 409,
                            message: 'conflict, product sold already',
                            data: data
                        };
                        callback(responseObj, null);
                    } else {
                        callback(null, data[0]);
                    }
                });
            },
            function makeOffer(result, callback) {
                //if membername is equal to the username and user is trying to accept that offer 
                //i-e if the seller is trying to accpet an offer make a replica of the offer relation for the buyer as well

                if (username === req.body.membername.trim() && offerStatus === 2) {
                    req.check('buyer', 'mandatory parameter buyer missing').notEmpty();
                    var errors = req.validationErrors();
                    if (errors) return res.status(422).send({ code: 422, message: errors[0].msg });
                    var buyer = req.body.buyer.trim();

                    // console.log('here');
                    var makeOfferQuery = 'MATCH (a : User {username : "' + username + '"}), (d : User {username : "' + buyer + '"}), '
                        + '(b : ' + label + ' {postId : ' + parseInt(req.body.postId) + '})<-[p : POSTS]-(c : User {username : "' + username + '"}) '
                        + 'CREATE UNIQUE (a)-[offerRelation : offer {offerType : ' + parseInt(req.body.offerStatus) + ', time : ' + parseInt(time) + ', price : ' + parseFloat(req.body.price) + '}]->(b) '
                        + ', (d)-[offerRelation2 : offer {offerType : ' + parseInt(req.body.offerStatus) + ', time : ' + parseInt(time) + ', price : ' + parseFloat(req.body.price) + '}]->(b) '
                        + ', (a)-[nt : Notification {notificationType : ' + 6 + ', offerType : ' + offerStatus + ', message : "offer", createdOn : ' + parseInt(time) + ', seenStatus : ' + 0 + '}]->(b) '
                        + 'RETURN DISTINCT ID(a) AS userId, a.profilePicUrl AS userProfilePicUrl, a.username AS username, ID(c) AS memberId, c.username AS membername, c.pushToken AS memberPushToken, offerRelation.offerType AS offerType, '
                        + 'offerRelation.time AS time, offerRelation.price AS price, ID(offerRelation) AS offerId, b.postId AS postId, b.mainUrl AS mainUrl, '
                        + 'b.currency AS currency, b.thumbnailImageUrl AS thumbnailImageUrl, a.mqttId AS usermqttId, d.mqttId AS membermqttId LIMIT 1; ';
                } else {
                    if (username != req.body.membername.trim() && offerStatus === 2) {
                        // console.log('hherljle');
                        var makeOfferQuery = 'MATCH (a : User {username : "' + username + '"}), (d : User {username : "' + req.body.membername.trim() + '"}), '
                            + '(b : ' + label + ' {postId : ' + parseInt(req.body.postId) + '})<-[p : POSTS]-(c : User {username : "' + req.body.membername.trim() + '"}) '
                            + 'CREATE UNIQUE (a)-[offerRelation : offer {offerType : ' + parseInt(req.body.offerStatus) + ', time : ' + parseInt(time) + ', price : ' + parseFloat(req.body.price) + '}]->(b) '
                            + ', (d)-[offerRelation2 : offer {offerType : ' + parseInt(req.body.offerStatus) + ', time : ' + parseInt(time) + ', price : ' + parseFloat(req.body.price) + '}]->(b) '
                            + ', (a)-[nt : Notification {notificationType : ' + 6 + ', offerType : ' + offerStatus + ', message : "offer", createdOn : ' + parseInt(time) + ', seenStatus : ' + 0 + '}]->(b) '
                            + 'RETURN DISTINCT ID(a) AS userId, a.profilePicUrl AS userProfilePicUrl, a.username AS username, ID(c) AS memberId, c.username AS membername, c.pushToken AS memberPushToken, offerRelation.offerType AS offerType, '
                            + 'offerRelation.time AS time, offerRelation.price AS price, ID(offerRelation) AS offerId, b.postId AS postId, b.mainUrl AS mainUrl, '
                            + 'b.currency AS currency, b.thumbnailImageUrl AS thumbnailImageUrl, a.mqttId AS usermqttId, d.mqttId AS membermqttId LIMIT 1; ';
                    }
                    else if (username !== req.body.membername.trim()) {
                        var makeOfferQuery = 'MATCH (a : User {username : "' + username + '"}), '
                            + '(b : ' + label + ' {postId : ' + parseInt(req.body.postId) + '})<-[p : POSTS]-(c : User {username : "' + req.body.membername.trim() + '"}) '
                            + 'CREATE UNIQUE (a)-[offerRelation : offer {offerType : ' + parseInt(req.body.offerStatus) + ', time : ' + parseInt(time) + ', price : ' + parseFloat(req.body.price) + '}]->(b) '
                            + ', (a)-[nt : Notification {notificationType : ' + 6 + ', offerType : ' + offerStatus + ', message : "offer", createdOn : ' + parseInt(time) + ', seenStatus : ' + 0 + '}]->(b)'
                            + 'RETURN DISTINCT ID(a) AS userId, a.profilePicUrl AS userProfilePicUrl, a.username AS username, ID(c) AS memberId, c.username AS membername, c.pushToken AS memberPushToken, offerRelation.offerType AS offerType, '
                            + 'offerRelation.time AS time, offerRelation.price AS price, ID(offerRelation) AS offerId, b.postId AS postId, b.mainUrl AS mainUrl, '
                            + 'b.currency AS currency, b.thumbnailImageUrl AS thumbnailImageUrl, a.mqttId AS usermqttId, c.mqttId AS membermqttId LIMIT 1; ';
                    } else {
                        var makeOfferQuery = 'MATCH (a : User {username : "' + username + '"}), '
                            + '(b : ' + label + ' {postId : ' + parseInt(req.body.postId) + '})<-[p : POSTS]-(c : User {username : "' + req.body.membername.trim() + '"}) '
                            + 'CREATE UNIQUE (a)-[offerRelation : offer {offerType : ' + parseInt(req.body.offerStatus) + ', time : ' + parseInt(time) + ', price : ' + parseFloat(req.body.price) + '}]->(b) '
                            // + ', (c)-[nt : Notification {notificationType : ' + 6 + ', offerType : ' + offerStatus + ', message : "offer", createdOn : ' + parseInt(time) + ', seenStatus : ' + 0 + '}]->(b)'
                            + 'RETURN DISTINCT ID(a) AS userId, a.profilePicUrl AS userProfilePicUrl, a.username AS username, ID(c) AS memberId, c.username AS membername, c.pushToken AS memberPushToken, offerRelation.offerType AS offerType, '
                            + 'offerRelation.time AS time, offerRelation.price AS price, ID(offerRelation) AS offerId, b.postId AS postId, b.mainUrl AS mainUrl, '
                            + 'b.currency AS currency, b.thumbnailImageUrl AS thumbnailImageUrl, a.mqttId AS usermqttId, c.mqttId AS membermqttId LIMIT 1; ';
                    }
                }
                try {
                    // console.log("makeOfferQuery", makeOfferQuery);
                    dbneo4j.cypher({ query: makeOfferQuery }, function (err, data) {
                        if (err) {
                            responseObj = { code: 500, message: 'error encountered while making offer', err: err };
                            callback(responseObj, null);
                        } else if (data.length === 0) {
                            responseObj = { code: 204, message: 'data not found' };
                            callback(responseObj, null);
                        } else {
                            // pushController.makeOffer(data, (e, d) => {
                            // });
                            //check if count of offer made is zero, send push notification
                            var query = `MATCH (a : User {username : "` + username + `"}), `
                                + `(b : ` + label + ` {postId : ` + parseInt(req.body.postId) + `})<-[p : POSTS]-(c : User {username : "` + req.body.membername.trim() + `"}) `
                                + `OPTIONAL MATCH (a)-[o : offer]->(b) RETURN COUNT(o) AS offerCount; `;
                            dbneo4j.cypher({ query: query }, (e, d) => {
                                if (e) {
                                    // console.log(e);
                                    responseObj = { code: 200, message: 'success', data: data };
                                    callback(null, responseObj);
                                } else if (d[0].offerCount === 0) {
                                    pushController.makeOffer(data, (e, d) => {

                                    });
                                    responseObj = { code: 200, message: 'success', data: data };
                                    callback(null, responseObj);
                                } else {
                                    // console.log('2');
                                    // console.log(d);
                                    responseObj = { code: 200, message: 'success', data: data };
                                    callback(null, responseObj);
                                }
                            });

                            // let sendOfferOnChatServerData = {};
                            // sendOfferOnChatServerData.name = username;
                            // sendOfferOnChatServerData.from = data[0].usermqttId;
                            // sendOfferOnChatServerData.to = data[0].membermqttId;
                            // sendOfferOnChatServerData.payload = req.body.payload;
                            // sendOfferOnChatServerData.messageType = req.body.messageType;
                            // sendOfferOnChatServerData.messageId = req.body.messageId;
                            // sendOfferOnChatServerData.secretId = parseInt(req.body.postId);
                            // sendOfferOnChatServerData.thumbnail = req.body.thumbnail;
                            // sendOfferOnChatServerData.userProfilePicUrl = req.body.userProfilePicUrl;
                            // sendOfferOnChatServerData.toDocId = req.body.toDocId;
                            // sendOfferOnChatServerData.dataSize = req.body.dataSize;
                            // console.log(req.body.sendchat);
                            if (req.body.sendchat) sendOfferOnChatServer(req.body.sendchat);
                        }
                    });
                } catch (err) {
                    throw err;
                }
            }
        ], function (e, d) {
            if (e) return res.send(e).status(e.code);
            else return res.send(d).status(d.code);
        });
    });

    /**
     * function to send make-offer, counter-offer, accept-offer data on chat server
     * @param {*} chatData 
     */
    function sendOfferOnChatServer(chatData) {
        var options = {
            method: 'POST',
            url: `${config.mqttServer}:${config.mqttPort}/Messages`,
            headers:
                {
                    'cache-control': 'no-cache',
                    'content-type': 'application/json',
                    authorization: config.mqttServerAuthenticationHeader
                },
            body: chatData,
            json: true
        };
        request(options, function (error, response, body) {
            if (error) console.log(error);
            console.log(body);
        });
    }

    /**
     * api to mark as sold else where
     * @param {} token
     * @param {} postId
     */

    Router.post('/sold/elseWhere', (req, res) => {
        var username = req.decoded.name;
        var time = moment().valueOf();
        var label;
        var responseobj = {};
        req.check('postId', 'mandatory parameter postId missing or invalid').notEmpty().isInt();
        req.check('type', 'mandatory parameter type missing or invalid').isInt();
        var errors = req.validationErrors();
        if (errors) return res.status(422).send({ code: 422, message: errors[0].msg });
        switch (req.body.type.toString()) {
            case "0":
                label = 'Photo';
                break;
            case "1":
                label = 'Video';
                break;
            default:
                return res.send({ code: 9202, message: 'mandatory parameter type has illegal value' }).status(9202);
        }
        async.waterfall([
            //check if the product is applicapble for selling
            function checkpProductStatus(cb) {
                var verifyBuyerQuery = `OPTIONAL MATCH (a : User)<-[s : sold]-(b {postId : ` + parseInt(req.body.postId) + `}) `
                    + `RETURN COUNT(s) AS sold; `;
                // return res.send(verifyBuyerQuery);
                dbneo4j.cypher({ query: verifyBuyerQuery }, (err, data) => {
                    if (err) {
                        responseobj = {
                            code: 500,
                            message: 'internal server error',
                            error: err
                        };
                        cb(responseobj, null);
                    }
                    else if (data[0].sold >= 1) {
                        responseobj = {
                            code: 409,
                            message: 'product marked as sold'
                        };
                        cb(responseobj, null);
                    } else {
                        cb(null, data);
                    }
                });
            },
            function markSold(sold, cb) {

                var query = `MATCH (a : User {username : "` + username + `"})-[p : POSTS]->(b : ` + label + ` {postId : ` + parseInt(req.body.postId) + `}) `
                    + `, (b)-[categoryRelation : category]->(categoryNode : Category) `
                    + `SET b.sold = ` + 2 + `, p.postedOn = ` + parseInt(moment().valueOf()) + ` RETURN DISTINCT `
                    + `p.postedOn AS postedOn, p.type AS type, ID(b) AS postNodeId, b.postId AS postId, b.productsTagged AS productsTagged, b.place AS place, `
                    + `b.latitude AS latitude, b.longitude AS longitude, b.imageCount AS imageCount, b.mainUrl AS mainUrl, b.thumbnailImageUrl AS thumbnailImageUrl, `
                    + `b.postCaption AS postCaption, b.hashTags AS hashtags, b.tagProduct AS tagProduct, b.tagProductCoordinates AS tagProductCoordinates, `
                    + `b.containerHeight AS containerHeight, b.containerWidth AS containerWidth, b.thumbnailUrl1 AS thumbnailUrl1, `
                    + `b.imageUrl1 AS imageUrl1, b.containerHeight1 AS containerHeight1, b.containerWidth1 AS containerWidth1, b.imageUrl2 AS imageUrl2, `
                    + `b.thumbnailUrl2 AS thumbnailUrl2, b.containerHeight2 AS containerHeight2, b.containerWidth2 AS containerWidth2, `
                    + `b.imageUrl3 AS imageUrl3, b.thumbnailUrl3 AS thumbnailUrl3, b.containerHeight3 AS containerHeight3, b.containerWidth3 AS containerWidth3, `
                    + `b.imageUrl4 AS imageUrl4, b.thumbnailUrl4 AS thumbnailUrl4, b.containerHeight4 AS containerHeight4, b.containerWidth4 AS containerWidth4, `
                    + `b.hasAudio AS hasAudio, b.category AS category, b.subCategory AS subCategory, `
                    + `b.productUrl AS productUrl, b.productName AS productName, b.description AS description, b.condition AS condition, `
                    + `COLLECT(DISTINCT{category : categoryNode.name, mainUrl : categoryNode.mainUrl, activeImageUrl : categoryNode.activeImageUrl }) AS categoryData, `
                    + `toFloat(b.price) AS price, b.currency AS currency, b.sold AS sold `
                    + 'LIMIT 1 ;';
                // return res.send(query);
                dbneo4j.cypher({ query: query }, function (e, d) {
                    if (e) {
                        responseObj = { code: 500, message: 'error encountered', error: e };
                        cb(responseObj, null);
                    } else if (d.length === 0) {
                        responseObj = { code: 204, message: 'data not found' };
                        cb(responseObj, null);
                    } else {
                        markSoldChatServer(req.body.postId, true);
                        responseObj = { code: 200, message: 'success, product marked as sold', data: d[0] };
                        cb(null, responseObj);
                    }
                });
            }
        ], (e, d) => {
            if (e) return res.send(e).status(e.code);
            else return res.send(d).status(d.code);
        });
    });


    /**
     * api to show accepted offers on a product
     */

    Router.post('/acceptedOffers', function (req, res) {
        var username = req.decoded.name;
        var label;
        req.check('postId', 'mandatory parameter postId missing or invalid').notEmpty().isInt();
        req.check('postType', 'mandatory parameter postType missing or invalid').notEmpty().isInt();
        var errors = req.validationErrors();
        if (errors) return res.status(422).send({ code: 422, message: errors[0].msg });
        var limit = parseInt(req.body.limit) || 40;
        var offset = parseInt(req.body.offset) || 0;
        switch (req.body.postType.toString()) {
            case "0":
                label = "Photo";
                break;
            case "1":
                label = "video";
                break;
            default:
                return res.status(400).send({ code: 400, message: 'invalid post type' });
        }
        // console.log(label);
        var postId = parseInt(req.body.postId);
        var query = `MATCH (a : User {username : "` + username + `"})-[p : POSTS]->(b : ` + label + ` {postId : ` + postId + `})<-[o : offer {offerType : ` + 2 + `}]-(c : User) `
            + `WHERE a <> c OPTIONAL MATCH (cat : Category)<-[categoryRelation : category]-(b) `
            + `RETURN DISTINCT b.postId AS postId, b.mainUrl AS mainuUrl, b.thumbnailImageUrl AS thumbnailImageUrl, b.price AS price, `
            + `b.currency AS currency, cat.name AS category, cat.mainUrl AS categoryImageurl, cat.activeImageUrl AS activeImageUrl, toFloat(o.price) AS offerPrice, `
            // + `COLLECT (DISTINCT {buyerName : c.username, buyerFullName : c.fullName, buyerProfilePicUrl})`
            + `c.username AS buyername, c.fullName AS buyerFullName, c.profilePicUrl AS buyerProfilePicUrl, ID(c) AS buyerId, `
            + `a.username AS username, toInt(o.time) AS offerCreatedOn `
            + `ORDER BY (offerPrice) DESC SKIP ` + offset + ` LIMIT ` + limit + `; `;
        // return res.send(query);
        dbneo4j.cypher({ query: query }, (err, data) => {
            if (err) {
                return res.send({ code: 500, message: 'internal server error', error: err }).status(500);
            } else if (data.length === 0) {
                return res.send({ code: 204, messgae: 'no offers on this product' }).status(204);
            } else {
                return res.send({ code: 200, message: 'success', data: data }).status(200);
            }
        });
    });

    /**
     * api to mark a product as sold
     */
    Router.post('/markSold', function (req, res) {
        var username = req.decoded.name;
        var time = moment().valueOf();
        var label;
        var responseobj = {};
        req.check('postId', 'mandatory parameter postId missing or invalid').notEmpty().isInt();
        req.check('membername', 'mandatory parameter membername missing').notEmpty();
        req.check('type', 'mandatory parameter type missing or invalid').isInt();
        req.check('ratings', 'mandatory parameter ratings missing or invalid').notEmpty().isInt();
        if (req.body.ratings <= 0 || req.body.ratings > 5) {
            return res.status(400).send({ code: 400, message: 'invalid rating' });
        }
        var errors = req.validationErrors();
        if (errors) return res.status(422).send({ code: 422, message: errors[0].msg });
        switch (req.body.type.toString()) {
            case "0":
                label = 'Photo';
                break;
            case "1":
                label = 'Video';
                break;
            default:
                return res.send({ code: 400, message: 'mandatory parameter type has illegal value' }).status(400);
        }
        // console.log(label);

        async.waterfall([

            //check if the product is applicapble for selling
            function checkpProductStatus(cb) {
                var verifyBuyerQuery = `OPTIONAL MATCH (b {postId : ` + parseInt(req.body.postId) + `}) WHERE b.sold = 1 OR b.sold = 2 `
                    + `RETURN COUNT(b) AS sold; `;
                // console.log(verifyBuyerQuery);
                // return res.send(verifyBuyerQuery);
                dbneo4j.cypher({ query: verifyBuyerQuery }, (err, data) => {
                    if (err) {
                        responseobj = {
                            code: 500,
                            message: 'internal server error',
                            error: err
                        };
                        cb(responseobj, null);
                    }
                    else if (data[0].sold >= 1) {
                        responseobj = {
                            code: 409,
                            message: 'product already marked as sold'
                        };
                        cb(responseobj, null);
                    } else {
                        cb(null, data);
                    }
                });
            },

            //function to mark product as sold, creates a new @{sold} relation between product and buyer 
            function markSold(sold, cb) {
                let buyer = req.body.membername.trim();
                var ratings = parseInt(req.body.ratings);
                var query = 'MATCH (a : User {username : "' + username + '"})-[p : POSTS]->(b : ' + label + ' {postId : ' + parseInt(req.body.postId) + '}), (buyer : User {username : "' + buyer + '"}) '
                    + ', (b)-[categoryRelation : category]->(categoryNode : Category) '
                    + 'CREATE UNIQUE (buyer)<-[sold : sold {createdOn : ' + parseInt(time) + '}]-(b), (buyer)<-[ratings : rating {rating : ' + ratings + ', createdOn : ' + parseInt(time) + '}]-(a) '
                    + ', (buyer)-[nt : Notification {notificationType : ' + 8 + ', message : "sold", createdOn : ' + moment().valueOf() + ', seenStatus : ' + 0 + '}]->(b) '
                    + 'SET b.sold = ' + 1 + ', b.postedOn = ' + parseInt(time) + ' RETURN DISTINCT a.username AS username, a.profilePicUrl AS profilePicUrl, a.fullName AS fullName, a.pushToken AS pushToken, '
                    + 'toInt(p.postedOn) AS postedOn, p.type AS type, ID(b) AS postNodeId, b.postId AS postId, b.productsTagged AS productsTagged, b.place AS place, '
                    + 'b.latitude AS latitude, b.longitude AS longitude, b.imageCount AS imageCount, b.mainUrl AS mainUrl, b.thumbnailImageUrl AS thumbnailImageUrl, '
                    + 'b.postCaption AS postCaption, b.hashTags AS hashtags, b.tagProduct AS tagProduct, b.tagProductCoordinates AS tagProductCoordinates, '
                    + 'b.containerHeight AS containerHeight, b.containerWidth AS containerWidth, b.thumbnailUrl1 AS thumbnailUrl1, '
                    + 'b.imageUrl1 AS imageUrl1, b.containerHeight1 AS containerHeight1, b.containerWidth1 AS containerWidth1, b.imageUrl2 AS imageUrl2, '
                    + 'b.thumbnailUrl2 AS thumbnailUrl2, b.containerHeight2 AS containerHeight2, b.containerWidth2 AS containerWidth2, '
                    + 'b.imageUrl3 AS imageUrl3, b.thumbnailUrl3 AS thumbnailUrl3, b.containerHeight3 AS containerHeight3, b.containerWidth3 AS containerWidth3, '
                    + 'b.imageUrl4 AS imageUrl4, b.thumbnailUrl4 AS thumbnailUrl4, b.containerHeight4 AS containerHeight4, b.containerWidth4 AS containerWidth4, '
                    + 'b.productUrl AS productUrl, b.productName AS productName, b.description AS description, toInt(ratings.rating) AS rating, '
                    + 'b.price AS price, b.currency AS currency, b.sold AS sold,  b.condition AS condition, buyer.username AS buyername, '
                    + 'COLLECT(DISTINCT{category : categoryNode.name, mainUrl : categoryNode.mainUrl, activeImageUrl : categoryNode.activeImageUrl }) AS categoryData, '
                    + 'buyer.pushToken AS buyerPushToken, buyer.profilePicUrl AS buyerProfilePicUrl LIMIT 1;';
                // return res.send(query);
                // console.log(query);
                dbneo4j.cypher({ query: query }, function (e, d) {
                    if (e) {
                        responseObj = { code: 500, message: 'error encountered', error: e };
                        cb(responseObj, null);
                    } else if (d.length === 0) {
                        responseObj = { code: 204, message: 'data not found' };
                        cb(responseObj, null);
                    } else {
                        // return res.send(d);
                        pushController.markSold(d, () => { });
                        markSoldChatServer(req.body.postId, true);
                        responseObj = { code: 200, message: 'success, product marked as sold', data: d[0] };
                        cb(null, responseObj);
                    }
                });
            }
        ], (e, d) => {
            if (e) return res.send(e).status(e.code);
            else return res.send(d).status(d.code);
        });
    });

    function markSoldChatServer(postId, status) {
        var options = {
            method: 'PUT',
            url: `${config.mqttServer}:${config.mqttPort}/Product`,
            headers:
                {
                    'cache-control': 'no-cache',
                    'content-type': 'application/json',
                    authorization: config.mqttServerAuthenticationHeader
                },
            body:
                {
                    id: postId.toString(),
                    sold: status,
                },
            json: true
        };
        request(options, function (error, response, body) {
            if (error) console.log(error);
            else console.log(body);
        });
    }



    /**
     * @User API
     *  api to mark a product as un sold
     */

    Router.post('/markSelling', function (req, res) {
        var username = req.decoded.name;
        var label;
        if (!req.body.postId) {
            return res.send({ code: 422, message: 'mandatory parameter postId missing' }).status(422);
        }
        if (!req.body.type.toString()) {
            return res.send({ code: 422, message: 'mandatory parameter type missing' }).status(422);
        }
        var responseObj = {};
        switch (req.body.type.toString()) {
            case "0":
                label = 'Photo';
                break;
            case "1":
                label = 'Video';
                break;
            default:
                return res.send({ code: 400, message: 'mandatory parameter type has illegal value' }).status(400);
        }

        async.waterfall([
            function markSelling(cb) {
                var query = 'MATCH (a : User {username : "' + username + '"})-[p : POSTS]->(b : ' + label + ' {postId : ' + parseInt(req.body.postId) + '})-[s : sold]->(buyer : User) '
                    + ', (b)-[categoryRelation : category]->(categoryNode : Category) '
                    + 'OPTIONAL MATCH (a)-[ratingsRelation : rating]->(buyer), (buyer)-[nt :  Notification {notificationType : ' + 8 + '}]->(b) '
                    + 'DELETE ratingsRelation, s, nt '
                    + 'SET b.sold = ' + 0 + ', p.postedOn = ' + parseInt(moment().valueOf()) + ' RETURN DISTINCT a.username AS username, a.profilePicUrl AS profilePicUrl, a.fullName AS fullName, a.pushToken AS pushToken, '
                    + 'toInt(p.postedOn) AS postedOn, p.type AS type, ID(b) AS postNodeId, b.postId AS postId, b.productsTagged AS productsTagged, b.place AS place, '
                    + 'b.latitude AS latitude, b.longitude AS longitude, b.imageCount AS imageCount, b.mainUrl AS mainUrl, b.thumbnailImageUrl AS thumbnailImageUrl, '
                    + 'b.postCaption AS postCaption, b.hashTags AS hashtags, b.tagProduct AS tagProduct, b.tagProductCoordinates AS tagProductCoordinates, '
                    + 'b.containerHeight AS containerHeight, b.containerWidth AS containerWidth, b.thumbnailUrl1 AS thumbnailUrl1, '
                    + 'b.imageUrl1 AS imageUrl1, b.containerHeight1 AS containerHeight1, b.containerWidth1 AS containerWidth1, b.imageUrl2 AS imageUrl2, '
                    + 'b.thumbnailUrl2 AS thumbnailUrl2, b.containerHeight2 AS containerHeight2, b.containerWidth2 AS containerWidth2, '
                    + 'b.imageUrl3 AS imageUrl3, b.thumbnailUrl3 AS thumbnailUrl3, b.containerHeight3 AS containerHeight3, b.containerWidth3 AS containerWidth3, '
                    + 'b.imageUrl4 AS imageUrl4, b.thumbnailUrl4 AS thumbnailUrl4, b.containerHeight4 AS containerHeight4, b.containerWidth4 AS containerWidth4, '
                    + 'b.hasAudio AS hasAudio, b.productUrl AS productUrl, b.description AS description, COLLECT(DISTINCT{category : categoryNode.name, mainUrl : categoryNode.mainUrl, activeImageUrl : categoryNode.activeImageUrl }) AS categoryData, '
                    + 'b.price AS price, b.currency AS currency, b.productName AS productName, b.sold AS sold, b.condition AS condition '
                    + 'LIMIT 1;';
                // return res.status(400).send(query);
                dbneo4j.cypher({ query: query }, function (e, d) {
                    if (e) {
                        responseObj = { code: 500, message: 'error encountered', error: e };
                        cb(responseObj, null);
                    } else if (d.length === 0) {
                        var data = {
                            username: username,
                            postId: parseInt(req.body.postId),
                            label: label
                        };
                        markSoldChatServer(req.body.postId, false);
                        markSellingForSoldSomeWhereElse(data, (e, d) => {
                            if (e) cb(e, null);
                            else cb(null, d);
                        });
                    } else {
                        markSoldChatServer(req.body.postId, false);

                        // return res.send(d[0]);
                        responseObj = { code: 200, message: 'success, product marked as selling', data: d[0] };
                        cb(null, responseObj);
                    }
                });
            }
        ], (e, d) => {
            if (e) return res.send(e).status(e.code);
            else return res.send(d).status(200)
        });

        function markSellingForSoldSomeWhereElse(data, callback) {
            // console.log('sold somewhere else');
            let username = data.username;
            let postId = data.postId;
            let label = data.label;
            var query = 'MATCH (a : User {username : "' + username + '"})-[p : POSTS]->(b : ' + label + ' {postId : ' + parseInt(req.body.postId) + ', sold : ' + 2 + '}) '
                + ', (b)-[categoryRelation : category]->(categoryNode : Category) '
                + 'SET b.sold = ' + 0 + ', b.postedOn = ' + parseInt(moment().valueOf()) + ' RETURN DISTINCT a.username AS username, a.profilePicUrl AS profilePicUrl, a.fullName AS fullName, a.pushToken AS pushToken, '
                + 'toInt(p.postedOn) AS postedOn, p.type AS type, ID(b) AS postNodeId, b.postId AS postId, b.productsTagged AS productsTagged, b.place AS place, '
                + 'b.latitude AS latitude, b.longitude AS longitude, b.imageCount AS imageCount, b.mainUrl AS mainUrl, b.thumbnailImageUrl AS thumbnailImageUrl, '
                + 'b.postCaption AS postCaption, b.hashTags AS hashtags, b.tagProduct AS tagProduct, b.tagProductCoordinates AS tagProductCoordinates, '
                + 'b.containerHeight AS containerHeight, b.containerWidth AS containerWidth, b.thumbnailUrl1 AS thumbnailUrl1, '
                + 'b.imageUrl1 AS imageUrl1, b.containerHeight1 AS containerHeight1, b.containerWidth1 AS containerWidth1, b.imageUrl2 AS imageUrl2, '
                + 'b.thumbnailUrl2 AS thumbnailUrl2, b.containerHeight2 AS containerHeight2, b.containerWidth2 AS containerWidth2, '
                + 'b.imageUrl3 AS imageUrl3, b.thumbnailUrl3 AS thumbnailUrl3, b.containerHeight3 AS containerHeight3, b.containerWidth3 AS containerWidth3, '
                + 'b.imageUrl4 AS imageUrl4, b.thumbnailUrl4 AS thumbnailUrl4, b.containerHeight4 AS containerHeight4, b.containerWidth4 AS containerWidth4, '
                + 'b.hasAudio AS hasAudio, b.productUrl AS productUrl, b.description AS description, COLLECT(DISTINCT{category : categoryNode.name, mainUrl : categoryNode.mainUrl, activeImageUrl : categoryNode.activeImageUrl}) AS categoryData, '
                + 'b.price AS price, b.currency AS currency, b.productName AS productName, b.sold AS sold, b.condition AS condition '
                + 'LIMIT 1;';
            // console.log("outer query",query);
            dbneo4j.cypher({ query: query }, (e, d) => {
                if (e) {
                    responseObj = {
                        code: 500,
                        message: 'internal server error',
                        error: e
                    };
                    callback(responseObj, null);
                } else if (d.length === 0) {
                    responseObj = {
                        code: 204,
                        message: 'no data'
                    };
                    callback(responseObj, null);
                } else {
                    responseObj = {
                        code: 200,
                        message: 'success',
                        data: d[0]
                    };
                    callback(null, responseObj);
                }
            });
        }
    });






    /**
     * api to fetch user's other offers for website
     * @accesible by guests
     */

    Router.post('/myOtherOffers/guest', (req, res) => {
        // var username = req.decoded.name;
        req.check('postId', 'mandatory parameter postId missing').notEmpty();
        req.check('membername', 'mandatory parameter membername missing').notEmpty();
        var errors = req.validationErrors();
        var offset = parseInt(req.body.offset) || 0;
        var limit = parseInt(req.body.limit) || 40;
        if (errors) return res.status(422).send({ code: 422, message: errors[0].msg });
        var query = '';
        var distance = '';
        var membername = req.body.membername.trim();
        if (req.body.latitude && req.body.longitude) {
            var latitude = parseFloat(req.body.latitude);
            var longitude = parseFloat(req.body.longitude);
            query += `AND b.latitude IS NOT NULL AND b.longitude IS NOT NULL `
                + `WITH a, p, b, toFloat(distance (point({latitude : ` + latitude + `, longitude : ` + longitude + `}), point({latitude : b.latitude, longitude : b.longitude})) / 1000) as distance `;
            distance += `distance, `;
        }
        var otherOfferQuery = `MATCH (a : User {username : "` + membername + `"})-[p : POSTS]->(b : Photo) WHERE b.postId <> ` + parseInt(req.body.postId) + ` `
            + query
            + `OPTIONAL MATCH (b)-[belongsTo : belongsTo]->(subCategoryNode: SubCategory)-[subCategory : subCategory]->(categoryNode : Category) `
            + `RETURN DISTINCT a.username AS username, a.profilePicUrl AS profilePicUrl, a.fullName AS fullName, a.pushToken AS pushToken, `
            + `p.seoTitle AS seoTitle,p.seoDescription AS seoDescription,p.seoKeyword AS seoKeyword,b.mainImgAltText AS mainImgAltText,`
            + `b.imageUrl1AltText AS imageUrl1AltText,b.imageUrl2AltText AS imageUrl2AltText,b.imageUrl3AltText AS imageUrl3AltText,b.imageUrl4AltText AS imageUrl4AltText,`
            + `p.postedOn AS postedOn, p.type AS type, b.condition AS condition, b.negotiable AS negotiable, `
            + `ID(b) AS postNodeId, b.postId AS postId, b.place AS place, b.city AS city, b.countrySname AS countrySname, `
            + `b.latitude AS latitude, b.longitude AS longitude, b.mainUrl AS mainUrl, b.thumbnailImageUrl AS thumbnailImageUrl, `
            + `b.postCaption AS postCaption, b.hashTags AS hashtags, b.tagProduct AS tagProduct, b.tagProductCoordinates AS tagProductCoordinates, `
            + `b.containerHeight AS containerHeight, b.containerWidth AS containerWidth, b.thumbnailUrl1 AS thumbnailUrl1, `
            + `b.imageUrl1 AS imageUrl1, b.containerHeight1 AS containerHeight1, b.containerWidth1 AS containerWidth1, b.imageUrl2 AS imageUrl2, `
            + `b.thumbnailUrl2 AS thumbnailUrl2, b.containerHeight2 AS containerHeight2, b.containerWidth2 AS containerWidth2, `
            + `b.imageUrl3 AS imageUrl3, b.thumbnailUrl3 AS thumbnailUrl3, b.containerHeight3 AS containerHeight3, b.containerWidth3 AS containerWidth3, `
            + `b.imageUrl4 AS imageUrl4, b.thumbnailUrl4 AS thumbnailUrl4, b.containerHeight4 AS containerHeight4, b.containerWidth4 AS containerWidth4, `
            + `b.hasAudio AS hasAudio, categoryNode.name AS category, subCategoryNode.name AS subCategory, `
            + `b.productUrl AS productUrl, b.description AS description, ` + distance
            + `b.price AS price, b.currency AS currency, b.productName AS productName, b.sold AS sold; `;
        // return res.send(otherOfferQuery);
        dbneo4j.cypher({ query: otherOfferQuery }, (e, d) => {
            if (e) return res.status(500).send({ code: 500, messag: 'error', error: e });
            else if (d.length === 0) return res.send({ code: 204, message: 'no data' }).status(204);
            else return res.status(200).send({ code: 200, message: 'success', data: d });
        });
    });

    /**
     * api to fetch member's other offers
     * @accesible by authenticated users
     */
    Router.post('/myOtherOffers/user', (req, res) => {
        var username = req.decoded.name;
        req.check('postId', 'mandatory parameter postId missing').notEmpty();
        req.check('membername', 'mandatory parameter membername missing').notEmpty();
        req.check('latitude', 'mandatory parameter latitude missing').notEmpty();
        req.check('longitude', 'mandatory parameter longitude missing').notEmpty();
        var errors = req.validationErrors();
        var offset = parseInt(req.body.offset) || 0;
        var limit = parseInt(req.body.limit) || 40;
        if (errors) return res.status(422).send({ code: 422, message: errors[0].msg });
        var query = '';
        var distance = '';
        var membername = req.body.membername.trim();
        if (req.body.latitude && req.body.longitude) {
            var latitude = parseFloat(req.body.latitude);
            var longitude = parseFloat(req.body.longitude);
            query += `AND b.latitude IS NOT NULL AND b.longitude IS NOT NULL `
                + `WITH a, p, b, toFloat(distance (point({latitude : ` + latitude + `, longitude : ` + longitude + `}), point({latitude : b.latitude, longitude : b.longitude})) / 1000) as distance `;
            distance += `distance, `;
        }
        var otherOfferQuery = `MATCH (a : User {username : "` + username + `"})-[p : POSTS]->(b : Photo) WHERE b.postId <> ` + parseInt(req.body.postId) + ` `
            + query
            + `OPTIONAL MATCH (b)-[belongsTo : belongsTo]->(subCategoryNode: SubCategory)-[subCategory : subCategory]->(categoryNode : Category) `
            + `RETURN DISTINCT a.username AS username, a.profilePicUrl AS profilePicUrl, a.fullName AS fullName, a.pushToken AS pushToken, `
            + `p.seoTitle AS seoTitle,p.seoDescription AS seoDescription,p.seoKeyword AS seoKeyword,b.mainImgAltText AS mainImgAltText,`
            + `b.imageUrl1AltText AS imageUrl1AltText,b.imageUrl2AltText AS imageUrl2AltText,b.imageUrl3AltText AS imageUrl3AltText,b.imageUrl4AltText AS imageUrl4AltText,`
            + `p.postedOn AS postedOn, p.type AS type, b.condition AS condition, b.negotiable AS negotiable, `
            + `ID(b) AS postNodeId, b.postId AS postId, b.place AS place, b.city AS city, b.countrySname AS countrySname, `
            + `b.latitude AS latitude, b.longitude AS longitude, b.mainUrl AS mainUrl, b.thumbnailImageUrl AS thumbnailImageUrl, `
            + `b.postCaption AS postCaption, b.hashTags AS hashtags, b.tagProduct AS tagProduct, b.tagProductCoordinates AS tagProductCoordinates, `
            + `b.containerHeight AS containerHeight, b.containerWidth AS containerWidth, b.thumbnailUrl1 AS thumbnailUrl1, `
            + `b.imageUrl1 AS imageUrl1, b.containerHeight1 AS containerHeight1, b.containerWidth1 AS containerWidth1, b.imageUrl2 AS imageUrl2, `
            + `b.thumbnailUrl2 AS thumbnailUrl2, b.containerHeight2 AS containerHeight2, b.containerWidth2 AS containerWidth2, `
            + `b.imageUrl3 AS imageUrl3, b.thumbnailUrl3 AS thumbnailUrl3, b.containerHeight3 AS containerHeight3, b.containerWidth3 AS containerWidth3, `
            + `b.imageUrl4 AS imageUrl4, b.thumbnailUrl4 AS thumbnailUrl4, b.containerHeight4 AS containerHeight4, b.containerWidth4 AS containerWidth4, `
            + `b.hasAudio AS hasAudio, categoryNode.name AS category, subCategoryNode.name AS subCategory, `
            + `b.productUrl AS productUrl, b.description AS description, ` + distance
            + `b.price AS price, b.currency AS currency, b.productName AS productName, b.sold AS sold; `;
        // return res.send(otherOfferQuery);
        dbneo4j.cypher({ query: otherOfferQuery }, (e, d) => {
            if (e) return res.status(500).send({ code: 500, messag: 'error', error: e });
            else if (d.length === 0) return res.send({ code: 204, message: 'no data' }).status(204);
            else return res.status(200).send({ code: 200, message: 'success', data: d });
        });
    });


    /**
     * Api to return all the products a user is buying  
     */

    Router.post('/selling', (req, res) => {
        var username = req.decoded.name;
        var limit = parseInt(req.body.limit) || 40;
        var offset = parseInt(req.body.offset) || 0;
        // req.check('latitude', 'mandatory parameter latitude missing').notEmpty();
        // req.check('longitude', 'mandatory parameter longitude missing').notEmpty();
        var errors = req.validationErrors();
        if (errors) return res.status(422).send({ code: 422, message: errors[0].msg });
        // var latitude = parseFloat(req.body.latitude);
        // var longitude = parseFloat(req.body.longitude);
        var query = `MATCH (a : User {username : "` + username + `"})-[p : POSTS]->(posts) WHERE EXISTS (posts.latitude) AND EXISTS (posts.longitude) `
            // + `AND posts.latitude IS NOT NULL AND posts.longitude IS NOT NULL `
            + `OPTIONAL MATCH (category : Category)<-[categoryRelation : category]-(posts) `
            + `RETURN DISTINCT a.username AS username, toInt(p.postedOn) AS postedOn, category.name AS cateogory, `
            + `category.activeImageUrl AS activeImageUrl, category.mainUrl AS categoryUrl, posts.price AS price, posts.currency AS currency, `
            + `posts.thumbnailImageUrl AS thumbnailImageUrl, posts.hashTags AS hashTags, posts.productName AS productName, `
            + `posts.place AS place, posts.latitude AS latitude, posts.longitude AS longitude, `
            + `posts.postId AS postId, posts.mainUrl AS mainUrl, posts.imageUrl1 AS imageUrl1, posts.imageUrl2 AS imageUrl2,  `
            + `posts.imageUrl3 AS imageUrl3, posts.imageUrl4 AS imageUrl4, posts.description AS description, posts.productsTagged AS productsTagged, `
            + `posts.productsTaggedCoordinates AS productsTaggedCoordinates, posts.sold AS sold, posts.city AS city, posts.countrySname AS countrySname `
            // + `toFloat(distance (point({latitude : ` + latitude + `, longitude : ` + longitude + `}), point({latitude : posts.latitude, longitude : posts.longitude})) / 1000) as distance, `
            // + `"KM" AS distanceUnit `
            + `ORDER BY(postedOn) DESC SKIP ` + offset + ` LIMIT ` + limit + `; `;
        // return res.send(query);
        dbneo4j.cypher({ query: query }, (e, d) => {
            if (e) return res.status(500).send({ code: 500, messag: 'error', error: e });
            else if (d.length === 0) return res.send({ code: 204, message: 'no data' }).status(204);
            else return res.status(200).send({ code: 200, message: 'success', data: d });
        });
    });

    /**
     * api to return all the products which this user has in his / her buying list
     */

    Router.post('/buying', (req, res) => {
        var username = req.decoded.name;
        var limit = parseInt(req.body.limit) || 40;
        var offset = parseInt(req.body.offset) || 0;
        var query = `MATCH  (a : User)-[o : offer {offerType : ` + 2 + `}]->(posts)<-[p : POSTS]-(c : User) `
            + `WHERE a.username <> c.username `
            + `OPTIONAL MATCH (category : Category)<-[categoryRelation : category]-(posts) `
            + `RETURN DISTINCT a.username AS username, c.username AS membername, toInt(p.postedOn) AS postedOn, category.name AS cateogory, `
            + `category.activeImageUrl AS activeImageUrl, category.mainUrl AS categoryUrl, posts.price AS price, posts.currency AS currency, `
            + `posts.thumbnailImageUrl AS thumbnailImageUrl, posts.hashTags AS hashTags, posts.productName AS productName, `
            + `posts.place AS place, posts.latitude AS latitude, posts.longitude AS longitude, `
            + `posts.postId AS postId, posts.mainUrl AS mainUrl, posts.imageUrl1 AS imageUrl1, posts.imageUrl2 AS imageUrl2,  `
            + `posts.imageUrl3 AS imageUrl3, posts.imageUrl4 AS imageUrl4, posts.description AS description, posts.productsTagged AS productsTagged, `
            + `posts.productsTaggedCoordinates AS productsTaggedCoordinates, posts.sold AS sold, posts.city AS city, posts.countrySname AS countrySname `
            // + `toFloat(distance (point({latitude : ` + latitude + `, longitude : ` + longitude + `}), point({latitude : posts.latitude, longitude : posts.longitude})) / 1000) as distance, `
            // + `"KM" AS distanceUnit `
            + `ORDER BY(postedOn) DESC SKIP ` + offset + ` LIMIT ` + limit + `; `;
        // return res.send(query);
        dbneo4j.cypher({ query: query }, (e, d) => {
            if (e) return res.status(500).send({ code: 500, messag: 'error', error: e });
            else if (d.length === 0) return res.send({ code: 204, message: 'no data' }).status(204);
            else return res.status(200).send({ code: 200, message: 'success', data: d });
        });
    });


    /**
     * api to rate seller
     * @param {} token 
     * @param {} membername
     * @param {} rating
     */

    Router.post('/rate/:seller', (req, res) => {
        var username = req.decoded.name;
        req.checkParams('seller', 'mandatory parameter seller missing').notEmpty();
        req.check('rating', 'mandatory parameter rating missing').notEmpty();
        req.check('postId', 'mandatory parameter postId missing').notEmpty();        
        let errors = req.validationErrors();
        if (errors) return res.status(422).send({ code: 422, message: errors[0].msg });
        let seller = req.params.seller.trim();
        let time = moment().valueOf();
        let ratings = parseInt(req.body.rating);
        var responseObj = {};
        let postId = parseInt(req.body.postId);        
        async.waterfall([
            function checkRelationship(cb) {
                var query = `OPTIONAL MATCH (buyer : User {username : "` + username + `"})-[r : rating]->(seller : User {username : "` + seller + `"}) `
                    + `RETURN DISTINCT COUNT(r) AS count; `;
                dbneo4j.cypher({ query: query }, (e, d) => {
                    if (e) {
                        responseObj = { code: e, message: 'internal server error', error: e };
                        cb(responseObj, null);
                    } else if (d[0] > 0) {
                        updateRating((e, d) => {
                            if (e) cb(e, null);
                            else cb(null, d);
                        });
                    } else {
                        insertRating((e, d) => {
                            if (e) cb(e, null);
                            else cb(null, d);
                        });
                    }
                });
            }
        ], (e, d) => {
            if (e) return res.send(e).status(e.code);
            else return res.status(200).send(d);
        });

        function insertRating(callback) {
            var query = `MATCH (buyer : User {username : "` + username + `"}), (seller : User {username : "` + seller + `"}) `
                + `OPTIONAL MATCH (buyer)-[nt: Notification {notificationType : ${8}}]->(b {postId : ${postId}}) `
                + `CREATE UNIQUE (buyer)-[ratings : rating {rating : ` + ratings + `, createdOn : ` + parseInt(time) + `}]->(seller) `
                + `SET nt.rating = 1 `
                + `RETURN DISTINCT buyer.username AS buyer, seller.username AS seller, `
                + `toInt(ratings.createdOn) AS createdOn, nt.rating AS ratingStatus, toInt(ratings.rating) AS rating; `;

            dbneo4j.cypher({ query: query }, (e, d) => {
                if (e) {
                    responseObj = { code: e, message: 'internal server error', error: e };
                    callback(responseObj, null);
                } else if (d.length === 0) {
                    responseObj = { code: 204, message: 'no data' };
                    callback(responseObj, null);
                } else {
                    responseObj = { code: 200, message: 'success', data: d };
                    callback(null, responseObj);
                }
            });
        }

        function updateRating(callback) {
            var query = `MATCH (buyer : User {username : "` + username + `"})-[r : rating]->(seller : User {username : "` + seller + `"}) `
                + `SET r.rating = ` + ratings + `, r.createdOn = ` + parseInt(time) + ` `
                + `RETURN DISTINCT buyer.username AS buyer, seller.username AS seller, toInt(ratings.createdOn) AS createdOn, toInt(ratings.rating) AS rating; `;
            dbneo4j.cypher({ query: query }, (e, d) => {
                if (e) {
                    responseObj = { code: e, message: 'internal server error', error: e };
                    callback(responseObj, null);
                } else if (d.length === 0) {
                    responseObj = { code: 204, message: 'no data' };
                    callback(responseObj, null);
                } else {
                    responseObj = { code: 200, message: 'success', data: d };
                    callback(null, responseObj);
                }
            });
        }
    });

    return Router;
}

