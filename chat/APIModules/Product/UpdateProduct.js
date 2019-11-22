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
        method: 'PUT',
        path: '/Product',
        config: {
            handler: function (req, reply) {
                editProductHandler(req, reply)
            },
            validate: {
                payload: Joi.object({
                    id: Joi.string().description("product id is required"),
                    name: Joi.string().description("product name is required"),
                    image: Joi.string().description("product image is required").allow(""),
                    sold: Joi.boolean().description("product sold or not (true/false)"),
                    price: Joi.string().description("parameter price is required"),
                    negotiable: Joi.string().description("parameter negotiable is required")
                }).unknown(),
                headers: Joi.object({
                    'authorization': Joi.string().description("authorization required")
                }).unknown()
            },
            description: 'Api to update a product',
            notes: 'Create a new product. Header input: KMajNKHPqGt6kXwUbFN3dU46PjThSNTtrEnPZUefdasdfghsaderf1234567890ghfghsdfghjfghjkswdefrtgyhdfghj',
            tags: ['api']
        }
    }
];

/**
 *  
 */
function editProductHandler(req, reply) {
    console.log('editProductHandler: ' + JSON.stringify(req.payload));

    async.waterfall([
        function (validateCB) {
            if (!req.headers.authorization) {
                return reply({ code: 101, message: "mandatory headers is missing" }).code(422);
            } else {
                if (req.headers.authorization != conf.authorization) {
                    return reply({ code: 102, message: "failed to authenticate, headers is Invalid " }).code(401);
                }
            }
            if (!req.payload.id) {
                return reply({ code: 103, message: "mandatory product id is missing" }).code(422);
            }

            validateCB(null, true)
        },
        function (checkProduct, funcMainCB) {

            /**
             * check if the product is in the DB
             */

            middleWare.Select("product", { _id: req.payload.id }, "Mongo", {}, function (getProErr, getProRes) {
                if (getProErr) return reply({ code: 500, message: 'Database error' }).code(500);
                else if (getProRes.length) {
                    /** product found - update */
                    var dataToSave = {};
                    if (req.payload.name) dataToSave.name = req.payload.name;
                    if (req.payload.image) dataToSave.image = req.payload.image;
                    if (req.payload.negotiable) dataToSave.negotiable = req.payload.negotiable;
                    if (req.payload.price) dataToSave.price = req.payload.price;                    
                    if (req.payload.sold) {
                        dataToSave.sold = req.payload.sold;
                    } else if(req.payload.sold == false){
                        dataToSave.sold = false;
                    }

                    console.log(dataToSave);
                    middleWare.Update("product", dataToSave, { _id: req.payload.id }, "Mongo", function (updtErr, updtRes) {
                        if (updtErr) funcMainCB({ code: 500, message: 'Database error' }, null);
                        else funcMainCB(null, { code: 200, message: 'Updated successfully.' });
                    });
                } else {
                    /** product not found */
                    funcMainCB({ code: 204, message: 'Product not found' }, null);
                }
            })

        }, function (updateProductInChatCollection, finalCB) {

            /**
             * find all the buyers and update the product data
             */
            var prod_updt_obj = {
                id: req.payload.id,
                name: req.payload.name,
                image: req.payload.image,
                price: req.payload.price,
                negotiable: req.payload.negotiable,
                sold: req.payload.sold
            }
            middleWare.Select("chatList", { secretId: req.payload.id }, "Mongo", {}, function (getProErr, getProRes) {
                if (getProErr) {
                    console.log(getProErr);
                    finalCB({ code: 500, message: 'Database error' }, null);
                } else if (getProRes.length) {
                    //publish to all the buyers
                    // console.log(getProRes);
                    async.eachSeries(getProRes, function (chatListObj, chatListCB) {
                        ComnFun.publishMqtt("Product/" + (chatListObj.initiatedBy).toString(), JSON.stringify(prod_updt_obj));
                        chatListCB(null)
                    }, function (chatListLoopErr) {
                        // if (chatListLoopErr) finalCB({ code: 500, message: chatListLoopErr.message }, null);
                        // finalCB(null, { code: 200, message: 'Updated successfully.' });
                    });
                    finalCB(null, true);
                } else {
                    finalCB(null, true);
                }
            });
        }
    ], function (e, d) {
        if (e) return reply(e).code(e.code);
        else return reply(d).code(200);
    });
}

