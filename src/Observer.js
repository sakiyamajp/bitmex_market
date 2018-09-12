"use strict";
import Converter from './Converter';
import Ccxt from 'ccxt';
var redis = require("redis");
let ccxt = new Ccxt.bitmex();
let sleep = (ms) => {
	return new Promise(resolve => setTimeout(resolve, ms));
}
export default class Observer{
	constructor(
			models,
			bitmexTimeFrames,
			config,
			options,
			publisher,
			socket,
			debug) {
		this.bitmexTimeFrames = bitmexTimeFrames;
		this.models = models;
		this.config = config;
		this.options = options;
		this.debug = debug;
		this.publisher = publisher;
		this.socket = socket;
		this.start = null;
		this.distinations = {};
		for(let localName in this.bitmexTimeFrames){
			let model = this.models[localName];
			let distination = [];
			for(let property in this.models){
				if(this.models[property].baseMs == model.span){
					distination.push(this.models[property]);
				}
			}
			this.distinations[localName] = distination;
		}
	}
	async load(){
		this.start = await this._detectStartDate();
		await this._checkLost();
		let promises = [];
		for(let localName in this.bitmexTimeFrames){
			let proimse = this._fetchHistorical(this.models[localName])
			promises.push(proimse);
		}
		await Promise.all(promises);
		for(let optional in this.config.timeframes){
			if(this.bitmexTimeFrames[optional]){
				continue;
			}
			await Converter(
				this.models,
				this.models[optional]);
		}
		for(let frame in this.models){
			this._triggerUpdate(this.models[frame]);
		}
		return this.start;
	}
	async _checkLost(){
		for(let timeframe in this.models){
			let model = this.models[timeframe];
			while(true){
				let result = await model.test();
				if(result !== false){
					break;
				}
				let error = await model.findError();
				if(error.lost){
					await model.fetch(error.time);
				}else if(error.duplicate){
					let duplicates = await model.find({
						time : error.time
					}).exec();
					duplicates.forEach(async (d,i) => {
						if(i == 0){
							return;
						}
						await d.remove();
					});
				}
				await sleep(3000);
			}
		}
	}
	async _detectStartDate(){
		let histories = this.config.detected_histories;
		let model = this.models.d1;
		if(histories && histories[model.market.id]){
			return histories[model.market.id];
		}
		return await this._detectHistoryDate(model);
	}
	async _detectHistoryDate(model){
		let since = this.config.history.getTime();
		let start;
		while(true){
			let data = await model.fetch(since);
			if(data.length){
				start = data[0].time;
				break;
			}
			await sleep(3000);
		}
		return start;
	}
	subscribeRest(){
		for(let localName in this.bitmexTimeFrames){
			let model = this.models[localName];
			this._polling(model,this.distinations[localName]);
		}
	}
	subscribeSocket(){
		for(let localName in this.bitmexTimeFrames){
			let model = this.models[localName];
			this._connectSocket(model,this.distinations[localName]);
		}
	}
	async _convertDistination(distination){
		for(let dist of distination){
			let created = await Converter(
					this.models,
					dist);
			if(created){
				this._triggerUpdate(dist);
			}
		}
	}
	async _connectSocket(model,distination){
		var tableNames = {
			'm1' : 'tradeBin1m',
			'm5' : 'tradeBin5m',
			'h1' : 'tradeBin1h',
			'd1' : 'tradeBin1d',
		};
		let tableName = tableNames[model.frame];
		console.info("connecting socket",tableName);
		this.socket.addStream(
			model.market.id,
			tableName,
			async (data, symbol, tableName) =>{
				if(!data.length){
					return;
				}
				data = data[data.length - 1];
				data = model.parseSocket(data);
				data = data.toObject();
				model.upsertIfNew(data,() => {
					this._triggerUpdate(model);
					this._convertDistination(distination);
				});
			});
	}
	async _needFetch(model){
		let now = new Date().getTime();
		// huge bitmex delay
		// https://stackoverflow.com/questions/31962539/duplicate-key-error-on-upsert-with-multi-processesmongo-3-0-4-wiredtiger
		now -= 20000;
		let mustHave = now - (now % model.span) - model.span;
		let last = await model.last();
		let test = await model.test();
		return !(test && last && last.time.getTime() == mustHave);
	}
	async _polling(model,distination){
		while(true){
			let needFetch = await this._needFetch(model);
			if(needFetch){
				let since = await this._getFailSafeLastTime(model);
				this.debug(`fetching ${model.summary()} from ${new Date(since)}`)
				try{
					await model.fetch(since,async (d) => {
						this._triggerUpdate(model);
						this._convertDistination(distination);
					});
				}catch(e){

				}
			}
			await sleep(this.options.polling);
		}
	}
	async _getFailSafeLastTime(model){
		let since = this.start.getTime();
		let last = await model.last();
		if(last){
			 let failSafe = last.time.getTime() - model.span*60;
			 if(since < failSafe){
				 since = failSafe;
			 }
		}
		return since;
	}
	_fetchHistorical(model){
		return new Promise(async resolve => {
			let needFetch = await this._needFetch(model);
			if(!needFetch){
				return resolve();
			}
			let since = await this._getFailSafeLastTime(model);
			while(true){
				this.debug(`fetching ${model.market.id} ${model.frame} from : ${new Date(since)}`);
				try{
					let data = await model.fetch(since);
					if(data.length < 499){
						this.debug(`got all ${model.market.id} ${model.frame} histories`)
						break;
					}
					since = data[data.length - 1].time.getTime() + model.span;
				}catch(e){
					this.debug(e);
				}
				await sleep(6000);
			}
			resolve();
		})
	}
	async _triggerUpdate(model){
		let data = await model.last();
		this.publisher.publish(model.channel,JSON.stringify(data));
	}
}
