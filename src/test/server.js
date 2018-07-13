import Markets from '../index';
(async () => {
	let markets = await Markets({
		// subscribe ohlcv markets data from bitmex api.
		// default : false,
		subscribe : true,
		// mongoose connection string
		mongo : "mongodb://test_user:test_password@127.0.0.1:27017/test_db",
		// redis connection config
		// target markets
		// default : ['XBTUSD']
		markets : [
			'XBTUSD',
		],
		// optional time frames
		// m1,m5,h1,d1 are bitmex default time frames
		// optional time frames must be able to calculate from above bitmex default time frames.
		// default : {},
		timeframes : {
		},
		// getting historical data form below
		// Z make this utc
//		polling : 20000 // ms default 20000,
//		verbose : true // default true
	});

	markets.XBTUSD.h1.on((candle,market,timeframe) => {
		console.log(candle,market,timeframe);
	});
	let candles = await markets.XBTUSD.h1.load(3);
	console.log(candles)

	candles = await markets.XBTUSD.h1.load(2,new Date('2018/07/01Z'));
	console.log(candles)
})();
