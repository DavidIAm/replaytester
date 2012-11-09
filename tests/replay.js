var host = "manta-events-replay.elasticbeanstalk.com";
var port = 80;
var pathbase = "/rest/replay/";
var remoteRabbit = "svc-proxy-dev.aws.ecnext.net";
var remoteRabbitPort = 5672;
var statusList = "/rest/replay/replaylist"

var cancel = true;

//var host = "192.168.240.132";
//var port = 8084;
//var pathbase = "/MantaEventsReplay/rest/replay/"
//var remoteRabbit = "ecnext74.ecnext.com";
//var remoteRabbitPort = 5672;
//var statusList = "/MantaEventsReplay/rest/replay/replaylist"

var util = require('util');
var http = require('http');
var dns = require('dns');
var uuid = require('node-uuid');
var EventConnection = require('event-relay/node_modules/manta-rabbit-node-lib');
var system = new EventConnection;

var rabbit = new EventConnection.Rabbit( { connection: { url: "amqp://localhost:5672//" } } );

var hostip = host;

rabbit.on('ready', function (rabbit) {
		console.log('rabbit ready called');
	var name = uuid.v4();
	var secondname = uuid.v4();
	var exchangename = 'exchange-'+name;
	var queuename = 'queue-'+name;
	var secondqueuename = 'queue-'+secondname;
	rabbit.emit('Rabbit_Declare_Exchange',
		{ name: exchangename
		, type: 'direct'
		, passive: false
		, durable: false
		, autoDelete: true
		, auto_delete: true
		} );

			setInterval( function () {
				var reqb = http.request({ method: 'GET', host: hostip, port:port, path:statusList }, function (resb) {
					var body = '';
					resb.on('data', function (d) { body = body + d });
					resb.on('end', function (d) { 
						try {
						var statuses = JSON.parse(body);
						statuses.forEach(function (state) {
							console.log("REQUEST " + state.replayguid + " STOPCOUNT " + stopcounter + " NOSTOP " + nostopcounter + " STATE " + state.status);
						} );
						} catch (e) {
							console.log("ERROR WITH BODY", body);
						}
						console.log("---\n");
					});
				} );
				reqb.end();
			}, 1000);

	var nostopcounter = 0;
	rabbit.on (secondqueuename, function (message, headers, deliveryInfo, queue) {
			if (message.eventType) {
				nostopcounter = nostopcounter + 1;
			} else if (message.replayguid) {
				console.log("SECONDARY BOOKEND", message, nostopcounter);
			}
	} );
	var stopcounter = 0;
	rabbit.on (queuename, function (message, headers, deliveryInfo, queue) {

		if (message.eventType) stopcounter = stopcounter + 1;
		else if (message.replayguid) console.log("PRIMARY BOOKEND", message, stopcounter);
		if (message.eventType == 'ClaimActivity') {
			console.log("\n\nREQUESTING DELETE AT "+stopcounter +"\n\n");
				var reqc = http.request({ method: 'DELETE', host: hostip, port:port, path:pathbase+name }, function (resc) {
					console.log("have resc", resc.statusCode);
					var body = '';
					resc.on('data', function (d) { body = body + d });
					resc.on('end', function (d) { 
						var del = JSON.parse(body);
						console.log("DELETE", reqc.statusCode, del.status);
					});
				} );
				reqc.end();
		}
	} );

	var x = { "replayguid":name
			, "range":
				{ "start":1351515600000000
				, "stop":1351537200000000
				}
			, pageSize: 1000
			, eventDelay: 0
			, pageDelay: 10000
			, "exchange":
				{ "hostname":remoteRabbit
				, "port":remoteRabbitPort
				, "virtualHost":"/"
				, "name":exchangename
				, "type":"direct"
				, "passive":false
				, "durable":false
				, "auto_delete":true
				, "internal":false
				}
			, "key":queuename
			};
	rabbit.on ('queueReady', function (queue, queuedef) {
			if (queuedef.name != secondqueuename) return;
			else console.log('SECONDARY QUEUE READY');
		var z = JSON.parse(JSON.stringify(x));
		z.replayguid = secondname;
		z.key = secondqueuename;
		var zs = JSON.stringify(z);
		var reqg = http.request({ method: 'PUT', host: hostip, port:port, path:pathbase+secondname }, function (resg) { 
				var buf = '';
			resg.on('data', function (d) { buf = buf + d } );
			resg.on('end', function () {
				console.log("REQUEST G RESPONSE", buf);
				});
				} );
		reqg.setHeader('Content-Length', zs.length);
		reqg.setHeader('Content-Type', 'application/json');
		reqg.write(zs);
		reqg.end();
	} );

	rabbit.on ('queueReady', function (queue, queuedef) {
		if (queuedef.name != queuename) return;
		else console.log('PRIMARY QUEUE READY');
		console.log("queue ready " + queuedef.name);
		rabbit.emit(exchangename, queuename, { message: "queue receiving good" } );
		setInterval(function () { rabbit.emit(exchangename, queuename, { message: "queue delay send"} ); }, 10000 );

		var reqa = http.request({ method: 'PUT', host: hostip, port:port, path:pathbase+name }, function (resa) {
			var buf = '';
			if (resa.statusCode != 202) rabbit.emit('letThemFly');
			resa.on('data', function (d) { buf = buf + d } );
			resa.on('end', function () {
				console.log("have resa response to PUT http://"+hostip+":"+port+pathbase+name, resa.statusCode);
				console.log("REQUEST A RESPONSE", buf);
				if (resa.statusCode != 202) console.log("BAD RESPONSE FOR REPLAY:"+buf);
			} );
		} );
		var c = JSON.stringify(x);
		reqa.setHeader('Content-Length', c.length);
		reqa.setHeader('Content-Type', 'application/json');
		reqa.write(c);
		reqa.end();


		rabbit.on('letThemFly', function () {
			x.key = "axe";
			var y = JSON.stringify(x);
			var reqe = http.request({ method: 'PUT', host: hostip, port:port, path:pathbase+name }, function (rese) { 
					var buf = '';
				rese.on('data', function (d) { buf = buf + d } );
				rese.on('end', function () {
					console.log("REQUEST E RESPONSE", buf);
					});
					} );
			reqe.setHeader('Content-Length', y.length);
			reqe.setHeader('Content-Type', 'application/json');
			reqe.write(y);
			reqe.end();
			x.key = "hatchet";
			var z = JSON.stringify(x);
			var reqf = http.request({ method: 'PUT', host: hostip, port:port, path:pathbase+name }, function (resf) { 
					var buf = '';
				resf.on('data', function (d) { buf = buf + d } );
				resf.on('end', function () {
					console.log("REQUEST F RESPONSE", buf);
					});
				} );
			reqf.setHeader('Content-Length', z.length);
			reqf.setHeader('Content-Type', 'application/json');
			reqf.write(z);
			reqf.end();
		} );
	});



	rabbit.on ('exchangeReady', function (exchange, exchdef) {
		console.log("Exchange ready - " + exchdef.name);
if (cancel) {
		rabbit.emit('Rabbit_Declare_Queue',
			{ "name": queuename
			, "bindings":
				[ { "routingKey": queuename
					, "exchange": exchangename
					}
				]
			, "passive": false
			, "durable": false
			, "exclusive": false
			, "autoDelete": true
			, "noDeclare": false
			, "arguments": { }
			, "closeChannelOnUnsubscribe": false
			, "subscribeOptions":
				{ "ack": false
				, "prefetchCount": 1
				}
			} );
}
		console.log('exchange ready called ', exchdef);
		rabbit.emit('Rabbit_Declare_Queue',
			{ "name": secondqueuename
			, "bindings":
				[ { "routingKey": secondqueuename
					, "exchange": exchangename
					}
				]
			, "passive": false
			, "durable": false
			, "exclusive": false
			, "autoDelete": true
			, "noDeclare": false
			, "arguments": { }
			, "closeChannelOnUnsubscribe": true
			, "subscribeOptions":
				{ "ack": false
				, "prefetchCount": 1
				}
			} );
	} );
} );
