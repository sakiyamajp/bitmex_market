"use strict";

var _index = require("../index");

var _index2 = _interopRequireDefault(_index);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

(async () => {
	let markets = await (0, _index2.default)({
		// subscribe ohlcv markets data from bitmex api.
		// default : false,
		subscribe: true,
		// mongoose connection string
		mongo: "mongodb://test_user:test_password@127.0.0.1:27017/test_db",
		// redis connection config
		redis: {
			host: "127.0.0.1",
			port: 6379,
			password: "test_redis_password"
		},
		// target markets
		// default : ['XBTUSD']
		markets: ['XBTUSD',
		//		'BCHM18',
		//		'ETHM18',
		//		'LTCM18',
		//		'ADAM18',
		'XRPM18'],
		// optional time frames
		// m1,m5,h1,d1 are bitmex default time frames
		// optional time frames must be able to calculate from above bitmex default time frames.
		// default : {},
		timeframes: {
			"m2": 2 * 60 * 1000, // { name : ms }
			"m15": 15 * 60 * 1000, // { name : ms }
			"m30": 30 * 60 * 1000, // { name : ms }
			"h2": 2 * 60 * 60 * 1000, // { name : ms }
			"h4": 4 * 60 * 60 * 1000, // { name : ms }
			"h8": 8 * 60 * 60 * 1000, // { name : ms }
			"h12": 12 * 60 * 60 * 1000 // { name : ms }
		},
		// getting historical data form below
		// Z make this utc
		history: "2018-04-01T00:00:00.000Z"
		//		polling : 20000 // ms default 20000,
		//		verbose : true // default true
	});

	markets.XRPM18.m1.on((candle, market, timeframe) => {
		console.log(candle, market, timeframe);
	});
	markets.XBTUSD.d1.on((candle, market, timeframe) => {
		console.log(candle, market, timeframe);
	});

	let candles = await markets.XRPM18.m1.load(3);
	console.log(candles);

	candles = await markets.XBTUSD.d1.load(2, new Date('2018/05/01Z'));
	console.log(candles);
})();