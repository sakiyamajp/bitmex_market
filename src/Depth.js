"use strict";
import mongoose from 'mongoose'
export default class Depth{
	constructor(market) {
		this.bids = [];
		this.asks = [];
		this.market = market;
		this.channel = `${market}_depth`;
	}
	socket(socket,redis){
		socket.addStream(this.market,"orderBook10",(d, symbol, tableName) => {
			if(!d.length){
				return;
			}
			d = d[d.length - 1];
			d = Depth.parse(d);
			if(redis){
				redis.publish(this.channel,JSON.stringify(d));
			}
		});
	}
	update(d){
		this.bids = d.bids;
		this.asks = d.asks;
		this.time = d.time;
	}
	static parse(d){
		let result = {
			time : new Date(d.timestamp)
		}
		for(let name of ["bids","asks"]){
			result[name] = d[name].map((row) => {
				return {
					price : row[0],
					amount : row[1],
				}
			});
		}
		return result;
	};
}