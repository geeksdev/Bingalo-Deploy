


module.exports = function (app ,express){
	var Router = express.Router();
	Router.post('/checkNotification', function (req, res) {
		var FCM = require('fcm').FCM;

		// var apiKey = 'AIzaSyAMFNvJVdE41wrjbEnNpTyQKpefLWefTIE';
		// var fcm = new FCM(apiKey);

		var chethanApiKey = 'AIzaSyDvzvNeMzeLWkae18lWpt-mzwXFTF1iT7k';
		var fcm = new FCM(chethanApiKey);
		// var message = {
		//     registration_id: 'e8aQ7kaYqC0:APA91bEdRh2_dyE3PNtkEkTiEP20mQa7MBX-aimXoaHHZAu0JbIxkgXoEbdSs2g6IMKRA9RkJgvPmUrLTp5tVUqEwBfPSVlu7wtuOJJm3TzE--uwuyHlWhUaOigtTEWLuvqWkBd1CFqg', // required
		//     collapse_key: 'TEST', 
		//     'data.key1': 'value1',
		//     'data.key2': 'value2'
		// };

		var message = {
		    registration_id: 'coqwIHDulnw:APA91bH6L4e8mCyK1aTqgVhlUs6c7TTq2P8JBqaB4z_4VdTjyW6z6SADUZtykFKkw3cqXjuZzdtOytOhvi4kTt35GT9RPsXuUjNFa9sDi68vQ4kcwg-b7FxjAso3QGPPjQ0q-vleoWBw', // required
		    collapse_key: 'PICOGRAM', 
		    'data.key1': 'THIS IS SOME SHIT',
		    'data.key2': 'THIS IS ANOTHER SHIT',
		    data : {
		    	"body": "great match!",
		    	"title": "hybrid cars",
		    	"icon": "devel 16",
		    	"url": "http://db.carbuzz.com/images2/320000/5000/300/325325.jpg"
		    }
		};



		fcm.send(message, function(err, data)
		{
			if (err) {
				return res.send("Something has gone wrong!");

			} else {

				res.send(data);
			}
		});


	});

	Router.get('/sendPush', function (req, res){
		var FCM = require('fcm-node');
		var serverKey = 'AIzaSyDvzvNeMzeLWkae18lWpt-mzwXFTF1iT7k';
		var fcm = new FCM(serverKey);

				var message = { //this may vary according to the message type (single recipient, multicast, topic, et cetera)
					to: 'coqwIHDulnw:APA91bH6L4e8mCyK1aTqgVhlUs6c7TTq2P8JBqaB4z_4VdTjyW6z6SADUZtykFKkw3cqXjuZzdtOytOhvi4kTt35GT9RPsXuUjNFa9sDi68vQ4kcwg-b7FxjAso3QGPPjQ0q-vleoWBw', 
					collapse_key: 'your_collapse_key',

					// notification: {
					// 	title: 'DEVEL 16', 
					// 	body: 'Hybrid car' 
					// },

				    data: {  //you can send only notification or only data(or include both)
				    	url: 'http://db.carbuzz.com/images2/320000/5000/300/325325.jpg',
				    	body : 'devel 16',
				    	title : 'PICOGRAM',
				    	icon : 'ic_launcher'
				    }
				};

				fcm.send(message, function(err, response){
					if (err) {
						return res.send("Something has gone wrong!");
					} else {
						res.send("Successfully sent with response: ", response);
					}
				});
			});
	return Router;
}
