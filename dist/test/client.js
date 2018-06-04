"use strict";

var _index = require("../index");

var _index2 = _interopRequireDefault(_index);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

(async () => {
	let markets = await (0, _index2.default)({
		mongo: "mongodb://test_user:test_password@127.0.0.1:27017/test_db",
		redis: {
			host: "127.0.0.1",
			port: 6379,
			password: "test_redis_password"
		}
	});
	let xrp = markets.XRPM18;
	xrp.m1.on((candle, market, timeframe) => {
		console.log(candle, market, timeframe);
	});
	xrp.m2.on(candle => {
		console.log(candle);
	});
	markets.XBTUSD.m1.on((candle, market, timeframe) => {
		console.log(candle, market, timeframe);
	});

	let candles = await xrp.m1.load(3);
	console.log(candles);
})();