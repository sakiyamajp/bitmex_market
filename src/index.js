"use strict";
import 'babel-polyfill';
import mongoose from 'mongoose';
import Candle from './Candle';
import Config from './Config';
import Observer from './Observer';
import Ccxt from 'ccxt';
import extend from 'extend';
var redis = require("redis");

let defaultOptions = {
	polling : 20000,
	redis : {},
	timeframes : {},
	markets : ['XBTUSD'],
	verbose : true,
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
		var config = extend({},defaultOptions,options);
		var frames = extend({},options.timeframes,bitmexTimeFrames);
		/*await*/ configModel.save(frames,options.history,options.markets);
	}else{
		var config = await configModel.load();
		var frames = config.timeframes;
	}
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
//		console.log(e);
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
		if(callbacks[channel] && callbacks[channel].length){
			for(let next of callbacks[channel]){
				let match = channel.match(/^([^_]*)_([^_]*)$/);
				next(JSON.parse(d),match[1],match[2]);
			}
		}
	});
	if(options.subscribe){
		let observers = [];
		let publishClient = redis.createClient(options.redis);
		publishClient.on('error', function(e){
//			console.log(e);
		});
		for(let market in models){
			let observer = new Observer(
					models[market],
					bitmexTimeFrames,
					config.timeframes,
					config.history,
					config.polling,
					config.verbose,
					publishClient);
			await observer.load();
			observers.push(observer);
			await sleep(8000);
		}
		for(let observer of observers){
			await observer.subscribe();
		}
	}
	return models;
}
