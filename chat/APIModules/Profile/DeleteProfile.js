const Joi = require('joi');
const jsonwebtoken = require('jsonwebtoken');
const async = require("async");
var objectId = require("mongodb").ObjectID;
const ComnFun = require('../../ComnFun.js');
const conf = require('../../conf.json');
const secretKey = conf.secretKey;
const middleWare = require("../../Controller/dbMiddleware.js");

module.exports = [
    {
        method: 'DELETE',
        path: '/User/Profile/{userName}',
        config: {
            handler: function (req, reply) {
                deleteProfileHandler(req, reply)
            },
            validate: {
                headers: Joi.object({
                    'authorization': Joi.string().description("authorization is required")
                }).unknown(),
                params:{
                    userName: Joi.string().description("userName is required").required()
                }
            },
            plugins: {
                'hapi-swagger': {
                    responses: {
                        '200': {
                            'description': 'Success',
                        },
                        '404': {
                            'description': 'Not found'
                        },
                        '500': {
                            'description': 'Internal Server Error'
                        }

                    }
                }

            },
            description: 'Deletes user profile.',
            notes: 'Header: KMajNKHPqGt6kXwUbFN3dU46PjThSNTtrEnPZUefdasdfghsaderf1234567890ghfghsdfghjfghjkswdefrtgyhdfghj',
            tags: ['api']
        }

    }
];

/**
 * API: DELETE /User/Profile
 * @param {*} req 
 * @param {*} reply 
 */
function deleteProfileHandler(req, reply) {

    console.log('>> deleteProfileHandler')

    async.waterfall([
        function (validateCB) {

            /** validate the header */
            if (!req.headers.authorization) {
                return reply({ code: 101, message: "mandatory headers is missing" }).code(200);
            } else {
                if (req.headers.authorization != conf.authorization) {
                    return reply({ code: 102, message: "failed to authenticate, headers is Invalid " }).code(200);
                }
            }

            if(!req.params.userName) return reply({ code: 101, message: "mandatory userName is missing" }).code(200);

            validateCB(null);
        },
        function (cb) {

            middleWare.Select("userList", { userName: (req.params.userName).trim() }, "Mongo", {}, function (e, d) {
                if (e) {
                    cb({ code: 500, message: 'internal server error', error: e }, null);
                } else if (!d || d.length === 0) {
                    cb({ code: 204, message: 'no data' }, null);
                } else {
                    cb(null, d);
                }
            });
        },
        function (userData, funcMainCB) {

            const userid = userData[0]._id.toString();
            /** members.{id}.inactive in userList */
            /** members.{id}.inactive in chatList */
            /** members.{id}.del in messages */

            async.series([
                function (callback) {

                    /** update userList by marking the user as inactiive */
                    middleWare.FindAndModify('userList',
                        { $set: { inactive: new Date().getTime() } },
                        { _id: userData[0]._id },
                        "Mongo",
                        {},
                        { new: true },
                        function (err, result) {
                            if (err) return res({ message: err.message }).code(503);

                            /** 
                             * mark member in all the chatLists as inactive
                             */
                            middleWare.Update("chatList",
                                { ["members." + userid + ".inactive"]: new Date().getTime() },   // data to update
                                { ["members." + userid]: { $exists: true } },  //condition
                                "Mongo",
                                function (cErr, cRes) {
                                    if (cErr) callback(cErr);

                                    /** mark all the messages as 'del' with timestamp */
                                    middleWare.Update('messages',
                                        { ["members." + userid + ".del"]: new Date().getTime() },
                                        { ["members." + userid]: { $exists: true } },
                                        "Mongo",
                                        function (delMsgErr, delMsgRes) {
                                            if (delMsgErr) return res({ message: delMsgErr.message }).code(503);

                                            callback(null);
                                        })

                                });

                        })

                }
            ], function (err, result) {
                if (err) return reply({ code: 503, message: err.message }).code(503);
                return reply({ code: 200, message: "Data Successfully Updated" }).code(200);
            });
        }
    ]);
}

