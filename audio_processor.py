import librosa
import soundfile as sf
import numpy as np
import tempfile
import os

def adjust_audio_speed(input_file, output_file, speed_multiplier):
    """
    Adjust audio speed while preserving pitch using librosa
    
    Args:
        input_file: Path to input audio file
        output_file: Path to output audio file
        speed_multiplier: Speed multiplier (0.1 = 10% speed, 1.0 = normal, 2.0 = double speed)
    
    Returns:
        bool: True if successful, False otherwise
    """
    try:
        # Load audio file
        y, sr = librosa.load(input_file, sr=None)
        
        # If speed is normal (1.0), just copy the file
        if abs(speed_multiplier - 1.0) < 0.01:
            sf.write(output_file, y, sr)
            return True
        
        # Apply time stretching while preserving pitch
        # Higher speed_multiplier = faster playback = shorter duration
        y_stretched = librosa.effects.time_stretch(y, rate=speed_multiplier)
        
        # Write the processed audio
        sf.write(output_file, y_stretched, sr)
        return True
        
    except Exception as e:
        print(f"Error adjusting audio speed: {e}")
        return False

def process_audio_with_speed(input_file, output_file, speed_percentage):
    """
    Process audio with speed adjustment based on percentage
    
    Args:
        input_file: Path to input audio file
        output_file: Path to output audio file  
        speed_percentage: Speed as percentage (0-200, where 100 = normal)
    
    Returns:
        bool: True if successful, False otherwise
    """
    # Convert percentage to multiplier
    # 0% = 0.1x, 100% = 1.0x, 200% = 2.0x
    speed_multiplier = max(0.1, speed_percentage / 100.0)
    
    return adjust_audio_speed(input_file, output_file, speed_multiplier)