'use strict';

var _index = require('../index');

var _index2 = _interopRequireDefault(_index);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

(async () => {
	let markets = await (0, _index2.default)({
		subscribe: true,

		mongo: "mongodb://test_user:test_password@127.0.0.1:27017/test_db",

		markets: ['XBTUSD'],

		timeframes: {}
	});

	markets.XBTUSD.h1.on((candle, market, timeframe) => {
		console.log(candle, market, timeframe);
	});
	let candles = await markets.XBTUSD.h1.load(3);
	console.log(candles);

	candles = await markets.XBTUSD.h1.load(2, new Date('2018/07/01Z'));
	console.log(candles);
})();