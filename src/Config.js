import mongoose from 'mongoose';
export default function Config(){
	var configSchema = new mongoose.Schema({
		timeframes : mongoose.Schema.Types.Mixed,
		history : Date,
		markets : mongoose.Schema.Types.Mixed,
		histories : mongoose.Schema.Types.Mixed,
	});

	configSchema.statics.load = function(){
		return this.findOne({
		},'',{
		}).exec();
	};
	configSchema.statics.setup = async function(timeframes,history,markets){
		let old = await this.load();
		if(old){
			old.timeframes = timeframes;
			old.history = history;
			old.markets = markets;
		}else{
			old = new this({
				timeframes : timeframes,
				history : history,
				markets : markets
			});
		}
		return old.save();
	};
	return configSchema;
}
