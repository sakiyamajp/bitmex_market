"use strict";

Object.defineProperty(exports, "__esModule", {
	value: true
});

var _mongoose = require("mongoose");

var _mongoose2 = _interopRequireDefault(_mongoose);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

class Depth {
	constructor(market) {
		this.bids = [];
		this.asks = [];
		this.market = market;
		this.channel = `${market}_depth`;
	}
	socket(socket) {
		socket.addStream(this.market, "orderBook10", (d, symbol, tableName) => {
			this._parse(d, symbol, tableName);
		});
	}
	_parse(d, symbol, tableName) {
		if (!d.length) {
			return;
		}
		d = d[d.length - 1];
		this.time = new Date(d.timestamp);
		for (let name of ["bids", "asks"]) {
			this[name] = d[name].map(row => {
				return {
					price: row[0],
					amount: row[1]
				};
			});
		}
	}
}
exports.default = Depth;