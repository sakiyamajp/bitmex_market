"use strict";
import mongoose from 'mongoose'
export default class Trade{
	constructor(market,history_span) {
		this.market = market;
		this.channel = `${market}_trade`;
		this.histories = [];
		this.history_span = history_span;
	}
	update(ds){
		this.histories = this.histories.concat(ds);
		let now = new Date().getTime();
		now -= this.history_span;
		this.histories = this.histories.filter(d => {
			return d.timestamp >= now;
		});
		this.histories.sort((a,b) => a-b);
	}
	socket(socket,redis,ccxt){
		// settlement ってなに
		socket.addStream(this.market,"trade",(ds, symbol, tableName) => {
			if(!ds.length){
				return;
			}
			ds = ds.map(d => {
				d = ccxt.parseTrade(d);
				delete d.info;
				delete d.symbol;
				// timestamp datetime同じだけどいいや
				return d;
			});
			redis.publish(this.channel,JSON.stringify(ds));
		});
	}
}