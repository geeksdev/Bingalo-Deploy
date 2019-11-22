/**@author:Yunus & dipen: 
 * Declaration of modules for dbConfig class
 */
// var redis = require("redis");
// var Messages = require('./statusMessages.json');//import messages for status response
// var einstonLogs = require('./einstonLogs.js');//import einstonLogs for logs generation
var fs = require('fs');//import fs for file operations
// var client = redis.createClient();
// client.on('connect', function () { console.log('Redis connected'); }); // redis connection
var config = require('./config');
var mongodb = require('mongodb');
var MongoClient = require('mongodb').MongoClient;
MongoClient.connect(config.databaseMongoDb,
    function (err, db2) {
        if (err) { console.error(err); }
        console.log("MongoDb connected");
        db = db2;
    });

/*
in this file you can create your class with some method and also configer you class in bottem of this file.
if you done the db configer like connection-top of this file,pass DB name at-bottom of this file.
then you can use this class or function from middleware or any of the file , at other file you should import/require this file.
*/

/**
 * RedisDB Class
 */
// class RedisDB {
//     constructor() { }
//     /**Insert function is use to insert key, values to database **/
//     Insert(key, value, extras, callback) {
//         if (value == null) {
//             return false;
//         }
//         if (typeof extras === 'string' && extras == 'sadd') {
//             client.sadd(key, value, (err, data) => {
//                 return callback(err, data);
//             })
//         } else if (typeof extras === 'string' && extras == 'srem') {
//             client.srem(key, value, (err, data) => {
//                 return callback(err, data);
//             })
//         } else {
//             if (extras.extra >= 0) {
//                 client.setex(key, extras.extra, value, (err, data) => {
//                     return callback(err, data);
//                 })
//             } else {
//                 if (typeof value === 'object') {
//                     client.hmset(key, value, (err, data) => {
//                         return callback(err, data);
//                     });
//                 } else {
//                     client.set(key, value, (err, dataa) => {
//                         return callback(err, dataa);
//                     });
//                 }
//             }
//         }
//     }
//     /**Update function is use to insert key, values to database **/
//     Update(key, value, extras, callback) {
//         if (value == null) {
//             return false;
//         }
//         if (typeof extras === 'string' && extras == 'sadd') {
//             client.sadd(key, value, (err, data) => {
//                 return callback(err, data);
//             })
//         } else if (typeof extras === 'string' && extras == 'srem') {
//             client.srem(key, value, (err, data) => {
//                 return callback(err, data);
//             })
//         } else {
//             if (extras.extra >= 0) {
//                 client.setex(key, extras.extra, value, (err, data) => {
//                     return callback(err, data);
//                 })
//             } else {
//                 if (typeof value === 'object') {
//                     client.hmset(key, value, (err, data) => {
//                         return callback(err, data);
//                     });
//                 } else {
//                     client.set(key, value, (err, dataa) => {
//                         return callback(err, dataa);
//                     });
//                 }
//             }
//         }
//     }
//     /**Select function is use to select values based on key **/
//     Select(key, value, extras, callback) {
//         if (key == null) {
//             return false;
//         }
//         if (value == 'get') {
//             client.get(key, (err, data) => {
//                 return callback(err, data);
//             });
//         } else if (value == 'hgetall') {
//             client.hgetall(key, (err, data) => {
//                 return callback(err, data);
//             });
//         } else if (value == 'exists') {
//             client.exists(key, (err, data) => {
//                 return callback(err, data);
//             });
//         } else {
//             throw new Error(Messages.WRONGTYPE_OPERATION);
//         }
//     }
//     /**Delete function is use to Delete keys **/
//     Delete(key, value, callback) {
//         client.del(key, (err, data) => {
//             return callback(err, data);
//         });
//     }
//     /**TimeToLeave function is use to get the remaining key expiry status **/
//     TimeToLeave(key, callback) {
//         client.ttl(key, (err, data) => {
//             return callback(err, data);
//         });
//     }
// }


/**
 * MongoDB Class
 */
class MongoDB {
    constructor() { }
    /**Insert function is use to insert parameters to database.
     * It's a generic function, tablename is use for Tablename in the db.
     * data is array to insert documents in table.
     * if inserted then go callback function else error.
     * **/
    Insert(tablename, data, extra, callback) {  // expiry(redis key) not using here
        var collection = db.collection(tablename);
        collection.insert([data], function (err, result) {
            if (err) {
                console.log(err);
            } else {
                return callback(err, result);
            }
        });
    };

    /**Select function is use to fetch data from database.
    * It's a generic function, tablename is use for Tablename in the db.
    * data is array to provide where condition in table.
    * if success then go callback function else error.
    * Result is use to store all data resulted from select function.
    * **/
    Select(tablename, data, extras, callback) {
        var collection = db.collection(tablename);
        if (extras) {
            collection.findOne(data, extras, (function (err, result) {
                return callback(err, result);
            }));
        } else {
            if (data) {
                collection.findOne(data, (function (err, result) {
                    return callback(err, result);
                }));
            }
            collection.find(data).toArray(function (err, result) {
                return callback(err, result);
            });
        }
    }

    /**Update function is use to Update parameters to database.
     * It's a generic function, tablename is use for Tablename in tnullhe db.
     * data is array to Update documents in table.
     * if Updated then go callback function else error.
     * **/
    Update(tablename, data, condition, callback) {
        var collection = db.collection(tablename);
        collection.update(condition, { $set: data }, { multi: true }, (function (err, result) {
            return callback(err, result);
        }));
    }

    /**Delete function is use to delete parameters to database.
     * It's a generic function, tablename is use for Tablename in the db.
     * data is array to give the condition.
     * if deleted then go callback function else error.
     * **/
    Delete(tablename, condition, callback) {
        var collection = db.collection(tablename);
        collection.remove(condition, function (err, numberOfRemovedDocs) {
            return callback(err, numberOfRemovedDocs);
        });
    };

    SelectWithSort(tablename, data, extras, sort, callback) {
        var collection = db.collection(tablename);
        // if (extras) {
        //     collection.findOne(data, extras, (function (err, result) {
        //         return callback(err, result);
        //     }));
        // } else {
        //     if (data) {
        //         collection.findOne(data, (function (err, result) {
        //             return callback(err, result);
        //         }));
        //     }
        collection.find(data).sort(sort).toArray(function (err, result) {
            return callback(err, result);
        });
        // }
    }
}


module.exports = function (name) {
    switch (name) {
        // case 'Redis': return new RedisDB;
        case 'Mongo': return new MongoDB;
        default: return fs.appendFile("errLogs.txt", "System Error", Messages.WRONG_DB + name, function (err, data) {
            if (err) {
                console.log("log not created");
                // einstonLogs.loggerError(Messages.UNKNOWN_ERROR);

            } else {
                // einstonLogs.loggerInfo(Messages.DB_CONNECTED);
                console.log("log created");
            }
        })
    }
};