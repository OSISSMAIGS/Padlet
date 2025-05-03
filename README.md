# Padlet Clone

A simple web-based Padlet clone built with Flask, Socket.io, and SQLite. This application allows users to post messages and images to a shared whiteboard in real-time.

## Features

- Real-time updates using Socket.io
- Post text messages to a shared whiteboard
- Attach images to messages
- Responsive design that works on mobile and desktop
- Beautiful, modern UI

## Prerequisites

- Python 3.8 or higher (compatible with Python 3.12)
- pip (Python package manager)

## Installation

1. Clone this repository:
   ```
   git clone <repository-url>
   cd padlet-clone
   ```

2. Create and activate a virtual environment (recommended):
   ```
   python -m venv venv
   # On Windows
   venv\Scripts\activate
   # On macOS/Linux
   source venv/bin/activate
   ```

3. Install the dependencies:
   ```
   pip install -r requirements.txt
   ```

4. (Optional) Update the default configuration in app.py if needed.

## Running the Application

1. Start the Flask development server:
   ```
   python app.py
   ```

2. Open your web browser and navigate to:
   ```
   http://127.0.0.1:5000
   ```

## Notes

- This application uses SQLite as the database, which is file-based and requires no additional setup
- The database file (padlet.db) will be created automatically in the project directory
- This application uses threading mode for Socket.IO instead of eventlet to ensure compatibility with Python 3.12
- Real-time updates should work without any additional configuration

## Production Deployment

For production deployment, consider using:
- Gunicorn as the WSGI server
- Nginx as a reverse proxy
- A more robust database like PostgreSQL or MySQL for higher traffic
- A proper file storage service for uploaded images (like AWS S3)

## License

This project is licensed under the MIT License - see the LICENSE file for details. # Padlet
# Padlet
# Padlet
