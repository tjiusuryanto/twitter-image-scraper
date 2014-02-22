/********** Libraries **********/
var request = require('request');
var cron = require('cron').CronJob;
var cheerio = require('cheerio');
var async = require('async');
var moment = require('moment');
var redis = require('redis');
var fs = require('fs');
/*******************************/

/********** Redis configuration **********/
var redisClient = redis.createClient();
redisClient.setMaxListeners(0);
redisClient.select(9);
/*****************************************/

/********** Constants & Variables **********/
var imageUrlTimeout = 3600;

// Picture tweets from channels below will be downloaded
var usernames = ['TMCPoldaMetro', 'RadioElshinta', 'lewatmana', 'tvOneNews', 'detikcom', 'Metro_TV'];
/*******************************************/

var job = new cron({
	// Change how often you want to scrap for images. The default is 3 minutes
  cronTime: '0 */3 * * * *',
  onTick: function() {
		console.log('\n######################################################################');
		console.log('Download images started at ' + new Date());
		console.log('######################################################################');
	  	
  	// Each username to scrap
		async.eachSeries(usernames,
		  function (currUsername, callback) {
		  	// Get the Twitter profile page
		  	var profileUrl = 'https://twitter.com/' + currUsername;
				request.get(profileUrl, function (error, response, body) {
				  if(!error && body) {
				    var $ = cheerio.load(body);

	          // Each timeline link
				    async.eachSeries($('.twitter-timeline-link'),
						  function (currTimeline, callback) {
						  	var imageUrl = $(currTimeline).attr('data-resolved-url-large');
						  	if(imageUrl) {
						  		async.series([
						  			// Check images dir, if doesn't exist, create
						  			function (callback) {
									    fs.exists('./images', function (exists) {
										    if(exists) {
										    	callback(null);
										    }
										    else {
										      fs.mkdir('./images', function() {
										      	callback(null);
										      });
										    }
										  });
									  },

						  			// Check images/username dir, if doesn't exist create
									  function (callback) {
									    fs.exists('./images/' + currUsername, function (exists) {
										    if(exists) {
										    	callback(null);
										    }
										    else {
										      fs.mkdir('./images/' + currUsername, function() {
										      	callback(null);
										      });
										    }
										  });
									  },

						  			// Check if imageUrl exists on redis
						  			function (callback) {
											redisClient.multi()
												  .get(imageUrl, function (err, result) {})
												  .expire(imageUrl, imageUrlTimeout)
												  .exec(function (err, replies) {
											  if(replies[0]) {
											    // Image already downloaded. Skip next steps, go to next timeline item
											    callback(1);
											  }
											  else {
											  	// Next step
											  	callback(null);
											  }
											});
									  },

									  // Get the file
									  function (callback) {
									  	var now = moment();
									  	var fileName = './images/' + currUsername + '/' + now.unix() + imageUrl.split('/').pop().split(':')[0];
									  	request(imageUrl, function (error, response, body) {
											  if (!error && response.statusCode == 200) {
											  	console.log('Downloaded new image to ' + fileName);

											  	// Save image url into Redis so it won't be redownloaded next time
											    redisClient.multi()
														  .set(imageUrl, 1, function (err, result) {})
														  .expire(imageUrl, imageUrlTimeout)
														  .exec(function (err, replies) {
													  callback(null);
													});
											  }
											  else {
											  	// If download fails skips all, delete partially downloaded file, and go to next timeline item
											  	fs.unlink(fileName, function (err) {
													  callback(1);
													});
											  }
											}).pipe(fs.createWriteStream(fileName));
									  }
									],
									function (err, results) {
										// Next timeline item
									  callback(null);
									});
						  	}
						  	else {
						  		// Next timeline it
						  		callback(null);
						  	}
						  },
						function (err) {
							// Next username
						  callback(null);
						});
				  }
				  else {
				  	// Next username
				  	callback(null);
				  }
				});
		  },
		function (err) {
		  console.log('######################################################################');
			console.log('Download images ended at ' + new Date());
			console.log('######################################################################');
		});
  },
  start: true
});



		

		

