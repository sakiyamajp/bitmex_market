"use strict";

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

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var redis = require("redis");
let sleep = ms => {
	return new Promise(resolve => setTimeout(resolve, ms));
};
let timeframes = {
	"m1": 1 * 60 * 1000,
	"m5": 5 * 60 * 1000,
	"h1": 60 * 60 * 1000,
	"d1": 24 * 60 * 60 * 1000
};
async function createResult(connection, frames, markets) {
	let ccxt = new _ccxt2.default.bitmex();
	let ccxt_markets = await ccxt.fetchMarkets();
	let result = {};
	for (let ccxtName in markets) {
		let ccxt_market = ccxt_markets.filter(m => {
			return m.id == markets[ccxtName];
		});
		let bitmexName = markets[ccxtName];
		result[bitmexName] = {};
		for (let frame in frames) {
			let schema = (0, _Candle2.default)(ccxt, ccxt_market[0], frame, frames[frame], ccxtName, bitmexName);
			let collection = bitmexName.toLowerCase() + "_" + frame;
			result[bitmexName][frame] = connection.model(collection, schema);
		}
	}
	return result;
}
module.exports = {
	server: async function (options) {
		let connection = _mongoose2.default.createConnection(options.mongo);
		let configModel = connection.model("config", (0, _Config2.default)());

		let frames = Object.assign({}, options.timeframes, timeframes);

		//		for(let frame in frames){
		//			connection.dropCollection("candle_" + frame, function(err, result) {
		//				console.log(err, result);
		//			});
		//		}
		//		return;

		configModel.save(frames, options.history, options.markets);
		let publisher = redis.createClient(options.redis);
		let result = await createResult(connection, frames, options.markets);
		let observers = [];
		for (let market in result) {
			let observer = new _Observer2.default(result[market], timeframes, options.timeframes, options.history, (market, frame, data) => {
				publisher.publish(`${market.bitmex}_${frame}`, data);
			});
			await observer.load();
			await sleep(20000);
			observers.push(observer);
		}

		return result;
	},
	client: async function (options) {
		let connection = _mongoose2.default.createConnection(options.mongo);
		let configModel = connection.model("config", (0, _Config2.default)());

		let config = await configModel.load();
		let frames = config.timeframes;
		let result = await createResult(connection, frames, config.markets);

		let subscriber = redis.createClient(options.redis);

		let callbacks = {};
		for (let market in result) {
			callbacks = {};
			subscriber.on("message", function (channel, d) {
				if (callbacks[channel]) {
					callbacks[channel](JSON.parse(d));
				}
			});
			for (let frame in frames) {
				result[market][frame].on = next => {
					let channel = `${market}_${frame}`;
					callbacks[channel] = next;
					subscriber.subscribe(channel);
				};
			}
		}
		return result;
	}
};