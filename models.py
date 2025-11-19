from flask_sqlalchemy import SQLAlchemy
from flask_login import UserMixin
import json

db = SQLAlchemy()

class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(150), unique=True, nullable=False)
    password = db.Column(db.String(150), nullable=False)
    # Relacionamento: um usuário tem um estado de jogo
    game_state = db.relationship('GameState', backref='user', uselist=False)

class GameState(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), unique=True)
    
    # Dados do RPG
    floor = db.Column(db.Integer, default=1)
    hp = db.Column(db.Integer, default=10)
    hp_max = db.Column(db.Integer, default=10)
    
    # SQLite não guarda listas nativamente, então guardamos como Texto JSON
    inventory_json = db.Column(db.Text, default='["espada curta", "poção de cura"]')
    history_json = db.Column(db.Text, default='[]')

    # Métodos auxiliares para lidar com o JSON automaticamente
    def get_inventory(self):
        try:
            return json.loads(self.inventory_json)
        except:
            return []
    
    def set_inventory(self, items):
        self.inventory_json = json.dumps(items)

    def get_history(self):
        try:
            return json.loads(self.history_json)
        except:
            return []
    
    def set_history(self, history):
        self.history_json = json.dumps(history)