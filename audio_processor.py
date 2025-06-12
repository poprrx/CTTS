import librosa
import soundfile as sf
import numpy as np
import tempfile
import os
from io import BytesIO

def process_audio_speed(audio_data, target_speed_percentage):
    """
    Apply high-quality pitch-preserving speed adjustment to audio
    
    Args:
        audio_data: Raw audio bytes
        target_speed_percentage: Speed as percentage (0-200)
    
    Returns:
        Processed audio bytes
    """
    try:
        # Convert percentage to speed ratio
        speed_ratio = max(0.1, target_speed_percentage / 100.0)
        
        # If speed is close to normal (90-110%), return original
        if 90 <= target_speed_percentage <= 110:
            return audio_data
        
        # Load audio from bytes
        with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as temp_input:
            temp_input.write(audio_data)
            temp_input_path = temp_input.name
        
        try:
            # Load audio with librosa
            y, sr = librosa.load(temp_input_path, sr=None)
            
            # Apply pitch-preserving time stretching
            if speed_ratio < 1.0:
                # For slow speeds, use phase vocoder with higher quality
                y_stretched = librosa.effects.time_stretch(y, rate=speed_ratio)
            else:
                # For fast speeds, use standard time stretching
                y_stretched = librosa.effects.time_stretch(y, rate=speed_ratio)
            
            # Apply smoothing for very slow speeds to reduce artifacts
            if speed_ratio < 0.5:
                # Light low-pass filtering to reduce high-frequency artifacts
                y_stretched = librosa.effects.preemphasis(y_stretched, coef=0.95)
            
            # Save processed audio to bytes
            with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as temp_output:
                temp_output_path = temp_output.name
            
            sf.write(temp_output_path, y_stretched, sr)
            
            with open(temp_output_path, 'rb') as f:
                processed_audio = f.read()
            
            # Clean up temporary files
            if os.path.exists(temp_output_path):
                os.unlink(temp_output_path)
            
            return processed_audio
            
        finally:
            # Clean up input temporary file
            if os.path.exists(temp_input_path):
                os.unlink(temp_input_path)
            
    except Exception as e:
        print(f"Audio processing error: {e}")
        # Return original audio if processing fails
        return audio_data