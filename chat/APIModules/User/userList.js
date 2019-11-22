const Joi = require('joi');
var jsonwebtoken = require('jsonwebtoken');
var conf = require('../../conf.json');
var secretKey = conf.secretKey;
var middleWare = require("../../Controller/dbMiddleware.js");
var db = require("../../Controller/dbConfig.js");
var objectId = require("mongodb").ObjectID;

var ComnFun = require('../../ComnFun.js');
var async = require("async");


var MongoClient = require('mongodb').MongoClient;
var mongoDb;
MongoClient.connect(conf.mongodbUrl,
    function (err, db2) {
        if (err) { console.error(err); }
        console.log("MongoDb connected");
        // db = db2;
        mongoDb = db2;
    });



module.exports = [
    {
        method: 'GET',
        path: '/users',
        handler: function (req, res) {
            getUsers(req, res)
        },
        config: {
            description: 'Get the List Of Users (Test API)',
            notes: 'Header input: KMajNKHPqGt6kXwUbFN3dU46PjThSNTtrEnPZUefdasdfghsaderf1234567890ghfghsdfghjfghjkswdefrtgyhdfghj',
            tags: ['api'],
            validate: {
                // payload: {
                //     acessToken: Joi.string().description("accessToken is required"),
                //     pushToken: Joi.string().description("PushToken is required").allow('')
                // },
                headers: Joi.object({
                    'authorization': Joi.string().allow("Authorizarion Header"),
                    'token': Joi.string().description("token is required"),
                }).unknown()
            },
            plugins: {
                'hapi-swagger': {
                    responses: {
                        '200': {
                            'description': 'Success',
                        },
                        '400': {
                            'description': 'Bad requset'
                        },
                        '404': {
                            'description': 'Page Not found'
                        },
                        '409': {
                            'description': 'Duplicate'
                        },
                        '422': {
                            'description': 'Unprocessible Entity'
                        },
                        '500': {
                            'description': 'Internal Server Error'
                        }
                    }
                }

            }
        },

    }
];


function getUsers(req, res) {
    if (!req.headers.token) return res({ code: 422, message: 'mandatory paramter token is missing' }).code(422);
    async.waterfall([
        function validateJWT(cb) {
            jsonwebtoken.verify(req.headers.token, secretKey, function (jwterr, decoded) {
                if (jwterr) {
                    return res({ message: jwterr.message }).code(401);
                } else {
                    cb(null, decoded);
                }
            });
        },
        function getUsers(decoded, cb) {
            var username = decoded.name;
            var query = { 'userName': { $ne: username } };
            middleWare.Select('userList', query, "Mongo", {}, (e, d) => {
                if (e) {
                    cb({ code: 500, message: 'internal server error', error: e }, null);
                    console.log(e);
                } else if (d.length === 0) {
                    cb({ code: 204, messag: 'no data' }, null);
                    console.log('no data');
                } else {
                    console.log(d);
                    cb(null, { code: 200, messag: 'success', data: d });
                }
            });

            // var userCollection = mongoDb.collection('userList');
            // userCollection.find(query, {}, (e, d) => {
            //     if (e) {
            //         cb({ code: 500, message: 'internal server error', error: e }, null);
            //         console.log(e);
            //     } else if (d.length === 0) {
            //         cb({ code: 204, messag: 'no data' }, null);
            //         console.log('no data');
            //     } else {
            //         return res({ code: 500, message: 'internal server error', error: e }).code(200);
            //         cb(null, { code: 200, messag: 'success', data: d });
            //     }
            // });
        }
    ], (e, d) => {
        if (e) return res(e).code(e.code);
        else return res(d).code(d.code);
    });
}





