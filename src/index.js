"use strict";
import 'babel-polyfill';
import mongoose from 'mongoose';
import Candle from './Candle';
import Depth from './Depth';
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
async function suscribeCandles(
		config,
		options,
		debug,
		models,
		publishClient,
		socket){
	let observers = [];
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
function pubsub(models,options){
	var redisClient = redis.createClient(options.redis);
	redisClient.on('error', function(e){
//		debug(e);
	});
	let callbacks = {};
	for(let market in models){
		for( let property in models[market]){
			models[market][property].on = (next) => {
				let channel = models[market][property].channel;
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
		d = JSON.parse(d);
		let match = channel.match(/^([^_]*)_([^_]*)$/);
		let market = match[1];
		let property = match[2];
		if(property == 'depth'){
			d.time = new Date(d.time);
			models[market].depth.update(d);
		}
		for(let next of callbacks[channel]){
			next(d,market,property);
		}
	});
	return models;
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
	let models = await createModels(
		ccxt,
		ccxt_markets,
		connection,
		frames,
		config.markets);
	for(let market in models){
		models[market].depth = new Depth(market);
	}
	if(!options.subscribe){
		return pubsub(models,options);
	}
	let publishClient = redis.createClient(options.redis);
	publishClient.on('error', function(e){
//			debug(e);
	});
	let socket = new BitMEXClient({
		testnet: false,
		alwaysReconnect : true,
	});
	socket.on('error', (e) => {});
//	await suscribeCandles(
//			config,
//			options,
//			debug,
//			models,
//			publishClient,
//			socket);
	for(let market in models){
		models[market].depth.socket(socket,publishClient);
	}
	models = pubsub(models,options);
	return models;
}
