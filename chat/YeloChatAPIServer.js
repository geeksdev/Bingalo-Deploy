/*
it have header and token(jsonwebtoken) for authenticate user.
without correct header you can not invoke any API.
and also without correct token you can not invoke any API expect API like login,signUp,socialLogin.
*/
const Hapi = require('hapi');
const Good = require('good');
const Inert = require('inert');
const Vision = require('vision');
const HapiSwagger = require('hapi-swagger');
const Pack = require('./package');
var config = require("./conf.json");


const server = new Hapi.Server();

server.connection({
    port: config.PORT,
    host: '0.0.0.0',
    routes: { cors: true }
});

const swaggerOpts = {
    info: {
        'title': config.appName + ' Chat API Documentation',
        "description": `
<u><b>Type Of Preferences</b></u> \n
  FIXED_LINE = 0,
        MOBILE = 1,
        FIXED_LINE_OR_MOBILE = 2,
        TOLL_FREE = 3,
        PREMIUM_RATE = 4,
        SHARED_COST = 5,
        VOIP = 6,
        PERSONAL_NUMBER = 7,
        PAGER = 8,
        UAN = 9,
        VOICEMAIL = 10,
        UNKNOWN = -1
 \n\n
`,
        'version': Pack.version,
    }
};

server.register([
    Inert,
    Vision,
    {
        'register': HapiSwagger,
        'options': swaggerOpts
    },

], (err) => {
    server.start((err) => {
        if (err) {
            console.log(err);
        } else {
            server.route(require('./APIModules'));
            console.log('Server running at:', server.info.uri);
        }
    });
});