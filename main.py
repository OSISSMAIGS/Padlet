import os
import uuid
from datetime import datetime, timezone, timedelta

from flask import Flask, render_template, request, jsonify, redirect
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_socketio import SocketIO, emit
from werkzeug.utils import secure_filename
from dotenv import load_dotenv

# Load environment variables for both cPanel and local XAMPP
load_dotenv()

app = Flask(__name__)
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'dev_key')

# Database configuration: prioritize cPanel env, fallback to local XAMPP defaults
db_user = os.getenv('DB_USER', 'root')              # cPanel: set via .env or App Manager; XAMPP default user
db_pass = os.getenv('DB_PASSWORD', '')               # cPanel: password from .env; XAMPP default empty
db_host = os.getenv('DB_HOST', 'localhost')          # host for MySQL
db_name = os.getenv('DB_NAME', 'padlet_db')          # default database name
db_port = os.getenv('DB_PORT', '3306')               # default MySQL port

app.config['SQLALCHEMY_DATABASE_URI'] = (
    f"mysql+pymysql://{db_user}:{db_pass}@{db_host}:{db_port}/{db_name}"
)
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# File upload configuration
app.config['UPLOAD_FOLDER'] = os.getenv('UPLOAD_FOLDER', 'static/uploads')
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

# Initialize extensions
db = SQLAlchemy(app)
migrate = Migrate(app, db)
# Force threading mode to avoid eventlet/ssl issues on Windows
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='threading')

# Define Post model
class Post(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    content = db.Column(db.Text, nullable=False)
    username = db.Column(db.String(100), nullable=False)
    image_path = db.Column(db.String(255), nullable=True)
    created_at = db.Column(
        db.DateTime(timezone=True),
        default=lambda: datetime.now(timezone(timedelta(hours=7)))
    )

    def to_dict(self):
        return {
            'id': self.id,
            'content': self.content,
            'username': self.username,
            'image_path': self.image_path,
            'created_at': self.created_at.strftime('%Y-%m-%d %H:%M:%S')
        }

# Routes
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/posts', methods=['GET'])
def get_posts():
    # Check if we're doing a poll request (fetching only newer posts)
    since = request.args.get('since')
    
    if since:
        try:
            # Convert timestamp to datetime
            since_time = datetime.fromtimestamp(int(since)/1000, timezone(timedelta(hours=7)))
            posts = Post.query.filter(Post.created_at > since_time).order_by(Post.created_at.desc()).all()
        except (ValueError, TypeError):
            # If invalid timestamp provided, return empty list
            return jsonify([])
    else:
        # Regular fetch all posts
        posts = Post.query.order_by(Post.created_at.desc()).all()
    
    return jsonify([post.to_dict() for post in posts])

@app.route('/api/posts', methods=['POST'])
def create_post():
    content = request.form.get('content', '')
    username = request.form.get('username', '').strip() or 'Anonymous'

    image_path = None
    file = request.files.get('image')
    if file and file.filename:
        filename = secure_filename(f"{uuid.uuid4().hex}_{file.filename}")
        save_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(save_path)
        image_path = f"uploads/{filename}"

    post = Post(content=content, username=username, image_path=image_path)
    db.session.add(post)
    db.session.commit()

    socketio.emit('new_post', post.to_dict())
    return jsonify(post.to_dict()), 201

@app.errorhandler(404)
def error(e):
    return redirect('/')

# SocketIO events
@socketio.on('connect')
def handle_connect():
    print('Client connected')

@socketio.on('disconnect')
def handle_disconnect():
    print('Client disconnected')

# CLI command to initialize DB tables
@app.cli.command('init-db')
def init_db():
    db.create_all()
    print('Database tables initialized.')

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    socketio.run(app, debug=True)