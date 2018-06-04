"use strict";

Object.defineProperty(exports, "__esModule", {
	value: true
});

require('babel-polyfill');

var _mongoose = require('mongoose');

var _mongoose2 = _interopRequireDefault(_mongoose);

var _Candle = require('./Candle');

var _Candle2 = _interopRequireDefault(_Candle);

var _Config = require('./Config');

var _Config2 = _interopRequireDefault(_Config);

var _Observer = require('./Observer');

var _Observer2 = _interopRequireDefault(_Observer);

var _ccxt = require('ccxt');

var _ccxt2 = _interopRequireDefault(_ccxt);

var _extend = require('extend');

var _extend2 = _interopRequireDefault(_extend);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var redis = require("redis");

let defaultOptions = {
	polling: 20000,
	redis: {},
	timeframes: {},
	markets: ['XBTUSD'],
	verbose: true,
	subscribe: false
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

exports.default = async function (options) {
	let connection = _mongoose2.default.createConnection(options.mongo);
	let configModel = connection.model("config", (0, _Config2.default)());
	if (options.subscribe) {
		var config = (0, _extend2.default)({}, defaultOptions, options);
		var frames = (0, _extend2.default)({}, options.timeframes, bitmexTimeFrames);
		/*await*/configModel.save(frames, options.history, options.markets);
	} else {
		var config = await configModel.load();
		var frames = config.timeframes;
	}
	let ccxt = new _ccxt2.default.bitmex();
	let ccxt_markets;
	while (!ccxt_markets) {
		try {
			ccxt_markets = await ccxt.fetchMarkets();
		} catch (e) {}
		await sleep(3000);
	}
	var redisClient = redis.createClient(options.redis);
	redisClient.on('error', function (e) {
		//		console.log(e);
	});
	let models = await createModels(ccxt, ccxt_markets, connection, frames, config.markets);
	let callbacks = {};
	for (let market in models) {
		for (let frame in frames) {
			models[market][frame].on = next => {
				let channel = models[market][frame].channel;
				if (!callbacks[channel]) {
					callbacks[channel] = [];
				}
				callbacks[channel].push(next);
				redisClient.subscribe(channel);
			};
		}
	}
	redisClient.on("message", function (channel, d) {
		if (callbacks[channel] && callbacks[channel].length) {
			for (let next of callbacks[channel]) {
				let match = channel.match(/^([^_]*)_([^_]*)$/);
				next(JSON.parse(d), match[1], match[2]);
			}
		}
	});
	if (options.subscribe) {
		let observers = [];
		let publishClient = redis.createClient(options.redis);
		publishClient.on('error', function (e) {
			//			console.log(e);
		});
		for (let market in models) {
			let observer = new _Observer2.default(models[market], bitmexTimeFrames, config.timeframes, config.history, config.polling, config.verbose, publishClient);
			await observer.load();
			observers.push(observer);
			await sleep(8000);
		}
		for (let observer of observers) {
			await observer.subscribe();
		}
	}
	return models;
};