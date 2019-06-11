'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});
exports.default = Config;

var _mongoose = require('mongoose');

var _mongoose2 = _interopRequireDefault(_mongoose);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function Config() {
	var configSchema = new _mongoose2.default.Schema({
		timeframes: _mongoose2.default.Schema.Types.Mixed,
		history: Date,
		markets: _mongoose2.default.Schema.Types.Mixed,
		histories: _mongoose2.default.Schema.Types.Mixed
	});

	configSchema.statics.load = function () {
		return this.findOne({}, '', {}).exec();
	};
	configSchema.statics.setup = async function (timeframes, history, markets) {
		let old = await this.load();
		if (old) {
			old.timeframes = timeframes;
			old.history = history;
			old.markets = markets;
		} else {
			old = new this({
				timeframes: timeframes,
				history: history,
				markets: markets
			});
		}
		return old.save();
	};
	return configSchema;
}