import Markets from '../index';

(async () => {
	let markets = await Markets({
		mongo : "mongodb://test_user:test_password@127.0.0.1:27017/test_db",
		redis : {
			host : "127.0.0.1",
			port : 6379,
			password : "test_redis_password"
		},
	});
	let xrp = markets.XRPM18;
	xrp.m1.on((candle,market,timeframe)=>{
		console.log(candle,market,timeframe);
	});
	xrp.m2.on(candle => {
		console.log(candle);
	});
	xrp.depth.on(d => {
//		console.log(d);
	})
	markets.XBTUSD.m1.on((candle,market,timeframe) => {
		console.log(candle,market,timeframe);
	})

	let candles = await xrp.m1.load(3);
	console.log(candles)
})();

