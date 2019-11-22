const moment = require('moment'); 

var postExpire = module.exports = {};
postExpire.checkPromotePostExpire = (cb) => {
    return new Promise((resolve, reject) => {
        let query = `MATCH(u:User)-[p:POSTS]->(x:Photo)<-[app:inAppPurchase {status : ` + 1 + `}]-(ap:appPurchase) ` +
            `WHERE app.expireOn <= ${parseInt(moment().valueOf())} RETURN app.expireOn AS expireOn,app.promotionTitle AS promotionTitle,` +
            `app.status AS status,app.noOfDays AS noOfDays,x.postId AS postId LIMIT 1 ;`;

        // console.log("query", query);
        dbneo4j.cypher({
            query: query
        }, (err, data) => {
            if (err) return reject({
                code: 500,
                message: 'database error'
            });
            if (data.length == 0) {
                return reject({
                    code: 204,
                    message: 'No expire post found'
                });
            } else {
                return resolve(data);
            }
        });
    }).then(dt1 => {
        return new Promise((resolve, reject) => {
            let query = `MATCH(u:User)-[p:POSTS]->(x:Photo {postId : ${parseInt(dt1[0].postId)}})<-[app:inAppPurchase {status : ` + 1 + `}]` +
                `-(ap:appPurchase) SET app.status = ${0} RETURN app.expireOn AS expireOn,app.promotionTitle AS promotionTitle,` +
                `app.status AS status,app.noOfDays AS noOfDays,x.postId AS postId LIMIT 1 ;`;
            // console.log("query", query);
            dbneo4j.cypher({
                query: query
            }, (err, data) => {
                if (err) return reject({
                    code: 500,
                    message: 'database error'
                });
                if (data.length == 0) {
                    return reject({
                        code: 204,
                        message: 'Something went wrong'
                    });
                }
                return resolve({
                    code: 200,
                    message: 'success'
                });

            })
        })
    }).then(dd => {
        return cb(null, dd);
    }).catch(er => {
        return cb(er, null);
    })
}