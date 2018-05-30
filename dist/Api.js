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
	polling: 30000,
	redis: {},
	timeframes: {},
	markets: ['XBTUSD']
};
let bitmexTimeFrames = {
	"m1": 1 * 60 * 1000,
	"m5": 5 * 60 * 1000,
	"h1": 60 * 60 * 1000,
	"d1": 24 * 60 * 60 * 1000
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
	let config, frames;
	if (options.subscribe) {
		config = (0, _extend2.default)({}, defaultOptions, options);
		frames = (0, _extend2.default)({}, options.timeframes, bitmexTimeFrames);
		configModel.save(frames, options.history, options.markets);
	} else {
		config = await configModel.load();
		frames = config.timeframes;
	}
	let ccxt = new _ccxt2.default.bitmex();
	let ccxt_markets = await ccxt.fetchMarkets();
	let redisClient = redis.createClient(options.redis);
	let models = await createModels(ccxt, ccxt_markets, connection, frames, config.markets);
	if (options.subscribe) {
		let observer = new _Observer2.default(models[market], bitmexTimeFrames, config.timeframes, config.history, config.polling, redisClient);
		await observer.load();
		await sleep(20000);
	}
	let callbacks = {};
	for (let market in models) {
		for (let frame in config.timeframes) {
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
	return models;
};