"use strict";

Object.defineProperty(exports, "__esModule", {
	value: true
});

exports.default = async function Converter(candles, target) {
	let base = null;
	for (let property in candles) {
		if (candles[property].span == target.baseMs) {
			base = candles[property];
			break;
		}
	}
	let first = await base.first();
	if(!first){
		// mongo delay
		return false;
	}
	let start = first.time.getTime();
	let candleCount = target.span / base.span;

	let searchStart = start;
	let last = await target.last();
	if (last) {
		let targetStart = last.time.getTime() + target.span;
		if (targetStart > start) {
			searchStart = targetStart;
		}
	}
	let count = 0;
	let created = false;
	while (true) {
		let result = await candleEach(searchStart, base, target, candleCount);
		if (!result) {
			//			console.log(target.frame,"converted to",new Date(searchStart))
			break;
		}
		created = true;
		searchStart += target.span;
		count++;
		if (count % 1000 == 0) {
			//			console.log(target.frame,count,"converted and saved");
		}
	}
	return created;
};

function candleEach(start, base, target, candleCount) {
	return new Promise(resolve => {
		base.find({
			time: {
				$gte: start,
				$lt: start + target.span
			}
		}, '-_id -__v', {
			sort: {
				time: 1
			}
		}, (err, candles) => {
			if (candleCount != candles.length) {
				return resolve(null);
			}
			let converted;
			candles.forEach(c => {
				if (converted) {
					converted.add(c);
				} else {
					c = c.toObject();
					converted = new target(c);
				}
			});
			converted = converted.toObject();
			delete converted._id;
			target.findOneAndUpdate({
				time: converted.time
			}, converted, {
				upsert: true
			}, (e, old) => {
				if (e) {
					console.log("convert failed");
					throw e;
				}
				resolve(converted);
			});
		});
	});
}