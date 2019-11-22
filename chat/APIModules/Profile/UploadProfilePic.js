var jsonwebtoken = require('jsonwebtoken');
var conf = require('../../conf');
var confAAA = require('../../Controller/dbMiddleware.js');
var secretKey = conf.secretKey;
var ObjectID = require('mongodb').ObjectID
var Joi = require('joi');
var middleWare = require("../../Controller/dbMiddleware.js");


module.exports = [
   {
          method: 'POST',
    path: '/submit',
    config: {

        payload: {
            output: 'stream',
            parse: true,
            allow: 'multipart/form-data'
        },
         validate: {
                payload:Joi.object(),
              
            },

        handler: function (request, reply) {
            var data = request.payload;
            if (data.file) {
                var name = data.file.hapi.filename;
                var path = __dirname + "/uploads/" + name;
                var file = fs.createWriteStream(path);

                file.on('error', function (err) { 
                    console.error(err) 
                });

                data.file.pipe(file);

                data.file.on('end', function (err) { 
                    var ret = {
                        filename: data.file.hapi.filename,
                        headers: data.file.hapi.headers
                    }
                    reply(JSON.stringify(ret));
                })
            }

        },
         tags: ['api']

    }
   }];



