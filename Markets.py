from pymongo import MongoClient,DESCENDING
class Frame(object):
    def __init__(self,mongoClient,market_name,frame,ms):
        self.db = mongoClient[market_name.lower() + '_' + frame]
        self.channel = market_name + '_' + frame
    def load(self,limit=1,endTime=None):
        filter = {}
        if endTime != None:
            filter = {"time" : {"$lte":endTime} }
        return  self.db.find(
            filter=filter,
            limit=limit,
            projection={'_id': False,'__v': False},
            sort=[('time', DESCENDING)])
class Market(object):
    def __init__(self,mongoClient,market_name,timeframes):
        for key,value in timeframes.items():
            frame = Frame(mongoClient,market_name,key,value)
            setattr(self,key,frame)

class Markets(object):
    def __init__(self,mongo):
        mongoClient =  MongoClient(mongo)
        db = mongoClient.get_database()
        config = mongoClient[db.name].configs.find_one({})
        for market_name in config['markets']:
            market = Market(mongoClient[db.name],market_name,config["timeframes"])
            setattr(self,market_name,market)