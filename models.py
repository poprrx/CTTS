from app import db
from datetime import datetime

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