"use strict";
import 'babel-polyfill';
import mongoose from 'mongoose';
import Candle from './Candle';
import Config from './Config';
import Observer from './Observer';
import Ccxt from 'ccxt';
import extend from 'extend';
//https://github.com/ko0f/api-connectors.git
import BitMEXClient from '../api-connectors/';
var redis = require("redis");

let defaultOptions = {
	polling : 20000,
	redis : {},
	timeframes : {},
	markets : ['XBTUSD'],
	verbose : true,
	history : "2018-04-01Z",
	subscribe : false,
};
let bitmexTimeFrames = {
	"m1" : 1 * 60 * 1000,
	"m5" : 5 * 60 * 1000,
	"h1" : 60 * 60 * 1000,
	"d1" : 24 * 60 * 60 * 1000,
};
let sleep = (ms) => {
	return new Promise(resolve => setTimeout(resolve, ms));
}
async function createModels(
		ccxt,
		ccxt_markets,
		connection,
		frames,
		markets){
	let result = {};
	for(let bitmexName of markets){
		let ccxt_market = ccxt_markets.filter(m => {
			return m.id == bitmexName;
		});
		result[bitmexName] = {};
		for( let frame in frames){
			let schema = Candle(
					ccxt,
					ccxt_market[0],
					frame,
					frames[frame]);
			let collection = bitmexName.toLowerCase() + "_" + frame;
			result[bitmexName][frame] = connection.model(collection,schema);
		}
	}
	return result;
}
export default async function(options){
	let connection = mongoose.createConnection(options.mongo);
	let configModel = connection.model("config",Config());
	if(options.subscribe){
		options = extend({},defaultOptions,options);
		let  allTimeFrames = extend({},options.timeframes,bitmexTimeFrames);
		await configModel.save(allTimeFrames,options.history,options.markets);
	}
	let config = await configModel.load();
	let frames = config.timeframes;
	let debug = options.verbose ? console.info : () => {};
	let ccxt = new Ccxt.bitmex();
	let ccxt_markets;
	while(!ccxt_markets){
		try{
			ccxt_markets = await ccxt.fetchMarkets();
		}catch(e){

		}
		await sleep(3000);
	}
	var redisClient = redis.createClient(options.redis);
	redisClient.on('error', function(e){
//		debug(e);
	});
	let models = await createModels(
		ccxt,
		ccxt_markets,
		connection,
		frames,
		config.markets);
	let callbacks = {};
	for(let market in models){
		for( let frame in frames){
			models[market][frame].on = (next) => {
				let channel = models[market][frame].channel;
				if(!callbacks[channel]){
					callbacks[channel] = [];
				}
				callbacks[channel].push(next);
				redisClient.subscribe(channel);
			}
		}
	}
	redisClient.on("message", function(channel, d) {
		if(!callbacks[channel] || !callbacks[channel].length){
			return;
		}
		let match = channel.match(/^([^_]*)_([^_]*)$/);
		for(let next of callbacks[channel]){
			next(JSON.parse(d),match[1],match[2]);
		}
	});
	if(options.subscribe){
		let observers = [];
		let publishClient = redis.createClient(options.redis);
		publishClient.on('error', function(e){
//			debug(e);
		});
		let socket = new BitMEXClient({
			testnet: false,
			alwaysReconnect : true,
		});
		socket.on('error', (e) => {});
		for(let market in models){
			let observer = new Observer(
					models[market],
					bitmexTimeFrames,
					config,
					options,
					publishClient,
					socket,
					debug);
			let start = await observer.load();
			if(!config.histories){
				config.histories = {};
			}
			config.histories[market] = start;
			observer.subscribeRest();
			observers.push(observer);
			await sleep(8000);
		}
		await config.save();
		for(let observer of observers){
			observer.subscribeSocket();
		}
	}
	return models;
}
