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
			models,
			frames,
			optional_frames,
			history_start,
			polling,
			publisher) {
		this.frames = frames;
		this.models = models;
		this.polling = polling;
		this.publisher = publisher;
		this.history_start = history_start;
		this.optional_frames = optional_frames;
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
					this.models[localName],
					this.history_start)
			promises.push(proimse);
		}
		await Promise.all(promises);
		for(let optional in this.optional_frames){
			await Converter(
				this.models,
				this.models[optional]);
		}
		for(let frame in this.models){
			this._triggerUpdate(this.models[frame]);
		}
		for(let localName in this.frames){
			let model = this.models[localName];
			let distination = [];
			for(let property in this.models){
				if(this.models[property].baseMs == model.span){
					distination.push(this.models[property]);
				}
			}
			this._polling(model,distination);
			this._connectSocket(model,distination);
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
	async _polling(model,distination){
		while(true){
			let since = await this._getLastTime(model);
			try{
				await model.fetch(since,async (d) => {
					this._triggerUpdate(model);
					this._convertDistination(distination);
				});
			}catch(e){

			}
			await sleep(this.polling);
		}
	}
	async _getLastTime(model){
		let since = new Date(this.history_start).getTime();
		let last = await model.last();
		if(last){
			since = last.time.getTime() - model.span*300;
		}
		return since;
	}
	_loadHistorical(model,history_start){
		return new Promise(async resolve => {
			let since = await this._getLastTime(model);
			while(true){
				console.info(`getting historical ${model.market.id}${model.frame} data from timestamp : ${new Date(since)}`);
				let data = await model.fetch(since);
				if(data.length < 499){
					console.info(`got all ${model.market.id} ${model.frame} histories`)
					break;
				}
				since = data[data.length - 1].time.getTime() + model.span;
				await sleep(10000);
			}
			resolve();
		})
	}
	async _triggerUpdate(model){
		model.test();
		let data = await model.last();
		this.publisher.publish(model.channel,JSON.stringify(data));
	}
}
