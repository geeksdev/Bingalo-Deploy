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
        path: '/Product',
        config: {
            handler: function (req, reply) {
                addProductHandler(req, reply)
            },
            validate: {
                payload: {
                    id: Joi.string().description("product is is required"),
                    name: Joi.string().description("product name is required"),
                    image: Joi.string().description("product image is required").allow(""),
                    negotiable: Joi.string().description("paramter negotiable required")
                },
                headers: Joi.object({
                    'authorization': Joi.string().description("authorization header is required")
                }).unknown()
            },
            description: 'Add a new product.',
            notes: 'Create a new product. Header input: KMajNKHPqGt6kXwUbFN3dU46PjThSNTtrEnPZUefdasdfghsaderf1234567890ghfghsdfghjfghjkswdefrtgyhdfghj',
            tags: ['api']
        }

    }
];

/**
 *  
 */
function addProductHandler(req, reply) {

    console.log('addProductHandler: ' + JSON.stringify(req.payload))

    async.waterfall([
        function (validateCB) {
            if (!req.headers.authorization) {
                return reply({ code: 101, message: "mandatory headers is missing" }).code(200);
            } else {
                if (req.headers.authorization != conf.authorization) {
                    return reply({ code: 102, message: "failed to authenticate, headers is Invalid " }).code(200);
                }
            }
            if (!req.payload.id) {
                return reply({ code: 103, message: "mandatory product id is missing" }).code(200);
            }
            if (!req.payload.name) {
                return reply({ code: 103, message: "mandatory product name is missing" }).code(200);
            }
            if (!req.payload.negotiable) return reply({ code: 422, message: "mandatory paramter neogotiable missing" }).code(422);
            validateCB(null)
        },
        function (decoded, funcMainCB) {
            var productData = {
                _id: req.payload.id,
                name: req.payload.name,
                image: req.payload.image,
                negotiable: req.payload.negotiable
            };
            middleWare.Insert("product", productData, {}, "Mongo", function (err, insRes) {
                if (err) return reply({ code: 500, message: 'Database error', error: err }).code(500);

                else return reply({ code: 200, message: 'Success' });
            });
        }
    ]);
}

