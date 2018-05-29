"use strict";
import Converter from './Converter';
import Ccxt from 'ccxt';
// https://github.com/ko0f/api-connectors.git
import BitMEXClient from '../api-connectors/';
var redis = require("redis");
let ccxt = new Ccxt.bitmex();
let sleep = (ms) => {
	return new Promise(resolve => setTimeout(resolve, ms));
}
export default class Observer{
	constructor(
			candles,
			frames,
			optional_frames,
			history_start,
			onUpdate) {
		this.frames = frames;
		this.candles = candles;
		this.history_start = history_start;
		this.optional_frames = optional_frames;
		this.onUpdate = onUpdate;
		this.socket = new BitMEXClient({
			testnet: false,
			alwaysReconnect : true,
		});
		this.socket.on('error', (e) => {});
	}
	async load(){
		let promises = [];
		for(let localName in this.frames){
			let proimse = this._loadHistorical(
					this.candles[localName],
					this.history_start)
			promises.push(proimse);
		}
		await Promise.all(promises);
		for(let optional in this.optional_frames){
			await Converter(
				this.candles,
				this.candles[optional]);
		}
		for(let frame in this.candles){
			this._triggerUpdate(this.candles[frame]);
		}
		for(let localName in this.frames){
			let candle = this.candles[localName];
			let distination = [];
			for(let property in this.candles){
				if(this.candles[property].baseMs == candle.span){
					distination.push(this.candles[property]);
				}
			}
			this._polling(candle,this.history_start,distination);
			this._connectSocket(candle,distination);
		}
	}
	async _convertDistination(distination){
		for(let dist of distination){
			let created = await Converter(
					this.candles,
					dist);
			if(created){
				this._triggerUpdate(dist);
			}
		}
	}
	async _connectSocket(candle,distination){
		var tableNames = {
			'm1' : 'tradeBin1m',
			'm5' : 'tradeBin5m',
			'h1' : 'tradeBin1h',
			'd1' : 'tradeBin1d',
		};
		let tableName = tableNames[candle.frame];
		this.socket.addStream(
			candle.market.bitmex,
			tableName,
			async (data, symbol, tableName) =>{
				if(!data.length){
					return;
				}
				data = data[data.length - 1];
				data = candle.parseSocket(data);
				data = data.toObject();
				candle.upsertIfNew(data,() => {
					this._triggerUpdate(candle);
					this._convertDistination(distination);
				});
			});
	}
	async _polling(candle,history_start,distination){
		while(true){
			let since = await this._getLastTime(candle,history_start);
			try{
				await candle.fetch(since,async (d) => {
					this._triggerUpdate(candle);
					this._convertDistination(distination);
				});
			}catch(e){

			}
			await sleep(30000);
		}
	}
	async _getLastTime(model,history_start){
		let since = new Date(history_start).getTime();
		let last = await model.last();
		if(last){
			since = last.time.getTime() - model.span*300;
		}
		return since;
	}
	_loadHistorical(model,history_start){
		return new Promise(async resolve => {
			let since = await this._getLastTime(model,history_start);
			while(true){
				console.log(`getting historical ${model.market.bitmex}${model.frame} data from timestamp : ${new Date(since)}`);
				let data = await model.fetch(since);
				if(data.length < 499){
					console.log(`got all ${model.market.bitmex}${model.frame} histories`)
					break;
				}
				since = data[data.length - 1].time.getTime() + model.span;
				await sleep(10000);
			}
			resolve();
		})
	}
	async _triggerUpdate(candle){
		this._test(candle);
		let data = await candle.last();
		this.onUpdate(
			candle.market,
			candle.frame,
			JSON.stringify(data));
	}
	async _test(candle){
		let first = await candle.first();
		let last = await candle.last();
		if(!first || !last){
			return;
		}
		let count = last.time.getTime() - first.time.getTime();
		count /= candle.span;
		count++;
		candle.count({},(e,d)=>{
			if(d != count){
				console.log(candle.market.ccxt,candle.frame,"check NG lost",d-count,"candles")
			}
		})
	}
}
