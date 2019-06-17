"use strict";

Object.defineProperty(exports, "__esModule", {
	value: true
});

var _mongoose = require("mongoose");

var _mongoose2 = _interopRequireDefault(_mongoose);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

class Trade {
	constructor(market, history_span) {
		this.market = market;
		this.channel = `${market}_trade`;
		this.histories = [];
		this.history_span = history_span;
	}
	update(ds) {
		this.histories = this.histories.concat(ds);
		let now = new Date().getTime();
		now -= this.history_span;
		this.histories = this.histories.filter(d => {
			return d.timestamp >= now;
		});
		this.histories.sort((a, b) => a - b);
	}
	socket(socket, redis, ccxt) {
		socket.addStream(this.market, "trade", (ds, symbol, tableName) => {
			if (!ds.length) {
				return;
			}
			ds = ds.map(d => {
				d = ccxt.parseTrade(d);
				delete d.info;
				delete d.symbol;

				return d;
			});
			redis.publish(this.channel, JSON.stringify(ds));
		});
	}
}
exports.default = Trade;