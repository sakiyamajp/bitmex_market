import Market from '../index';

(async () => {
	let market = await Market({
		mongo : "mongodb://test_user:test_password@127.0.0.1:27017/test_db",
		redis : {
			host : "127.0.0.1",
			port : 6379,
			password : "test_redis_password"
		},
	});
	let xrp = market.XRPM18;

	xrp.m1.on((candle,market,timeframe)=>{
		console.log(candle,market,timeframe);
	});
	xrp.m2.on(candle => {
		console.log(candle);
	});

	market.XBTUSD.m1.on((candle,market,timeframe) => {
		console.log(candle,market,timeframe);
	})

	let candles = await xrp.m1.load(3);
	console.log(candles)
})();

