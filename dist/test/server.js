"use strict";

var _index = require("../index");

var _index2 = _interopRequireDefault(_index);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

(async () => {
	let markets = await (0, _index2.default)({
		subscribe: true,

		mongo: "mongodb://test_user:test_password@127.0.0.1:27017/test_db",

		redis: {
			host: "127.0.0.1",
			port: 6379,
			password: "test_redis_password"
		},

		markets: ['XBTUSD'],

		timeframes: {
			"m2": 2 * 60 * 1000,
			"m15": 15 * 60 * 1000,
			"m30": 30 * 60 * 1000,
			"h2": 2 * 60 * 60 * 1000,
			"h4": 4 * 60 * 60 * 1000,
			"h8": 8 * 60 * 60 * 1000,
			"h12": 12 * 60 * 60 * 1000 },

		history: "2018-04-01Z"
	});

	markets.XBTUSD.trade.on((ds, market) => {
		for (let d of ds) {}
	});
})();