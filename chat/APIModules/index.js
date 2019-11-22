
/** 
 * Profile APIs 
 */
// var Login = require('./Login/Login.js');
var UpdateProfile = require('./Profile/UpdateProfile.js');
var Profile = require('./Profile/profile.js');
const DeleteProfile = require('./Profile/DeleteProfile')
// var GetProfile = require('./Profile/GetProfile.js');

/** 
 * Message APIs 
 */
var GetChat = require('./Messages/GetChat.js');
var DeleteChat = require('./Messages/DeleteChat.js');

var GetMessages = require('./Messages/GetMessages.js');
var PostMessages = require('./Messages/PostMessage.js');
// var DeleteMessages = require('./Messages/DeleteMessges.js');

var ProfileLogin = require('./Login/UserLogin.js');

var CreateProduct = require('./Product/AddProduct.js');
var UpdateProduct = require('./Product/UpdateProduct.js');
var DeleteProduct = require('./Product/DeleteProduct.js');

/**
 * User List APIs
 */
const FCDDemo = require('./FCMDemo.js')
// var GetUsers = require('./User/userList.js');

module.exports = [].concat(FCDDemo, UpdateProfile, DeleteProfile, GetChat, DeleteChat, GetMessages, PostMessages, ProfileLogin, CreateProduct, UpdateProduct, DeleteProduct, Profile);