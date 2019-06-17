"use strict";

Object.defineProperty(exports, "__esModule", {
	value: true
});

require('babel-polyfill');

var _mongoose = require('mongoose');

var _mongoose2 = _interopRequireDefault(_mongoose);

var _Candle = require('./Candle');

var _Candle2 = _interopRequireDefault(_Candle);

var _Depth = require('./Depth');

var _Depth2 = _interopRequireDefault(_Depth);

var _Trade = require('./Trade');

var _Trade2 = _interopRequireDefault(_Trade);

var _Config = require('./Config');

var _Config2 = _interopRequireDefault(_Config);

var _Observer = require('./Observer');

var _Observer2 = _interopRequireDefault(_Observer);

var _ccxt = require('ccxt');

var _ccxt2 = _interopRequireDefault(_ccxt);

var _extend = require('extend');

var _extend2 = _interopRequireDefault(_extend);

var _apiConnectors = require('../api-connectors/');

var _apiConnectors2 = _interopRequireDefault(_apiConnectors);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var redis = require("redis");
_mongoose2.default.set('useCreateIndex', true);
let defaultOptions = {
	polling: 20000,
	redis: {},
	timeframes: {},
	markets: ['XBTUSD'],
	verbose: true,
	history: "2018-04-01Z",
	subscribe: false,
	trade_history: 30000
};
let bitmexTimeFrames = {
	"m1": 1 * 60 * 1000,
	"m5": 5 * 60 * 1000,
	"h1": 60 * 60 * 1000,
	"d1": 24 * 60 * 60 * 1000
};
let sleep = ms => {
	return new Promise(resolve => setTimeout(resolve, ms));
};
async function createModels(ccxt, ccxt_markets, connection, frames, markets) {
	let result = {};
	for (let bitmexName of markets) {
		let ccxt_market = ccxt_markets.filter(m => {
			return m.id == bitmexName;
		});
		result[bitmexName] = {};
		for (let frame in frames) {
			let schema = (0, _Candle2.default)(ccxt, ccxt_market[0], frame, frames[frame]);
			let collection = bitmexName.toLowerCase() + "_" + frame;
			result[bitmexName][frame] = connection.model(collection, schema);
		}
	}
	return result;
}
async function suscribeCandles(config, options, debug, models, publishClient, socket) {
	let observers = [];
	for (let market in models) {
		let observer = new _Observer2.default(models[market], bitmexTimeFrames, config, options, publishClient, socket, debug);
		let start = await observer.load();
		if (!config.histories) {
			config.histories = {};
		}
		config.histories[market] = start;
		observer.subscribeRest();
		observers.push(observer);
		await sleep(8000);
	}
	await config.save();
	for (let observer of observers) {
		observer.subscribeSocket();
	}
}
function pubsub(models, options) {
	var redisClient = redis.createClient(options.redis);
	redisClient.on('error', function (e) {});
	let callbacks = {};
	for (let market in models) {
		for (let property in models[market]) {
			models[market][property].on = next => {
				let channel = models[market][property].channel;
				if (!callbacks[channel]) {
					callbacks[channel] = [];
				}
				callbacks[channel].push(next);
				redisClient.subscribe(channel);
			};
		}
	}
	redisClient.on("message", function (channel, d) {
		if (!callbacks[channel] || !callbacks[channel].length) {
			return;
		}
		d = JSON.parse(d);
		let match = channel.match(/^([^_]*)_([^_]*)$/);
		let market = match[1];
		let property = match[2];

		if (property == 'depth') {
			d.time = new Date(d.time);
			models[market].depth.update(d);
		} else if (property == 'trade') {
			models[market].trade.update(d);
		}
		for (let next of callbacks[channel]) {
			next(d, market, property);
		}
	});
	return models;
}

exports.default = async function (options) {
	console.log("connecting mongo");
	let connection = _mongoose2.default.createConnection(options.mongo, {
		useNewUrlParser: true
	});
	let configModel = connection.model("config", (0, _Config2.default)());
	if (options.subscribe) {
		options = (0, _extend2.default)({}, defaultOptions, options);
		let allTimeFrames = (0, _extend2.default)({}, options.timeframes, bitmexTimeFrames);
		await configModel.setup(allTimeFrames, options.history, options.markets);
	}
	let config = await configModel.load();
	let frames = config.timeframes;
	let debug = options.verbose ? console.info : () => {};
	let ccxt = new _ccxt2.default.bitmex();
	let ccxt_markets;
	debug("fetching market data");
	while (!ccxt_markets) {
		try {
			ccxt_markets = await ccxt.fetchMarkets();
		} catch (e) {
			debug(e);
		}
		await sleep(3000);
	}
	let models = await createModels(ccxt, ccxt_markets, connection, frames, config.markets);
	if (!options.subscribe) {
		for (let market in models) {
			models[market].depth = new _Depth2.default(market);
		}
		return pubsub(models, options);
	}
	let publishClient = redis.createClient(options.redis);
	publishClient.on('error', function (e) {});
	let socket = new _apiConnectors2.default({
		testnet: false,
		alwaysReconnect: true,
		maxTableLen: 10
	});
	socket.on('error', e => {});
	await suscribeCandles(config, options, debug, models, publishClient, socket);
	for (let market in models) {
		models[market].depth = new _Depth2.default(market);
		models[market].depth.socket(socket, publishClient);
		models[market].trade = new _Trade2.default(market, options.trade_history);
		models[market].trade.socket(socket, publishClient, ccxt);
	}
	models = pubsub(models, options);
	return models;
};