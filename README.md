# subscribe bitmex XBTUSD market data

mongodb and redis required

```
npm install sakiyamajp/bitmex_market#master
```

## subscribe ohlcv market data from bitmex
```
import Market from 'bitmex_market';
Market({
	// subscribe ohlc market data from bitmex
	subscribe : true,
	// mongoose connection string
	mongo : "mongodb://test_user:test_password@127.0.0.1:27017/test_db",
	// redis connection config
	redis : {
		host : "127.0.0.1",
		port : 6379,
		password : "test_redis_password"
	},
	markets : [
		'BCHM18',
		'XBTUSD',
		'ETHM18',
		'LTCM18',
		'ADAM18',
		'XRPM18'
	],
	// optional time frames
	// m1,m5,h1,d1 are bitmex default time frames
	// all frames must be able to calculate from these time frames.
	timeframes : {
		"m2" : 2 * 60 * 1000,// { name : ms }
		"m15" : 15 * 60 * 1000,// { name : ms }
		"m30" : 30 * 60 * 1000,// { name : ms }
		"h2" : 2 * 60 * 60 * 1000,// { name : ms }
		"h4" : 4 * 60 * 60 * 1000,// { name : ms }
		"h8" : 8 * 60 * 60 * 1000,// { name : ms }
		"h12" : 12 * 60 * 60 * 1000,// { name : ms }
	},
	// getting historical data form below
	// Z make this utc
	history : "2018-04-01T00:00:00.000Z",
//	polling : 20000 // ms default,
//	verbose : true // default
});
```

## subscribe ohlcv market data from database
```
import Market from 'bitmex_market';
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

	// realtime XRPM18 m1 data via push communication
	xrp.m1.on((candle,market,timeframe)=>{
		console.log(candle,market,timeframe);
	});

	// realtime XRPM18 m2 data via push communication
	xrp.m2.on(candle => {
		console.log(candle);
	});

	// realtime XBTUSD m1 data via push communication
	market.XBTUSD.m1.on((candle,market,timeframe) => {
		console.log(candle,market,timeframe);
	})

	// loading ohlcv manually
	let candles = await xrp.m1.load(3);
	console.log(candles)
})();
```

BTC : 39TKj754PUVNd2uxV2anUVQ8LMRxhW1XqX
