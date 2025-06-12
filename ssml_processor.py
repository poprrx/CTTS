# SSML Processor for F5-TTS
import re
import os
import subprocess
from pydub import AudioSegment
# from pydub.silence import Silence  # Not needed for current implementation
import tempfile

def process_ssml_text_and_audio(gen_text, ref_audio_path, ref_text, output_file):
    """
    Process SSML breaks by splitting text and inserting actual silence in audio
    """
    # Find all SSML break tags and their positions
    break_pattern = r'<break\s+time\s*=\s*["\']([^"\']+)["\']\s*/>'
    
    # Split text by SSML breaks
    parts = re.split(break_pattern, gen_text)
    
    if len(parts) == 1:
        # No SSML breaks found, process normally
        return generate_single_audio(gen_text, ref_audio_path, ref_text, output_file)
    
    # Process each text segment and silence duration
    audio_segments = []
    temp_files = []
    
    try:
        for i in range(0, len(parts)):
            if i % 2 == 0:  # Text segments
                text_part = parts[i].strip()
                if text_part:
                    # Generate audio for this text segment
                    temp_audio_file = f"/tmp/segment_{i}.wav"
                    temp_files.append(temp_audio_file)
                    
                    success = generate_single_audio(text_part, ref_audio_path, ref_text, temp_audio_file)
                    if success and os.path.exists(temp_audio_file):
                        audio_segments.append(AudioSegment.from_wav(temp_audio_file))
            else:  # Break durations
                duration_str = parts[i]
                silence_ms = parse_duration_to_ms(duration_str)
                if silence_ms > 0:
                    # Create silence segment
                    silence = AudioSegment.silent(duration=silence_ms)
                    audio_segments.append(silence)
        
        # Combine all audio segments
        if audio_segments:
            combined_audio = audio_segments[0]
            for segment in audio_segments[1:]:
                combined_audio += segment
            
            # Export the combined audio
            combined_audio.export(output_file, format="wav")
            return True
        
    except Exception as e:
        print(f"Error processing SSML: {e}")
        # Fallback to original text without SSML
        clean_text = re.sub(break_pattern, ' ', gen_text)
        return generate_single_audio(clean_text, ref_audio_path, ref_text, output_file)
    
    finally:
        # Clean up temporary files
        for temp_file in temp_files:
            if os.path.exists(temp_file):
                os.remove(temp_file)
    
    return False

def parse_duration_to_ms(duration_str):
    """Convert duration string to milliseconds"""
    try:
        if 's' in duration_str and 'ms' not in duration_str:
            seconds = float(duration_str.replace('s', ''))
            return int(seconds * 1000)
        elif 'ms' in duration_str:
            return int(float(duration_str.replace('ms', '')))
    except:
        pass
    return 0

def generate_single_audio(text, ref_audio_path, ref_text, output_file):
    """Generate audio for a single text segment using F5-TTS"""
    try:
        command = [
            "f5-tts_infer-cli",
            "--model", "F5TTS_v1_Base",
            "--ref_audio", ref_audio_path,
            "--ref_text", ref_text,
            "--gen_text", text,
            "--output_file", output_file.replace('tests/', '')  # Remove tests prefix for command
        ]
        
        result = subprocess.run(command, capture_output=True, text=True)
        
        # F5-TTS adds tests/ prefix, so check both locations
        actual_file = f"tests/{output_file.replace('tests/', '')}"
        if os.path.exists(actual_file):
            # Move to expected location if needed
            if actual_file != output_file:
                os.rename(actual_file, output_file)
            return True
        elif os.path.exists(output_file):
            return True
            
    except Exception as e:
        print(f"Error generating audio: {e}")
    
    return False