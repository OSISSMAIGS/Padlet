import os
import uuid
from datetime import datetime, timezone, timedelta

from flask import Flask, render_template, request, jsonify, redirect
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_socketio import SocketIO, emit
from werkzeug.utils import secure_filename
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

app = Flask(__name__)
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'dev_key')

# Konfigurasi untuk MySQL via XAMPP
# Default XAMPP MySQL credentials: username='root', password=''
app.config['SQLALCHEMY_DATABASE_URI'] = 'mysql+pymysql://root:@localhost/padlet_db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['UPLOAD_FOLDER'] = os.getenv('UPLOAD_FOLDER', 'app/static/uploads')
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB

# Pastikan folder upload ada
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

# Inisialisasi ekstensi
db = SQLAlchemy(app)
migrate = Migrate(app, db)
socketio = SocketIO(app, cors_allowed_origins="*", async_mode="threading")

# Definisi model
class Post(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    content = db.Column(db.Text, nullable=False)
    username = db.Column(db.String(100), nullable=False)
    image_path = db.Column(db.String(255), nullable=True)
    # Timezone-aware UTC+7
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
    # Urutkan dari yang terbaru (created_at desc)
    posts = Post.query.order_by(Post.created_at.desc()).all()
    return jsonify([post.to_dict() for post in posts])


@app.route('/api/posts', methods=['POST'])
def create_post():
    content = request.form.get('content', '')
    username = request.form.get('username', '').strip() or 'Anonymous'

    image_path = None
    file = request.files.get('image')
    if file and file.filename:
        # Buat nama unik dan simpan
        filename = secure_filename(f"{uuid.uuid4().hex}_{file.filename}")
        save_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(save_path)
        # Simpan path relatif dari folder static
        image_path = f"uploads/{filename}"

    post = Post(content=content, username=username, image_path=image_path)
    db.session.add(post)
    db.session.commit()

    # Emit ke client SocketIO
    socketio.emit('new_post', post.to_dict())
    return jsonify(post.to_dict()), 201

@app.errorhandler(404)
def error(e):
    return redirect("/")

# SocketIO events
@socketio.on('connect')
def handle_connect():
    print('Client connected')


@socketio.on('disconnect')
def handle_disconnect():
    print('Client disconnected')


# CLI command untuk init DB
@app.cli.command("init-db")
def init_db():
    """Initialize database tables."""
    db.create_all()
    print("Database tables initialized.")


if __name__ == '__main__':
    # Pastikan tabel tersedia sebelum run
    with app.app_context():
        db.create_all()
    socketio.run(app, debug=True)