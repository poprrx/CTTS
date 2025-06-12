import os
import logging
import requests
from flask import Flask, render_template, request, jsonify, Response
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.orm import DeclarativeBase
from werkzeug.middleware.proxy_fix import ProxyFix
from datetime import datetime
from audio_processor import process_audio_speed

# Enable debug logging
logging.basicConfig(level=logging.DEBUG)

class Base(DeclarativeBase):
    pass

db = SQLAlchemy(model_class=Base)

# Create the Flask app
app = Flask(__name__)
app.secret_key = os.environ.get("SESSION_SECRET") or os.environ.get("SECRET_KEY", "dev-secret-key")
app.wsgi_app = ProxyFix(app.wsgi_app, x_proto=1, x_host=1)

# Configure the database
database_url = os.environ.get("DATABASE_URL")
if not database_url:
    raise RuntimeError("DATABASE_URL environment variable is not set")

app.config["SQLALCHEMY_DATABASE_URI"] = database_url
app.config["SQLALCHEMY_ENGINE_OPTIONS"] = {
    "pool_recycle": 300,
    "pool_pre_ping": True,
}
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

# Initialize the app with the extension
db.init_app(app)

@app.route('/')
def index():
    """Serve the main TTS interface"""
    return render_template('index.html')

@app.route('/api/generations', methods=['GET'])
def get_generations():
    """Get generation history"""
    try:
        # Get page and limit from query parameters
        page = int(request.args.get('page', 1))
        limit = int(request.args.get('limit', 5))  # Default to 5 items
        
        # Calculate offset
        offset = (page - 1) * limit
        
        # Get total count and paginated results
        total = VoiceGeneration.query.count()
        generations = VoiceGeneration.query.order_by(VoiceGeneration.created_at.desc()).offset(offset).limit(limit).all()
        
        return jsonify({
            'generations': [{
                'id': gen.id,
                'text': gen.text_input,
                'voice': gen.voice_name,
                'speed': gen.speed,
                'created_at': gen.created_at.isoformat(),
                'status': gen.status
            } for gen in generations],
            'total': total,
            'page': page,
            'limit': limit,
            'has_more': offset + limit < total
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/generations', methods=['POST'])
def save_generation():
    """Save a new voice generation record"""
    try:
        data = request.get_json()
        generation = VoiceGeneration(
            text_input=data.get('text_input'),
            voice_name=data.get('voice_name'),
            speed=data.get('speed', 1.0),
            status=data.get('status', 'pending')
        )
        db.session.add(generation)
        db.session.commit()
        return jsonify({'id': generation.id, 'status': 'saved'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/generations/<int:generation_id>', methods=['PATCH'])
def update_generation(generation_id):
    """Update generation status"""
    try:
        generation = VoiceGeneration.query.get_or_404(generation_id)
        data = request.get_json()
        if 'status' in data:
            generation.status = data['status']
        if 'audio_file_path' in data:
            generation.audio_file_path = data['audio_file_path']
        db.session.commit()
        return jsonify({'status': 'updated'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/generate_voice_enhanced', methods=['POST'])
def generate_voice_enhanced():
    """Generate voice with enhanced speed processing"""
    try:
        data = request.get_json()
        gen_text = data.get('gen_text')
        speed_percentage = int(data.get('speed_percentage', 100))
        
        # Prepare request to F5-TTS backend
        f5_payload = {
            'gen_text': gen_text,
            'ref_text': 'About Star Trek Voyager. Star Trek Voyager is an American science fiction television series created by Rick Berman, Michael Piller, and Jeri Taylor.',
            'voice_name': 'about_star_trek',
            'speed': 1.0,  # Always generate at normal speed first
            'ref_audio_path': '/workspace/F5-TTS/wavs/about_star_trek.wav'
        }
        
        # Call F5-TTS backend
        f5_url = 'https://0q8lf8gdlh6u8t-7860.proxy.runpod.net/generate'
        
        # Convert to FormData for F5-TTS
        files = {}
        form_data = {}
        for key, value in f5_payload.items():
            form_data[key] = str(value)
        
        response = requests.post(f5_url, data=form_data, files=files)
        response.raise_for_status()
        
        # Get original audio
        original_audio = response.content
        
        # Apply speed processing if needed
        if speed_percentage != 100:
            processed_audio = process_audio_speed(original_audio, speed_percentage)
        else:
            processed_audio = original_audio
        
        return Response(
            processed_audio,
            mimetype='audio/wav',
            headers={'Content-Disposition': 'attachment; filename=generated_voice.wav'}
        )
        
    except Exception as e:
        logging.error(f"Voice generation error: {e}")
        return jsonify({'error': str(e)}), 500

# Define models here to avoid circular imports
class VoiceGeneration(db.Model):
    __tablename__ = 'voice_generations'
    
    id = db.Column(db.Integer, primary_key=True)
    text_input = db.Column(db.Text, nullable=False)
    voice_name = db.Column(db.String(100), nullable=False)
    speed = db.Column(db.Float, default=1.0)
    status = db.Column(db.String(50), default='pending')  # pending, completed, failed
    audio_file_path = db.Column(db.String(255))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def __repr__(self):
        return f'<VoiceGeneration {self.id}: {self.text_input[:50]}...>'

class VoiceSettings(db.Model):
    __tablename__ = 'voice_settings'
    
    id = db.Column(db.Integer, primary_key=True)
    voice_code = db.Column(db.String(100), unique=True, nullable=False)
    voice_display_name = db.Column(db.String(100), nullable=False)
    reference_transcript = db.Column(db.Text, nullable=False)
    audio_file_path = db.Column(db.String(255))
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def __repr__(self):
        return f'<VoiceSettings {self.voice_code}: {self.voice_display_name}>'

with app.app_context():
    db.create_all()
    
    # Add default voice settings if not exists
    if not VoiceSettings.query.filter_by(voice_code='about_star_trek').first():
        default_voice = VoiceSettings(
            voice_code='about_star_trek',
            voice_display_name='Courtney Reyes',
            reference_transcript='About Star Trek Voyager. Star Trek Voyager is an American science fiction television series created by Rick Berman, Michael Piller, and Jeri Taylor.'
        )
        db.session.add(default_voice)
        db.session.commit()

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
