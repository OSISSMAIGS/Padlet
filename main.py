import os
import uuid
from datetime import datetime, timezone, timedelta
from flask import Flask, render_template, request, jsonify, redirect
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_socketio import SocketIO, emit
from werkzeug.utils import secure_filename
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'dev_key')
app.config['SESSION_COOKIE_SAMESITE'] = 'None'
app.config['SESSION_COOKIE_SECURE'] = True

# Database configuration
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
    engineio_options={'transports': ['polling']},
    logger=True,
    engineio_logger=True
)

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

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/posts', methods=['GET'])
def get_posts():
    posts = Post.query.order_by(Post.created_at.desc()).all()
    return jsonify([p.to_dict() for p in posts])

@app.route('/api/posts', methods=['POST'])
def create_post():
    try:
        content = request.form.get('content', '')
        username = request.form.get('username', '').strip() or 'Anonymous'
        image_path = None

        if 'image' in request.files:
            file = request.files['image']
            if file.filename != '':
                filename = secure_filename(f"{uuid.uuid4().hex}_{file.filename}")
                save_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
                file.save(save_path)
                image_path = f"uploads/{filename}"

        post = Post(content=content, username=username, image_path=image_path)
        db.session.add(post)
        db.session.commit()

        socketio.emit('new_post', post.to_dict())
        app.logger.info(f"Emitted new_post event for post {post.id}")
        return jsonify(post.to_dict()), 201

    except Exception as e:
        db.session.rollback()
        app.logger.error(f"Error creating post: {str(e)}")
        return jsonify({"error": str(e)}), 500

@socketio.on('connect')
def on_connect():
    app.logger.info(f'Client connected: {request.sid}')

@socketio.on('disconnect')
def on_disconnect():
    app.logger.info(f'Client disconnected: {request.sid}')

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    socketio.run(app, debug=True)