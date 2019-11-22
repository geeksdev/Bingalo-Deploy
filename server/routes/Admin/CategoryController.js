var config = require('../../config');
var async = require('async');
var moment = require('moment');
var promise = require('bluebird');
const fs = require('fs');
const fileUpload = require('express-fileupload');
const isImageUrl = require('is-image-url');

// promise.promisifyAll(dbneo4j);
module.exports = function (app, express) {
    var Router = express.Router();
    app.use(fileUpload());

    /**
     * Route to update fields of the general post settings
     * @deprecated
     */
    Router.post('/updateCategorySettings', function (req, res) {
        if (req.body.fields) {

            var updateQuery;
            for (var i = 0, len = req.body.fields.length; i < len; i++) {
                if (req.body.fields[i].fieldName && req.body.fields[i].type)
                    updateQuery = 'MERGE (g : Category) - [:FIELD] ->(:Added {fieldName: "' + req.body.fields[i].fieldName + '",type: "' + req.body.fields[i].type + '" })\n';
            }

            updateQuery += 'RETURN g';
            // return res.send(updateQuery);
            dbneo4j.cypher({ query: updateQuery }, function (err, result) {
                if (err)
                    return res.json({ code: 20009, message: 'database error', error: err }).status(20009);

                return res.json({ code: 200, message: 'success' });
            });
        }
        else
            return res.json({ code: 4000, message: 'no fields to update' });
    });



    /**
     * Route to remove the fields from the general post settings
     * @deprecated
     */
    Router.post('/removeCategorySettings', function (req, res) {
        if (req.body.fieldName) {

            var deleteQuery = 'MATCH (:Category)-[]->(n:Added {fieldName: "' + req.body.fieldName + '" }) DETACH DELETE n RETURN \"done\" AS flag';

            dbneo4j.cypher({ query: deleteQuery }, function (err, result) {
                if (err)
                    return res.json({ code: 20009, message: 'database error', error: err }).status(20009);
                else
                    return res.json({ code: 200, message: 'successfuly removed' });
            });
        }
        else
            return res.json({ code: 4000, message: 'no fieldName to remove' });
    });

    /**
     * Api to add  multiple categoroies, subacategories
     * @deprecated
     */

    Router.post('/addCategory', function (req, res) {
        // console.log(req.body);
        if (req.body.fields) {

            var updateQuery = '';
            if (req.body.subCategory) {
                if (!req.body.mainCategory)
                    return res.json({ code: 198, message: 'mandatory mainCategory name is missing' }).status(198);

                updateQuery = 'MATCH (c:Category {name: "' + req.body.mainCategory.trim().toLowerCase() + '"}) ';
                for (var i = 0, len = req.body.fields.length; i < len; i++) {
                    if (req.body.fields[i].fieldName)
                        // updateQuery += 'MERGE (c : Category {name : "' + req.body.fields[i].fieldName + '" }) ';
                        updateQuery += 'MERGE (s' + i + ': SubCategory {name : "' + req.body.fields[i].fieldName.toLowerCase().trim() + '" }) '
                            + 'CREATE UNIQUE (s' + i + ')-[r' + i + ':subCategory]->(c) ';
                }
            }
            else {
                for (var i = 0, len = req.body.fields.length; i < len; i++) {
                    if (req.body.fields[i].fieldName)
                        // updateQuery += 'MERGE (c : Category {name : "' + req.body.fields[i].fieldName + '" }) ';
                        updateQuery += 'MERGE (c' + i + ': Category {name : "' + req.body.fields[i].fieldName.toLowerCase().trim() + '" }) ';
                }
            }
            // return res.send(updateQuery)
            dbneo4j.cypher({ query: updateQuery }, function (err, result) {
                if (err)
                    return res.json({ code: 20009, message: 'database error', error: err }).status(20009);
                return res.json({ code: 200, message: 'success' });
            });
        }
        else
            return res.json({ code: 4000, message: 'no fields to update' });
    });


    /**
     * function to decode base 64 
     */

    function base64_decode(data) {
        // console.log("data"+data);
        var b64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
        var o1, o2, o3, h1, h2, h3, h4, bits, i = 0,
            ac = 0,
            dec = '',
            tmp_arr = [];
        if (!data) {
            return data;
        }

        data += '';
        do { // unpack four hexets into three octets using index points in b64
            h1 = b64.indexOf(data.charAt(i++));
            h2 = b64.indexOf(data.charAt(i++));
            h3 = b64.indexOf(data.charAt(i++));
            h4 = b64.indexOf(data.charAt(i++));
            bits = h1 << 18 | h2 << 12 | h3 << 6 | h4;
            o1 = bits >> 16 & 0xff;
            o2 = bits >> 8 & 0xff;
            o3 = bits & 0xff;
            if (h3 == 64) {
                tmp_arr[ac++] = String.fromCharCode(o1);
            } else if (h4 == 64) {
                tmp_arr[ac++] = String.fromCharCode(o1, o2);
            } else {
                tmp_arr[ac++] = String.fromCharCode(o1, o2, o3);
            }
        } while (i < data.length);
        dec = tmp_arr.join('');
        return dec.replace(/\0+$/, '');
    }



    /**
     * API to add single category or sub-category
     * if categoryName is 'others' create a subcategory named others with it
     */
    Router.post('/adminCategory', function (req, res) {
        var username = req.decoded.name;
        if (!req.body.categoryName) return res.send({ code: 422, message: 'mandatory parameter category missing' }).status(422);
        if (!req.body.activeimage) return res.send({ code: 422, message: 'mandatory parameter activeimage missing' }).status(422);
        if (!req.body.deactiveimage) return res.send({ code: 422, message: 'mandatory parameter deactiveimage missing' }).status(422);

        var responseObj = {};
        var query = '';
        var returnQuery = ';';
        // if (req.body.categoryName === 'others') {
        //     // var imageUrl = req.body.mainUrl.trim() || 'https://cdn2.iconfinder.com/data/icons/shopping-e-commerce-4/100/SC-14-512.png';
        //     // console.log(imageUrl);
        //     query += 'MERGE (b : SubCategory {name : "others"}) WITH b,c CREATE UNIQUE (b)-[r  : subCategory]->(c) ';
        //     returnQuery = ', b.name AS subCategory, b.imageUrl AS subCategoryImaurl;';
        // }

        // console.log(returnQuery);

        // return res.send(typeof req.body.images);

        // imageArr['mainUrl'] = req.body.images[0];
        // imageArr['activeUrl'] = req.body.images[1];
        async.waterfall([
            function uploadImages(cb) {
                //get number and the code for verication
                // for (var i = 0; i < 2; i++) {
                // console.log("body",req.body);
                // console.log("image",req.body.deactiveimage.split(',')[1]);
                var fileData = base64_decode(req.body.deactiveimage.split(',')[1]);
                var ImageName = moment().valueOf() + ".png";
                var responseObj = {};
                var target_path = '/var/www/html/public/appAssets/' + ImageName;
                fs.appendFile(target_path, fileData, 'binary', function (err) {
                    //            
                    if (err) {
                        // console.log("getting error: " + err);
                        responseObj = { code: 500, message: 'upload failed' };
                        cb(responseObj, null);
                    } else {
                        // var configImagesCollection = mongoDb.collection('configImages');
                        // console.log({ code: 200, message: 'success', data: target_path });
                        cb(null, ImageName);
                        // return res.send({ code: 200, message: 'success', data: target_path }).status(200);
                    }
                });

                // }
            },
            function uploadActiveImageUrl(inactiveImageUrl, cb) {
                var fileData = base64_decode(req.body.activeimage.split(',')[1]);
                var ImageName = moment().valueOf() + ".png";
                var responseObj = {};
                var target_path = '/var/www/html/public/appAssets/' + ImageName;
                fs.appendFile(target_path, fileData, 'binary', function (err) {
                    //            
                    if (err) {
                        // console.log("getting error: " + err);
                        responseObj = { code: 500, message: 'upload failed' };
                        cb(responseObj, null);
                    } else {
                        // var configImagesCollection = mongoDb.collection('configImages');
                        // console.log({ code: 200, message: 'success', data: target_path });
                        var path = {};
                        path.mainUrl = `${config.hostUrl}/public/appAssets/${inactiveImageUrl}`;
                        path.activeUrl = `${config.hostUrl}/public/appAssets/${ImageName}`;
                        cb(null, path);
                        // return res.send({ code: 200, message: 'success', data: target_path }).status(200);
                    }
                });
            },
            function addCategory(data, cb) {

                var categoryImageUrl = data.mainUrl;
                var categoryActiveImageUrl = data.activeUrl;

                // console.log(categoryImageUrl);
                var addCategoryQuery = 'MERGE (c : Category {name : "' + req.body.categoryName.toLowerCase().trim() + '", '
                    + 'mainUrl:"' + categoryImageUrl + '", activeImageUrl : "' + categoryActiveImageUrl + '"}) '
                    // + 'WITH c '
                    // + query
                    + 'RETURN c.name AS category, c.mainUrl AS categoryImageUrl, c.activeImageUrl AS activeImageUrl;  ';
                // + returnQuery;
                // return res.send(addCategoryQuery);
                dbneo4j.cypher({ query: addCategoryQuery }, function (e, d) {
                    if (e) {
                        responseObj = { code: 500, message: 'internal server error', error: e };
                        cb(responseObj, null);
                    } else if (d.length === 0) {
                        responseObj = { code: 409, message: 'category already exists' };
                        cb(responseObj);
                    } else {
                        responseObj = { code: 200, message: 'success, category added', data: d };
                        cb(null, responseObj);
                    }
                });
            }
        ], function (e, d) {
            if (e) {
                return res.send(e).status(e.code);
            } else {
                return res.send(d).status(d.code)
            }
        });
    });



    /**
     * API to edit category
     * @param {} token
     * @param {} token
     */
    Router.put('/adminCategory', function (req, res) {
        var username = req.decoded.name;
        var updateQuery;
        var label = 'Category';
        var responseObj = {};
        // console.log(req.body.activeImg);
        // console.log(req.body.deactiveImg);
        if (!req.body.oldName) {
            return res.send({ code: 422, message: 'mandatory parameter oldName missing' }).status(422);
        }
        if (!req.body.newName) {
            return res.send({ code: 422, message: 'mandatory parameter newName missing' }).status(422);
        }
        var actImage, deaImage;
        if (!req.body.activeimage) return res.send({ code: 422, message: 'mandatory parameter activeimage missing' }).status(422);
        if (!req.body.deactiveimage) return res.send({ code: 422, message: 'mandatory parameter deactiveimage missing' }).status(422);
        async.waterfall([
            function uploadMainImageUrl(cb) {
                if (!isImageUrl(req.body.deactiveimage)) {
                    if (req.body.deactiveImg) {
                        var deactive = req.body.deactiveImg.split('/');
                        var rootDeactiveImageUrl = '/var/www/html/public/appAssets/' + deactive[5];
                        if (fs.existsSync(rootDeactiveImageUrl)) {
                            fs.unlinkSync(rootDeactiveImageUrl, function (err1, del1) {
                                if (err1) {
                                    console.log('could not delete main image', err1);
                                } else {
                                    console.log('main image deleted', del1);
                                }
                            });
                        }
                    }
                    var fileData = base64_decode(req.body.deactiveimage.split(',')[1]);
                    var ImageName = moment().valueOf() + ".png";
                    var responseObj = {};
                    var target_path = '/var/www/html/public/appAssets/' + ImageName;
                    fs.appendFile(target_path, fileData, 'binary', function (err) {
                        if (err) {
                            responseObj = { code: 500, message: 'upload failed' };
                            cb(responseObj, null);
                        } else {
                            deaImage = `${config.hostUrl}/public/appAssets/${ImageName}`;
                            cb(null, ImageName);
                        }
                    });
                } else {
                    deaImage = req.body.deactiveImg;
                    cb(null, deaImage);
                }
            },
            function uploadActiveImageUrl(inactiveImageUrl, cb) {
                if (!isImageUrl(req.body.activeimage)) {
                    if (req.body.activeImg) {
                        var active = req.body.activeImg.split('/');
                        var rootActiveImageUrl = '/var/www/html/public/appAssets/' + active[5];
                        if (fs.existsSync(rootActiveImageUrl)) {
                            fs.unlinkSync(rootActiveImageUrl, function (err1, del1) {
                                if (err1) {
                                    console.log('could not delete active image', err1);
                                } else {
                                    console.log('active image deleted', del1);
                                }
                            });
                        }
                    }
                    var fileData = base64_decode(req.body.activeimage.split(',')[1]);
                    var ImageName = moment().valueOf() + ".png";
                    var responseObj = {};
                    var target_path = '/var/www/html/public/appAssets/' + ImageName;
                    fs.appendFile(target_path, fileData, 'binary', function (err) {
                        if (err) {
                            console.log("getting error: " + err);
                            responseObj = { code: 500, message: 'upload failed' };
                            cb(responseObj, null);
                        } else {
                            console.log({ code: 200, message: 'success', data: target_path });
                            actImage = `${config.hostUrl}/public/appAssets/${ImageName}`;
                            cb(null, ImageName);
                        }
                    });
                } else {
                    actImage = req.body.activeImg;
                    cb(null, actImage);
                }
            },
            function updateCategory(path, cb) {
                updateQuery = 'MATCH (a : ' + label + ' {name : "' + req.body.oldName.toLowerCase() + '"}) '
                    + 'SET a.name = "' + req.body.newName.toLowerCase() + '", a.mainUrl ="' + deaImage + '", '
                    + 'a.activeImageUrl = "' + actImage + '" '
                    + 'RETURN DISTINCT a.name AS name, a.mainUrl AS mainUrl, a.activeImageUrl AS activeImageUrl LIMIT 1; ';

                dbneo4j.cypher({ query: updateQuery }, function (e, d) {
                    if (e) {
                        responseObj = { code: 500, message: 'error encountered while updating category - subcategory fields', err: e };
                        cb(responseObj, null);
                    }
                    responseObj = { code: 200, message: 'success', data: d };
                    cb(null, responseObj);
                });
            }
        ], (e, d) => {
            if (e) return res.send(e).status(500);
            else return res.send(d).status(200);
        });



        // async.waterfall([
        //     function getImageUrls(cb) {
        //         // console.log('here');
        //         // console.log("body",req.body);
        //         // res.end('hereeeee');
        //         if (req.body.activeImg) {
        //             // console.log(req.body.activeImg);
        //             var active = req.body.activeImg.split('/');
        //             var rootActiveImageUrl = '/var/www/html/public/appAssets/' + active[5];
        //             if (fs.existsSync(rootActiveImageUrl)) {
        //                 // var active = req.body.activeimage.split('/');
        //                 // var rootActiveImageUrl = '/var/www/html/public/appAssets/' + active[5];
        //                 fs.unlinkSync(rootActiveImageUrl, function (err1, del1) {
        //                     if (err1) {
        //                         console.log('could not delete active image', err1);
        //                     } else {
        //                         console.log('active image deleted', del1);
        //                     }
        //                 });
        //             }
        //         }
        //         if (req.body.deactiveImg) {
        //             var deactive = req.body.deactiveImg.split('/');
        //             var rootDeactiveImageUrl = '/var/www/html/public/appAssets/' + deactive[5];
        //             if (fs.existsSync(rootDeactiveImageUrl)) {
        //                 fs.unlinkSync(rootDeactiveImageUrl, function (err1, del1) {
        //                     if (err1) {
        //                         console.log('could not delete main image', err1);
        //                     } else {
        //                         console.log('main image deleted', del1);
        //                     }
        //                 });
        //             }
        //         }
        //         cb(null, true);
        //     },
        //     function uploadMainImageUrl(data, cb) {
        //         console.log("out");
        //         if (!isImageUrl(req.body.deactiveimage)) {
        //             console.log('in');
        //             var fileData = base64_decode(req.body.deactiveimage.split(',')[1]);
        //             var ImageName = moment().valueOf() + ".png";
        //             var responseObj = {};
        //             var target_path = '/var/www/html/public/appAssets/' + ImageName;
        //             fs.appendFile(target_path, fileData, 'binary', function (err) {
        //                 //            
        //                 if (err) {
        //                     // console.log("getting error: " + err);
        //                     responseObj = { code: 500, message: 'upload failed' };
        //                     cb(responseObj, null);
        //                 } else {
        //                     // var configImagesCollection = mongoDb.collection('configImages');
        //                     // console.log({ code: 200, message: 'success', data: target_path });
        //                     cb(null, ImageName);
        //                     // return res.send({ code: 200, message: 'success', data: target_path }).status(200);
        //                 }
        //             });
        //         } else {
        //             var dImg = req.body.deactiveImg.split('/');
        //             cb(null, dImg[5]);
        //         }
        //     },
        //     function uploadActiveImageUrl(inactiveImageUrl, cb) {
        //         console.log('2');
        //         if (!isImageUrl(req.body.activeimage)) {
        //             var fileData = base64_decode(req.body.activeimage.split(',')[1]);
        //             var ImageName = moment().valueOf() + ".png";
        //             var responseObj = {};
        //             var target_path = '/var/www/html/public/appAssets/' + ImageName;
        //             fs.appendFile(target_path, fileData, 'binary', function (err) {
        //                 //            
        //                 if (err) {
        //                     console.log("getting error: " + err);
        //                     responseObj = { code: 500, message: 'upload failed' };
        //                     cb(responseObj, null);
        //                 } else {
        //                     // var configImagesCollection = mongoDb.collection('configImages');
        //                     console.log({ code: 200, message: 'success', data: target_path });
        //                     var path = {};
        //                     path.mainUrl = `${config.hostUrl}/public/appAssets/${inactiveImageUrl}`;
        //                     path.activeUrl = `${config.hostUrl}/public/appAssets/${ImageName}`;
        //                     cb(null, path);
        //                     // return res.send({ code: 200, message: 'success', data: target_path }).status(200);
        //                 }
        //             });
        //         } else {

        //             var path = {};
        //             path.mainUrl = `${config.hostUrl}/public/appAssets/${inactiveImageUrl}`
        //             // path.mainUrl = req.body.deactiveimage;
        //             path.activeUrl = req.body.activeimage;
        //             cb(null, path);
        //         }
        //     },
        //     function updateCategory(path, cb) {
        //         updateQuery = 'MATCH (a : ' + label + ' {name : "' + req.body.oldName.toLowerCase() + '"}) '
        //             + 'SET a.name = "' + req.body.newName.toLowerCase() + '", a.mainUrl ="' + path.mainUrl + '", '
        //             + 'a.activeImageUrl = "' + path.activeUrl + '" '
        //             + 'RETURN DISTINCT a.name AS name, a.mainUrl AS mainUrl, a.activeImageUrl AS activeImageUrl LIMIT 1; ';

        //         dbneo4j.cypher({ query: updateQuery }, function (e, d) {
        //             if (e) {
        //                 responseObj = { code: 500, message: 'error encountered while updating category - subcategory fields', err: e };
        //                 cb(responseObj, null);
        //             }
        //             responseObj = { code: 200, message: 'success', data: d };
        //             cb(null, responseObj);
        //         });
        //     }
        // ], (e, d) => {
        //     if (e) return res.send(e).status(500);
        //     else return res.send(d).status(200);
        // });
    });


    /**
     * Remove a category or a sub-category
     * @added 10th May 2017
     * @description if subCategory is true delete subCategory else delete category
     */
    Router.post('/removeCategory', function (req, res) {
        req.check('name', 'mandatory parameter category name missing').notEmpty();
        if (req.body.activeimage) {
            console.log(req.body.activeimage);
            var active = req.body.activeimage.split('/');
            var rootActiveImageUrl = '/var/www/html/public/appAssets/' + active[5];
            if (fs.existsSync(rootActiveImageUrl)) {
                // var active = req.body.activeimage.split('/');
                // var rootActiveImageUrl = '/var/www/html/public/appAssets/' + active[5];
                fs.unlinkSync(rootActiveImageUrl, function (err1, del1) {
                    if (err1) {
                        console.log('could not delete active image', err1);
                    } else {
                        console.log('active image deleted', del1);
                    }
                });
            }
        }
        if (req.body.deactiveimage) {
            var deactive = req.body.deactiveimage.split('/');
            var rootDeactiveImageUrl = '/var/www/html/public/appAssets/' + deactive[5];
            if (fs.existsSync(rootDeactiveImageUrl)) {
                fs.unlinkSync(rootDeactiveImageUrl, function (err1, del1) {
                    if (err1) {
                        console.log('could not delete main image', err1);
                    } else {
                        console.log('main image deleted', del1);
                    }
                });
            }
        }
        deleteQuery = 'MATCH (c:Category {name: "' + req.body.name + '" }) '
            // + 'WITH c OPTIONAL MATCH (s : SubCategory)-[r : subCategory]->(c) '
            + 'DETACH DELETE c RETURN "done" AS flag;';
        dbneo4j.cypher({ query: deleteQuery }, function (err, result) {
            if (err)
                return res.json({ code: 500, message: 'database error', error: err }).status(500);
            else
                return res.json({ code: 200, message: 'successfuly removed', data: result }).status(200);
        });
    });

    /**
     * api to add subcategory
     * @added - 19th april 2017
     * @deprecated
     */

    Router.post('/subCategory', (req, res) => {
        var admin = req.decoded.name;
        if (!req.body.category) {
            return res.status(422).send({ code: 422, message: 'mandatory paramter category missing' });
        }
        if (!req.body.subCategory) {
            return res.status(422).send({ code: 422, message: 'mandatory parmeter subCategory missing' });
        }
        var condition = '';
        var responseObj = {};
        var stack = [];
        var verifyAdmin = function (cb) {
            var cypher = `MATCH (a : Admin {username : "` + admin + `"}) RETURN COUNT(a) AS admin LIMIT 1; `;

            dbneo4j.cypher({ query: cypher }, (err, data) => {
                if (err) {
                    responseObj = {
                        code: 500,
                        message: 'internal server error',
                        error: e
                    };
                    cb(responseObj, null);
                } else if (data[0].admin === 0) {
                    responseObj = {
                        code: 204,
                        message: 'admin not found',
                    };
                    cb(responseObj, null);
                } else {
                    cb(null, data);
                }
            });
        }

        var createSubCategory = function (cb) {
            if (req.body.imageUrl) {
                condition += ` SET b.imageUrl = ` + JSON.stringify(req.body.imageUrl.trim()) + ` `;
            }
            var createSubCategoryQuery = `MATCH (a : Category {name : "` + req.body.category.trim() + `"}) `
                + `MERGE (b : SubCategory {name : "` + req.body.subCategory.trim() + `"}) `
                + `CREATE UNIQUE (b)-[r  : subCategory]->(a) `
                + condition
                + `RETURN DISTINCT a.name AS categoryname, b.name AS subCategoryName, b.imageUrl AS imageUrl; `;

            dbneo4j.cypher({ query: createSubCategoryQuery }, (e, d) => {
                if (e) {
                    responseObj = {
                        code: 500,
                        message: 'internal server error',
                        error: e
                    };
                    cb(responseObj, null);
                } else if (d.length === 0) {
                    responseObj = {
                        code: 204,
                        message: 'category not found'
                    };
                    cb(responseObj, null);
                } else {
                    responseObj = {
                        code: 200,
                        message: 'success',
                        data: d
                    };
                    cb(responseObj, null);
                }
            });
        }

        stack.push(verifyAdmin);
        stack.push(createSubCategory);
        async.parallel(stack, (e, d) => {
            if (e) return res.status(e.code).send(e);
            else return res.status(d.code).send(d);
        });
    });


    /**
     * api to edit sub category
     * @deprecated
     */

    Router.put('/subCategory', (req, res) => {
        var admin = req.decoded.name;
        if (!req.body.subCategory) {
            return res.status(422).send({ code: 422, message: 'mandatory parmeter subCategory missing' });
        }
        var condition = '';
        var responseObj = {};
        async.waterfall([
            function verifyAdmin(cb) {
                var cypher = `MATCH (a : Admin {username : "` + admin + `"}) RETURN COUNT(a) AS admin LIMIT 1; `;
                // console.log(cypher);
                dbneo4j.cypher({ query: cypher }, (err, data) => {
                    if (err) {
                        responseObj = {
                            code: 500,
                            message: 'internal server error',
                            error: e
                        };
                        cb(responseObj, null);
                    } else if (data[0].admin === 0) {
                        responseObj = {
                            code: 204,
                            message: 'admin not found',
                        };
                        cb(responseObj, null);
                    } else {
                        cb(null, data[0]);
                    }
                });
            },

            function updateSubCategory(data, cb) {
                if (!req.body.newName) return res.status(422).send({ code: 422, message: 'mandatory paramter new name missing' });
                if (req.body.newName) condition += `SET b.name = ` + JSON.stringify(req.body.newName.trim()) + ` `;
                if (req.body.imageUrl) condition += `, b.imageUrl = ` + JSON.stringify(req.body.imageUrl.trim()) + ` `;
                var updateQuery = `MATCH (b : SubCategory {name : "` + req.body.subCategory.trim() + `"}) ` + condition + ` RETURN DISTINCT `
                    + `b.name AS sabCategoryName, b.imageUrl AS subCategoryImageUrl, ID(b) AS subCategoryId; `;

                dbneo4j.cypher({ query: updateQuery }, (e, d) => {
                    if (e) {
                        responseObj = {
                            code: 500,
                            messae: 'internal server error',
                            error: e
                        };
                        cb(responseObj, null);
                    } else if (d.length === 0) {
                        responseObj = {
                            code: 204,
                            message: 'data not found'
                        };
                        cb(responseObj, null);
                    } else {
                        responseObj = {
                            code: 200,
                            message: 'success',
                            data: d
                        };
                        cb(null, responseObj);
                    }
                });
            }
        ], (e, d) => {
            if (e) return res.status(e.code).send(e);
            else return res.status(d.code).send(d);
        });
    });


    /**
    * api to get user category
    * @author Piyush
    * @date 15th April 2017
    * @deprecated
    */
    Router.get('/getCategory', function (req, res) {
        var query = `MATCH(c:Category) RETURN c.name AS name ;`;
        dbneo4j.cypher({ query: query }, function (e, d) {
            if (e) {
                return res.send({ code: 500, message: "database error", error: e }).status(500);
            } else if (d.length === 0) {
                return res.send({ code: 204, message: "no data", error: e }).status(204);
            } else {
                return res.send({ code: 200, message: "success", data: d }).status(200);
            }
        });
    });


    /**
     * api to user sub category
     * @author Piyush
     * @date 15th April 2017
     * @deprecated
     */
    Router.get('/getsubCategory', function (req, res) {
        if (!req.query.category.trim()) {
            return res.send({ code: 422, message: 'mandatory paramter missing' }).status(422);
        }
        var query = `MATCH (n:SubCategory)-[rel : subCategory]->(c : Category {name : "` + req.query.category.trim() + `"}) `
            + `RETURN n.name AS name`;
        dbneo4j.cypher({ query: query }, function (e, d) {
            if (e) {
                return res.send({ code: 500, message: "database error", error: e }).status(500);
            } else if (d.length === 0) {
                return res.send({ code: 204, message: "no data", error: e }).status(204);
            } else {
                return res.send({ code: 200, message: "success", data: d }).status(200);
            }
        })

    })



    /**
      * Get Categories
      * api can be accessed without authentication
      */

    Router.get('/getCategories', function (req, res) {
        //  return res.send(getCategories);
        // var username = req.decoded.name;
        var limit = 40;
        var offset = 0;
        if (req.query.limit) limit = parseInt(req.query.limit);
        if (req.query.offset) offset = parseInt(req.query.offset);
        var cypher = 'MATCH (c : Category) '
            // + 'OPTIONAL MATCH (c)<-[s : subCategory]-(subcategory : SubCategory) '
            + 'RETURN DISTINCT ID(c) AS categoryNodeId, c.name AS name, c.mainUrl AS deactiveimage, c.activeImageUrl AS activeimage '
            // + 'COUNT(s) AS subCategoryCount, '
            // + 'COLLECT (DISTINCT {subcategoryname : subcategory.name, subcategoryImage : subcategory.imageUrl}) AS subcategory '
            + 'ORDER BY (name) SKIP ' + offset + ' LIMIT ' + limit + '; ';
        //@updated without sub category: 12th may 2017
        // var cypher = 'MATCH (c : Category) '
        //     + 'RETURN DISTINCT ID(c) AS categoryNodeId, c.name AS categoryName, c.mainUrl AS categoryImageUrl, '
        //     + 'ORDER BY (categoryName) SKIP ' + offset + ' LIMIT ' + limit + '; ';
        // res.send(cypher);
        dbneo4j.cypher({ query: cypher }, function (err, data) {
            if (err) {
                return res.send({ code: 500, message: 'error encountered while fetching category list', stacktrace: err }).status(500);
            }
            var catLen = data.length;
            if (catLen === 0) {
                return res.send({ code: 204, message: 'no category to display' }).status(204);
            }
            // data.forEach(function (element) {
            //     element.forEach(function (x) {
            //         console.log(x);
            //     }, this);
            // }, this);
            return res.send({ code: 200, message: 'Succcess', data: data }).status(200);
        });
    });


    /**
     * api to get subcategories by category name / admin
     * @author : Piyush
     * @date : 6th April 2017
     * @updated : 21st April 2017
     * @deprecated
     */

    Router.get('/category/:category/subCategory', function (req, res) {

        var username = req.decoded.name.trim();
        if (!req.params.category) return res.status(422).send({ code: 422, message: "mandatory category missing" });
        var category = JSON.stringify(req.params.category.trim());
        var offset = parseInt(req.query.offset || 0);
        var limit = parseInt(req.query.limit || 30);
        var query = `MATCH (n:SubCategory)-[rel : subCategory]->(c : Category {name : ` + category + `}) `
            + `RETURN n.name AS subcategory, n.imageUrl AS subCategoryImageUrl ;`;

        dbneo4j.cypher({ query: query }, function (e, d) {
            if (e) {
                return res.send({ code: 500, message: "database error", error: e });
            }

            if (d.length === 0) {
                return res.send({ code: 204, message: "no subcategory available" }).status(204);
            }
            else {
                return res.send({ code: 200, message: "success", data: d }).status(200);
            }
        });
    });




    return Router;
}