# main.py

import os
import uuid
from datetime import datetime, timezone, timedelta

from flask import Flask, render_template, request, jsonify, redirect
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_socketio import SocketIO, emit
from werkzeug.utils import secure_filename
from dotenv import load_dotenv

# Load environment variables (or use defaults for local XAMPP)
load_dotenv()

app = Flask(__name__)
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'dev_key')

# Database configuration: cPanel via .env, fallback to XAMPP defaults
db_user = os.getenv('DB_USER', 'root')
db_pass = os.getenv('DB_PASSWORD', '')
db_host = os.getenv('DB_HOST', 'localhost')
db_name = os.getenv('DB_NAME', 'padlet_db')
db_port = os.getenv('DB_PORT', '3306')

app.config['SQLALCHEMY_DATABASE_URI'] = (
    f"mysql+pymysql://{db_user}:{db_pass}@{db_host}:{db_port}/{db_name}"
)
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# File upload settings
app.config['UPLOAD_FOLDER'] = os.getenv('UPLOAD_FOLDER', 'static/uploads')
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16 MB
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

# Initialize extensions
db = SQLAlchemy(app)
migrate = Migrate(app, db)
socketio = SocketIO(
    app,
    cors_allowed_origins="*",
    async_mode='threading',
    engineio_options={
        'transports': ['polling'],
        'ping_timeout': 60,  # Increased timeout
        'ping_interval': 25  # More frequent pings
    }
)

# Define your Post model
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
    posts = Post.query.order_by(Post.created_at.desc()).all()
    return jsonify([p.to_dict() for p in posts])

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
    
    # Get fresh data from DB to ensure ID is included
    post_dict = post.to_dict()
    
    # Emit with a slight delay to ensure database transaction is complete
    def emit_after_post():
        socketio.emit('new_post', post_dict)
    
    socketio.start_background_task(emit_after_post)
    
    return jsonify(post_dict), 201

@app.errorhandler(404)
def handle_404(e):
    return redirect('/')

# Socket.IO events
@socketio.on('connect')
def on_connect():
    print('Client connected')

@socketio.on('disconnect')
def on_disconnect():
    print('Client disconnected')

# Additional debug events
@socketio.on_error()
def error_handler(e):
    print(f"Socket.IO error: {e}")

@socketio.on('connect_error')
def handle_connect_error(error):
    print(f"Connection error: {error}")

# CLI command to init DB
@app.cli.command('init-db')
def init_db():
    db.create_all()
    print('Database tables initialized.')

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    # debug=False in production (cPanel); True locally if you like
    socketio.run(app, debug=False, host='0.0.0.0')