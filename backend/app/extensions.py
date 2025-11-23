from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager
from flask_cors import CORS

# Instâncias vazias que serão ligadas ao App depois
db = SQLAlchemy()
login_manager = LoginManager()
cors = CORS()