/**@author:Yunus & dipen: 
 * Declaration of modules for dbMiddlware class
 */
var configDB = require('./dbConfig.js'); // importing dbconfig file
let dbUtility;
// var Messages = require('./statusMessages.json');// importing messages file
// var einstonLogs = require('./einstonLogs.js');// importing einstonLogs file
/**
 * @description:dbMiddleware Class
 * HERE already write function such as select , insert, update, delete.
 * you can require this file and use such of any function.
 * in all function have commen agument like key,value,db,extra and callback
 * here key == tablename, value == condition, db == database, extra == extara query feild as your requirement
 * callback == get response
 */
class dbMiddleware {
      /*******************************************************************************************************
    * @description describes Select class.
    * @param:Here key=tablename,value=condition in mongo,key=key name,value=data in redis
    * @param:extras are used in findOne method of mongo, it acts as a extra condition
    */
      Select(key, value, db, extras, callback) {
            try {
                  dbUtility = configDB(db);
                  dbUtility.Select(key, value, extras, function (err, rep) {
                        if (err) {
                              // einstonLogs.loggerError(Messages.WRONGTYPE_CONDITION + err);
                        }
                        return callback(err, rep);
                  })
            } catch (error) {
                  // einstonLogs.loggerError(Messages.UNKNOWN_ERROR + error);
            }
      }
      /*******************************************************************************************************
      * @description describes Insert class.
      * @param:Here key=tablename,value=data in mongo,key=key,value=data in redis
      * @param:extras are used in insert method of redis, it acts as a extra condition
      * @example:object {extra:10} is used as timer in setex condition of redis,extra string 'sadd' or 'srem'       acts as a set in redis
      */
      Insert(key, value, extras, db, callback) {
            try {
                  dbUtility = configDB(db);
                  dbUtility.Insert(key, value, extras, function (err, res) {
                        if (err) {
                              // einstonLogs.loggerError(Messages.WRONGTYPE_CONDITION + err);
                        }
                        callback(err, res);
                  })// Here key is tablename and value is data in mongo  
            } catch (error) {
                  // einstonLogs.loggerError(Messages.UNKNOWN_ERROR + error);
            }
      }
      /*******************************************************************************************************
    * @description describes Update class.
    * @param:Here key=tablename,value=data,extras=condition in mongo,key=key,value=data in redis
    * @param:extras are used in update method of redis, it acts as a extra condition
    * @example:object {extra:10} is used as timer in setex condition of redis,extra string 'sadd' or 'srem'       acts as a set in redis
    */
      Update(key, value, extras, db, callback) {
            try {
                  dbUtility = configDB(db);
                  dbUtility.Update(key, value, extras, function (err, rep) {
                        if (err) {
                              // einstonLogs.loggerError(Messages.WRONGTYPE_CONDITION + err);
                        }
                        return callback(err, rep);
                  })// Here key is tablename,value is data for mongo 
            } catch (error) {
                  // einstonLogs.loggerError(Messages.UNKNOWN_ERROR + error);
            }
      }

      /*******************************************************************************************************
   * @description describes Delete class.
   * @param:Here key=tablename,value=condition in mongo,key=key in redis
   */
      Delete(key, value, db, callback) {
            try {
                  dbUtility = configDB(db);
                  dbUtility.Delete(key, value, function (err, rep) {
                        if (err) {
                              // einstonLogs.loggerError(Messages.WRONGTYPE_CONDITION + err);
                        }
                        return callback(err, rep);
                  })
            } catch (error) {
                  // einstonLogs.loggerError(Messages.UNKNOWN_ERROR + error);
            }
      }

      SelectWithSort(key, value, db, extras, sort, callback) {
            try {
                  dbUtility = configDB(db);
                  dbUtility.SelectWithSort(key, value, extras, sort, function (err, rep) {
                        if (err) {
                              // einstonLogs.loggerError(Messages.WRONGTYPE_CONDITION + err);
                        }
                        return callback(err, rep);
                  })
            } catch (error) {
                  // einstonLogs.loggerError(Messages.UNKNOWN_ERROR + error);
            }
      }
}
module.exports = new dbMiddleware