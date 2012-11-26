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
var EventConnection = require('manta-rabbit-node-lib');
var system = new EventConnection;

var rabbit = new EventConnection.Rabbit( { connection: { url: "amqp://localhost:5672//" } } );

var hostip = host;

rabbit.on('ready', function (rabbit) {
		console.log('rabbit ready called');
	var name = uuid.v4();
	var exchangename = 'exchange-'+name;
	var queuename = 'queue-'+name;
	rabbit.emit('Rabbit_Declare_Exchange',
		{ name: exchangename
		, type: 'direct'
		, passive: false
		, durable: false
		, autoDelete: true
		, auto_delete: true
		} );

	rabbit.on (queuename, function (message, headers, deliveryInfo, queue) {

		if (message.replayguid) {
			if (message.end == 'BEGIN') console.log("BOOKEND BEGINNING");
			if (message.end == 'END') console.log("BOOKEND END, ALL DONE");
			if (message.end == 'END') rabbit.allDone()
			return;
		}
		console.log(JSON.stringify(message, null, 2));
	} );

	var x = { "replayguid":name
			, "range":
				{ "start":process.argv[2]
				, "stop": process.argv[3]
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
		if (queuedef.name != queuename) return;
		else console.log('PRIMARY QUEUE READY');
		console.log("queue ready " + queuedef.name);
		rabbit.emit(exchangename, queuename, { message: "queue receiving good" } );
//		setInterval(function () { rabbit.emit(exchangename, queuename, { message: "queue delay send"} ); }, 10000 );

		var reqa = http.request({ method: 'PUT', host: hostip, port:port, path:pathbase+name }, function (resa) {
			var buf = '';
			resa.on('data', function (d) { buf = buf + d } );
			resa.on('end', function () {
//				console.log("have resa response to PUT http://"+hostip+":"+port+pathbase+name, resa.statusCode);
//				console.log("REQUEST A RESPONSE", buf);
				if (resa.statusCode == 200) return;
				if (resa.statusCode != 202) console.log("BAD RESPONSE ("+resa.statusCode+") FOR REPLAY:"+buf);
			} );
		} );
		var c = JSON.stringify(x);
		reqa.setHeader('Content-Length', c.length);
		reqa.setHeader('Content-Type', 'application/json');
		reqa.write(c);
		reqa.end();


	});



	rabbit.on ('exchangeReady', function (exchange, exchdef) {
		console.log("Exchange ready - " + exchdef.name);
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
	} );
} );
