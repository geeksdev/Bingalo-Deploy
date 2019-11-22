var express = require('express');
var path = require('path');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var config = require('./config');
var cors = require('cors');
var app = express();
app.use(cors());
let expressValidator = require('express-validator');
let cluster = require('cluster');
var RateLimit = require('express-rate-limit');
var cron = require('node-cron');
var postExpire = require('./routes/PromotionServices.js');



app.enable('trust proxy'); // only if you're behind a reverse proxy (Heroku, Bluemix, AWS if you use an ELB, custom Nginx setup, etc) 

var limiter = new RateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes 
    max: 500, // limit each IP to 100 requests per windowMs 
    delayMs: 0 // disable delaying - full speed until the max limit is reached 
});
var helmet = require('helmet')



//  apply to all requests 
app.use(limiter);
app.use(helmet());

socketGlobal = {};
// db = {};
app.use(logger('dev'));
app.use(bodyParser.json({
    limit: '5mb'
}));
// app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
    extended: false
}));

app.use(expressValidator()); // this line must be immediately after any of the bodyParser middlewares! 

// neo4j connection
var node_neo4j = require('node-neo4j');
var neo4j = require('neo4j');

app.use(function (req, res, next) {
    /** 
     * req.headers.authorization this is for postman
     */
    //console.log('basic auth: ' + JSON.stringify(req.headers))
    // console.log(req.ip);
    // console.log('country-info', JSON.stringify(req.location.country.data));
    if (!req.headers.authorization) {
        console.log('no auth');
        return res.status(401).json({
            code: 401,
            message: 'Unauthorized'
        });
    } else {
        // console.log(req.headers.authorization);
        var auth = 'Basic ' + new Buffer(config.authKey + ":" + config.authPassword).toString('base64');
        // if(req.body.bodyAuth !== config.authPassword){

        // }     
        // console.log(auth);
        if (req.headers.authorization.toString() === auth) {
            // console.log('authorisation success');
            console.log(req.body);
            fs.appendFile('iplog.txt', req.ip + ' \n', function (err) {
                if (err) {
                    console.error(err);
                }
            });
            next();
        } else {
            console.log('Unauthorized');
            return res.status(401).json({
                code: 401,
                message: 'Unauthorized'
            });
        }
    }
});

try {
    // neo4j driver connection object
    dbneo4j = new neo4j.GraphDatabase(config.database);
    // node-neo4j driver connection object
    db = new node_neo4j(config.database);
    db.readNode(0, function (err, node) {
        if (err) {
            console.log(err);
        }
        console.log('connected to neo4jdb');
    });
} catch (err) {
    console.log("Database Connection Error: " + err);
}


var MongoClient = require('mongodb').MongoClient;
MongoClient.connect(config.databaseMongoDb, function (err, db) {
    if (err) {
        console.error(err);
        throw err;
    } else {
        console.log('MongoDb Connected');
        mongoDb = db;
    }
    //  db.close();
});

if (cluster.isMaster) {
    // count of total processor in cpu


    var processorCount = require("os").cpus().length;
    var numReqs = 0;

    for (var countOfProcessor = 0; countOfProcessor < processorCount; countOfProcessor++) {
        var worker = cluster.fork();
        worker.on('message', function (msg) {
            if (msg.cmd && msg.cmd == 'notifyRequest') {
                numReqs++;
            }
        });
    }
    cron.schedule('0 */59 * * * *', function () {
        console.log('running a task every 1 Hours');

        postExpire.checkPromotePostExpire((err, data) => {
            console.log("err------------", err);
            console.log("data------------", data);
        })

    });

    cluster.on('death', function (worker) {
        console.log('worker ' + worker.pid + ' died');
    });

    cluster.on('disconnect', (worker) => {
        console.log(`The worker #${worker.id} has disconnected`);
    });

    cluster.on('exit', (worker) => {
        console.log(`The worker #${worker.id} has exit`);
        cluster.fork();
        console.log(`The worker #${worker.id} has been started again`);
    });
} else {
    var publicPath = __dirname + '/public/views';
    var rootPath = __dirname;


    /**
     * test socket
     */
    app.get('/', function (req, res) {
        res.sendFile(__dirname + '/index.html');
    });

    app.get('/api/fileUpload', (req, res) => {
        res.sendFile(__dirname + '/fileUpload.html');
    });

    var fs = require('fs');
    var multer = require('multer');
    var moment = require('moment');
    var storage = multer.diskStorage({
        destination: function (request, file, callback) {
            callback(null, './');
        },
        filename: function (request, file, callback) {
            console.log(file);
            var name = moment().valueOf() + '_' + file.originalname;
            callback(null, name)
        }
    });

    // Function to upload project images
    var upload = multer({
        storage: storage
    }).any('uploadedImages');


    app.post('/api/fileUpload', (req, res) => {
        console.log(req.files);
        upload(req, res, function (err) {
            if (err) {
                console.log(err);
                return;
            }
            res.end('Your files uploaded. Fuck yeah!!');
            console.log('Yep yep!');
        });
    });

    var FcmController = require('./routes/FirebaseController')(app, express);
    app.use('/api', FcmController);

    var CloudinarySignature = require('./routes/CloudinarySignature')(app, express);
    app.use('/api', CloudinarySignature);

    var ShareUrlController = require('./routes/ShareUrlController')(app, express);
    app.use('/api', ShareUrlController);

    var SearchProductController = require('./routes/BusinessModule/SearchProductController')(app, express);
    app.use('/api', SearchProductController);

    var GuestController = require('./routes/GuestController')(app, express);
    app.use('/api', GuestController);

    var AuthController = require('./routes/Authentication/AuthController');
    app.use('/api', AuthController);

    var HomeController = require('./routes/HomeController')(app, express);
    app.use('/api', HomeController);

    var HashtagController = require('./routes/HashtagController')(app, express);
    app.use('/api', HashtagController);

    var ContactsController = require('./routes/ContactsController')(app, express);
    app.use('/api', ContactsController);

    var ProfileController = require('./routes/ProfileController')(app, express);
    app.use('/api', ProfileController);

    var PostsController = require('./routes/PostsController');
    app.use('/api', PostsController);

    var FollowController = require('./routes/FollowController');
    app.use('/api', FollowController);

    var CommentsController = require('./routes/CommentsController')(app, express);
    app.use('/api', CommentsController);

    var LikesController = require('./routes/LikesController')(app, express);
    app.use('/api', LikesController);

    var LocationController = require('./routes/LocationController')(app, express);
    app.use('/api', LocationController);

    var SearchController = require('./routes/SearchController')(app, express);
    app.use('/api', SearchController);

    var ActivityController = require('./routes/ActivityController')(app, express);
    app.use('/api', ActivityController);

    var ImpressionsController = require('./routes/ImpressionsController')(app, express);
    app.use('/api', ImpressionsController);

    var AdminRoutes = require('./routes/Admin/AdminRoutes');
    app.use('/api', AdminRoutes);

    var AdminController = require('./routes/Admin/AdminController')(app, express);
    app.use('/api', AdminController);

    var BusinessController = require('./routes/BusinessModule/BusinessController')(app, express);
    app.use('/api', BusinessController);

    var FileUpload = require('./routes/fileUpload')(app, express);
    app.use('/api', FileUpload);

    var ProductsController = require('./routes/BusinessModule/ProductsController')(app, express);
    app.use('/api', ProductsController);

    var ReportProblemController = require('./routes/ReportProblemController')(app, express);
    app.use('/api', ReportProblemController);

    var CurrencyController = require('./routes/BusinessModule/CurrencyController')(app, express);
    app.use('/api', CurrencyController);

    var CategoryController = require('./routes/Admin/CategoryController')(app, express);
    app.use('/api', CategoryController);

    var DeleteCommentController = require('./routes/DeleteCommentController')(app, express);
    app.use('/api', DeleteCommentController);

    var BusinessCategoryController = require('./routes/BusinessModule/BusinessCategoryController')(app, express);
    app.use('/api', BusinessCategoryController);

    var ChatController = require('./routes/ChatController')(app, express);
    app.use('/api', ChatController);

    var ReportUserController = require('./routes/ReportUserController')(app, express);
    app.use('/api', ReportUserController);

    var OfferController = require('./routes/OfferController')(app, express);
    app.use('/api', OfferController);

    var FavouritesController = require('./routes/FavouritesController')(app, express);
    app.use('/api', FavouritesController);

    var BlockUserController = require('./routes/BlockUserController')(app, express);
    app.use('/api', BlockUserController);

    var AdminPostsController = require('./routes/Admin/AdminPostsController')(app, express);
    app.use('/api', AdminPostsController);

    var AdminFollowController = require('./routes/Admin/AdminFollowController')(app, express);
    app.use('/api', AdminFollowController);

    var ConfigController = require('./routes/Admin/ConfigController')(app, express);
    app.use('/api', ConfigController);

    var PromotionPlansController = require('./routes/Admin/PromotionPlansController')(app, express);
    app.use('/api', PromotionPlansController);

    var PromotionsController = require('./routes/PromotionsController')(app, express);
    app.use('/api', PromotionsController);

    var AdminPushController = require('./routes/Admin/AdminPushController')(app, express);
    app.use('/api', AdminPushController);

    var AppConfigController = require('./routes/AppConfigController')(app, express);
    app.use('/api', AppConfigController);

    var DashboardController = require('./routes/Admin/DashboardController')(app, express);
    app.use('/api', DashboardController);

    var WebsiteProfileController = require('./routes/WebsiteProfileController')(app, express);
    app.use('/api', WebsiteProfileController);

    var SocialMediaController = require('./routes/SocialMediaController')(app, express);
    app.use('/api', SocialMediaController);

    var CurrencyCronJob = require('./routes/CurrencyServices');

    var CampaignController = require('./routes/Admin/CampaignController')(app, express);
    app.use('/api', CampaignController);

    var AnalyticsController = require('./routes/AnalyticsController')(app, express);
    app.use('/api', AnalyticsController);

    const AccessController = require('./routes/Admin/AccessController')(app, express);
    app.use('/api', AccessController);

    const SEOController = require('./routes/Admin/SEOController')(app, express);
    app.use('/api', SEOController);

    const AdminWalletController = require('./routes/Admin/AdminWalletController')(app, express);
    app.use('/api', AdminWalletController);


    var http = require('http');
    var server = http.createServer(app);

    var io = require('socket.io')(server);
    socketGlobal = io;
    console.log(process.argv);
    server.listen(process.argv[2], function (err) {
        if (err) {
            console.log(err);
        } else {
            console.log('App listening on port: ' + process.argv[2]);
        }
    });

    // catch 404 and forward to error handler
    app.use(function (req, res, next) {
        //  var err = new Error('Not Found');
        var err = {};
        err.status = 404;
        err.message = "Not Found";
        next(err);
    });

    // error handlers

    // development error handler
    // will print stacktrace
    if (app.get('env') === 'development') {
        app.use(function (err, req, res, next) {
            return res.json(err).status(err.status);
        });
    }

    // production error handler
    // no stacktraces leaked to user
    app.use(function (err, req, res, next) {
        return res.status(err.status || 500)
            .json('error', {
                message: err.message,
                error: {}
            });
    });

}