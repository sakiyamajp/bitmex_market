# subscribe bitmex ohlcv markets data

Please note that I do not take any responsibility or liability for any damage or loss caused through this module.

# requirements
mongodb
redis
node.js


```
npm install sakiyamajp/bitmex_market#master
```

## node.js subscribe ohlcv markets data from bitmex
```
import Markets from 'bitmex_market';
Markets({
	// subscribe ohlcv markets data from bitmex api.
	// default : false,
	subscribe : true,
	// mongoose connection string
	mongo : "mongodb://test_user:test_password@127.0.0.1:27017/test_db",
	// redis connection config
	redis : {
		host : "127.0.0.1",
		port : 6379,
		password : "test_redis_password"
	},
	// target markets
	// default : ['XBTUSD']
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
	// optional time frames must be able to calculate from above bitmex default time frames.
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

// realtime XRPM18 m1 data via pubsub
markets.XRPM18.m1.on((candle,market,timeframe) => {
	console.log(candle,market,timeframe);
});

// realtime XBTUSD d1 data via pubsub
markets.XBTUSD.d1.on((candle,market,timeframe) => {
	console.log(candle,market,timeframe);
})

// manually loading ohlcv
let candles = await markets.XRPM18.m1.load(3);
console.log(candles)
```

## node.js subscribe ohlcv markets data from databases
```
import Markets from 'bitmex_market';
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

	// realtime XRPM18 m1 data via pubsub
	xrp.m1.on((candle,market,timeframe)=>{
		console.log(candle,market,timeframe);
	});

	// realtime XRPM18 m2 data via pubsub
	xrp.m2.on(candle => {
		console.log(candle);
	});

	// realtime XBTUSD m1 data via pubsub
	markets.XBTUSD.m1.on((candle,market,timeframe) => {
		console.log(candle,market,timeframe);
	})

	// manually loading ohlcv
	let candles = await xrp.m1.load(3);
	console.log(candles)
/*
[ { time: 2018-06-04T07:07:00.000Z,
    volume: 3169,
    close: 0.00008886,
    low: 0.00008886,
    high: 0.00008886,
    open: 0.00008887 },
  { time: 2018-06-04T07:08:00.000Z,
    volume: 2985,
    close: 0.00008887,
    low: 0.00008887,
    high: 0.00008887,
    open: 0.00008886 },
  { time: 2018-06-04T07:09:00.000Z,
    volume: 15830,
    close: 0.00008887,
    low: 0.00008886,
    high: 0.00008887,
    open: 0.00008887 } ]
*/
})();
```

## python3.5 subscribe ohlcv markets data from mongodb
```
from bitmex_market import Markets
// pymongo connection string
markets = Markets(mongo = "mongodb://test_user:test_password@127.0.0.1:27017/test_db")

market_names = markets.__dict__.keys()
for name in market_names:
    print(name)

# BCHM18
# XRPM18
# ADAM18
# XBTUSD
# ETHM18
# LTCM18

frame_names = markets.BCHM18.__dict__.keys()
for name in frame_names:
    print(name)

# h4
# m1
# m30
# h2
# m15
# h8
# h12
# m2
# d1
# m5
# h1

candle = markets.XBTUSD.m1.db.find_one()
print(candle)
#{'volume': 4673191, 'open': 6920.5, '__v': 0, '_id': ObjectId('5b07f8cabe64b865c3009308'), 'high': 6960, 'close': 6960, 'time': datetime.datetime(2018, 4, 1, 0, 0), 'low': 6920}

#cursor = markets.XBTUSD.m1.load(3,datetime.datetime(2018,4,30,0,0))
cursor = markets.XBTUSD.m1.load(3)
list(cursor)

[{'close': 7692,
  'high': 7692,
  'low': 7691,
  'open': 7691.5,
  'time': datetime.datetime(2018, 6, 4, 4, 27),
  'volume': 423231},
 {'close': 7691.5,
  'high': 7693.5,
  'low': 7691,
  'open': 7693.5,
  'time': datetime.datetime(2018, 6, 4, 4, 26),
  'volume': 1055994},
 {'close': 7693.5,
  'high': 7694,
  'low': 7693.5,
  'open': 7693.5,
  'time': datetime.datetime(2018, 6, 4, 4, 25),
  'volume': 390303}]

```

## python3.5 subscribe ohlcv markets data via redis pubsub
```
import redis
import json

client = redis.StrictRedis(host='localhost', port=6379, password='test_redis_password')
pubsub = client.pubsub()
channel = b'XBTUSD_m1'
pubsub.subscribe(channel)

for item in pubsub.listen():
    if item['channel'] == channel and item['type'] == 'message' :
        data = item.get('data')
        data = data.decode('utf-8')
        data = json.loads(data)
        print(data)

# {'high': 7545, 'open': 7544.5, 'time': '2018-05-31T10:26:00.000Z', 'low': 7544, 'close': 7544.5, 'volume': 222789}
# {'high': 7545, 'open': 7544.5, 'time': '2018-05-31T10:27:00.000Z', 'low': 7543, 'close': 7543, 'volume': 861217}
# {'high': 7542.5, 'open': 7543, 'time': '2018-05-31T10:28:00.000Z', 'low': 7542, 'close': 7542, 'volume': 306987}
# {'high': 7543.5, 'open': 7542, 'time': '2018-05-31T10:29:00.000Z', 'low': 7542, 'close': 7543.5, 'volume': 395195}
# {'high': 7543.5, 'open': 7543.5, 'time': '2018-05-31T10:30:00.000Z', 'low': 7543, 'close': 7543.5, 'volume': 377342}


```

BTC : 39TKj754PUVNd2uxV2anUVQ8LMRxhW1XqX
