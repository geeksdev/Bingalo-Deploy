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
        method: 'DELETE',
        path: '/Product/{id}',
        config: {
            handler: function (req, reply) {
                editProductHandler(req, reply)
            },
            validate: {
                // payload: {
                //     id: Joi.string().description("product id is required"),
                // },
                params: {
                    id: Joi.string().description("product id is required"),
                },
                headers: Joi.object({
                    'authorization': Joi.string().description("authorization required")
                }).unknown()
            },
            description: 'Delete a product',
            notes: 'Delete a product. Header input: KMajNKHPqGt6kXwUbFN3dU46PjThSNTtrEnPZUefdasdfghsaderf1234567890ghfghsdfghjfghjkswdefrtgyhdfghj',
            tags: ['api']
        }
    }
];

/**
 * 
 * @param {*} req 
 * @param {*} reply 
 */
function editProductHandler(req, reply) {
    async.waterfall([
        function (validateCB) {
            // console.log(req.params);
            if (!req.headers.authorization) {
                return reply({ code: 101, message: "mandatory headers is missing" }).code(422);
            } else {
                if (req.headers.authorization != conf.authorization) {
                    return reply({ code: 102, message: "failed to authenticate, headers is Invalid " }).code(401);
                }
            }
            if (!req.params.id) {
                return reply({ code: 103, message: "mandatory product id is missing" }).code(422);
            }
            validateCB(null);
        },
        function (funcMainCB) {
            middleWare.Delete("product", { _id: req.params.id.trim() }, "Mongo", function (getProErr, getProRes) {
                if (getProErr) return reply({ code: 500, message: 'Database error' }).code(500);
                else return reply({ code: 200, message: 'success', data: getProRes }).code(200);
            });
        }
    ]);
}

