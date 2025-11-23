import os
from flask import Flask
from dotenv import load_dotenv
from app.extensions import db, login_manager, cors
from app.models import User

def create_app():
    load_dotenv()
    
    app = Flask(__name__)
    
    basedir = os.path.abspath(os.path.dirname(os.path.dirname(__file__)))
    db_path = os.path.join(basedir, 'rpg_database.db')
    
    app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'dev_key')
    app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{db_path}'
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    
    # Permite cookies em localhost
    app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
    app.config['SESSION_COOKIE_SECURE'] = False
    
    db.init_app(app)
    login_manager.init_app(app)
    
    # Libera origens comuns
    cors.init_app(app, supports_credentials=True, resources={
        r"/api/*": {
            "origins": ["http://localhost:5173", "http://127.0.0.1:5173"], 
            "methods": ["GET", "POST", "OPTIONS"],
            "allow_headers": ["Content-Type"]
        }
    })

    @login_manager.user_loader
    def load_user(user_id):
        return db.session.get(User, int(user_id))

    from app.routes.auth import auth_bp
    from app.routes.game import game_bp
    from app.routes.lobby import lobby_bp

    app.register_blueprint(auth_bp, url_prefix='/api')
    app.register_blueprint(game_bp, url_prefix='/api')
    app.register_blueprint(lobby_bp, url_prefix='/api')

    with app.app_context():
        db.create_all()

    return app