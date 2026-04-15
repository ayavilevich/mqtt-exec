#!/usr/bin/env node

require('dotenv').config();

var mqtt = require('mqtt')
  , optimist = require('optimist')
  , util = require('util')
  , exec = require('child_process').exec
  , sleep = require('sleep')
  , url = require('url')
  , fs = require('fs')
  , log4js = require('log4js');

// configure logger
log4js.configure({
	appenders: {
		// file appender
		file: { type: 'file', filename: process.env.LOG_FILE_PATH},
		// std out appender
		out: { type: 'stdout' },
	},
	categories: { default: { appenders: (process.env.LOG_FILE_PATH ? ['file', 'out'] : ['out']), level: 'debug' } },
});
const logger = log4js.getLogger();

var argv = optimist
  .usage('mqtt-exec: receive shell commands on MQTT messages\n \
    Usage: mqtt-exec -h <broker-url>')
  .options('h', {
      describe: 'broker url'
    , default: 'mqtt://localhost:1883'
    , alias: 'broker-url'
  })
  .options('c', {
      describe: 'configFile'
    , default: __dirname + '/config.json'
    , alias: 'configFile'
  })
  .argv;

// Parse url
var mqtt_url = url.parse(process.env.MQTT_BROKER_URL || argv.h);
var auth = (mqtt_url.auth || ':').split(':');

//var configuration = JSON.parse(fs.readFileSync(__dirname+'/config.json').toString());
var configuration = {};
var topics = [];

//Loading config
if (argv.c || argv.configFile) {
    var configFile = argv.c || argv.configFile;
    logger.info("Reading configuration from %s", configFile);
    configuration = JSON.parse(fs.readFileSync(configFile).toString());
}
for(var key in configuration){
    var topic = key;
    topics.push(topic);
}

//Creating the MQTT Client
logger.info("Creating client for: " + mqtt_url.hostname);
var options = {
  port: mqtt_url.port,
  host: mqtt_url.hostname,
  username: auth[0],
  password: auth[1]
}
var mqttClient = mqtt.connect(options);

mqttClient.on('connect', function(connack) {
	logger.info('Connection:');
	logger.info(connack);
  logger.info("Subscribe to topics...: " + topics);
  mqttClient.subscribe(topics);
  // don't install on-message here or ot will be called once for each connection
});

// handle incoming messages
mqttClient.on('message', (topic, message) => {
    topic = topic.toString().replace(/"/g, "\\\"");
    var message = message.toString().replace(/"/g, "\\\"");   
    logger.info(topic);
    logger.info(message);
    if (configuration[topic] && configuration[topic][message]) {
      executeShellCommand(topic,message);
    } else {
      logger.error('Bad input');
    }
    // var topic_outgoing = topic.replace(/\/set/g,'/get');
    // logger.info("Reportig value back to topic: " + topic_outgoing);
    // mqttClient.publish(topic_outgoing,message,{retain: true});
});

// handle connection events
mqttClient.on('error', (error) => {
	logger.error('MQTT error', error);
});

mqttClient.on('reconnect', () => {
	logger.warn('MQTT reconnect');
});

mqttClient.on('disconnect', () => {
	logger.warn('MQTT disconnect');
});

mqttClient.on('offline', () => {
	logger.warn('MQTT offline');
});

mqttClient.on('close', () => {
	logger.warn('MQTT close');
});

mqttClient.on('end', () => {
	logger.warn('MQTT end');
});

function executeShellCommand(topic,payload){
    var commands = configuration[topic];
    var command = commands[payload];
    logger.info("Executing command: " + command + " for topic: " + topic + " and payload: " + payload);
    exec(command, puts);
    sleep.sleep(1);//sleep for 1 seconds
}

function puts(error, stdout, stderr) { 
        logger.info(stdout); 
        logger.info("Executing Done");
}
