from app.extensions import db
from flask_login import UserMixin
import json
import random
import string

def generate_room_code():
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))

class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(150), unique=True, nullable=False)
    password = db.Column(db.String(150), nullable=False)
    room_id = db.Column(db.Integer, db.ForeignKey('game_room.id'), nullable=True)

class GameRoom(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    code = db.Column(db.String(10), unique=True, default=generate_room_code)
    creator_id = db.Column(db.Integer, db.ForeignKey('user.id'))
    
    floor = db.Column(db.Integer, default=1)
    hp = db.Column(db.Integer, default=20)
    hp_max = db.Column(db.Integer, default=20)
    
    inventory_json = db.Column(db.Text, default='["mapa antigo", "tocha"]')
    history_json = db.Column(db.Text, default='[]')
    pending_actions_json = db.Column(db.Text, default='[]')
    
    players = db.relationship('User', backref='current_room', lazy=True, foreign_keys=[User.room_id])

    def get_inventory(self):
        try: return json.loads(self.inventory_json)
        except: return []
    
    def set_inventory(self, items):
        self.inventory_json = json.dumps(items)

    def get_history(self):
        try: return json.loads(self.history_json)
        except: return []
    
    def set_history(self, history):
        self.history_json = json.dumps(history)

    def get_pending_actions(self):
        try: return json.loads(self.pending_actions_json)
        except: return []

    def set_pending_actions(self, actions):
        self.pending_actions_json = json.dumps(actions)