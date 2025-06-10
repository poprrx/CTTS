// F5-TTS Voice Generator JavaScript
class TTSManager {
    constructor() {
        this.apiUrl = 'https://0q8lf8gdlh6u8t-7860.proxy.runpod.net/generate';
        this.currentAudioBlob = null;
        this.initializeEventListeners();
        this.initializeTooltips();
    }

    initializeEventListeners() {
        // Form submission
        document.getElementById('ttsForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.generateVoice();
        });

        // Speed slider updates
        const speedSlider = document.getElementById('speedSlider');
        speedSlider.addEventListener('input', (e) => {
            document.getElementById('speedValue').textContent = e.target.value;
        });

        // Volume slider updates
        const volumeSlider = document.getElementById('volumeSlider');
        volumeSlider.addEventListener('input', (e) => {
            document.getElementById('volumeValue').textContent = e.target.value;
            this.updateAudioVolume();
        });
    }

    initializeTooltips() {
        // Initialize Bootstrap tooltips
        const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
        tooltipTriggerList.map(function (tooltipTriggerEl) {
            return new bootstrap.Tooltip(tooltipTriggerEl);
        });
    }

    async generateVoice() {
        try {
            this.showLoading();
            this.hideError();
            this.hideAudioSection();

            // Collect form data
            const formData = new FormData();
            formData.append('gen_text', document.getElementById('genText').value);
            formData.append('ref_text', document.getElementById('refText').value);
            formData.append('voice_name', document.getElementById('voiceName').value);
            formData.append('speed', document.getElementById('speedSlider').value);

            console.log('Sending request to:', this.apiUrl);
            console.log('Form data:', {
                gen_text: document.getElementById('genText').value,
                ref_text: document.getElementById('refText').value,
                voice_name: document.getElementById('voiceName').value,
                speed: document.getElementById('speedSlider').value
            });

            // Make API request
            const response = await fetch(this.apiUrl, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Server responded with ${response.status}: ${errorText}`);
            }

            // Get audio blob
            const audioBlob = await response.blob();
            console.log('Received audio blob:', audioBlob);

            if (audioBlob.size === 0) {
                throw new Error('Received empty audio file from server');
            }

            this.currentAudioBlob = audioBlob;
            this.setupAudioPlayer(audioBlob);
            this.showAudioSection();

        } catch (error) {
            console.error('Error generating voice:', error);
            this.showError(`Failed to generate voice: ${error.message}`);
        } finally {
            this.hideLoading();
        }
    }

    setupAudioPlayer(audioBlob) {
        const audioPlayer = document.getElementById('audioPlayer');
        const downloadBtn = document.getElementById('downloadBtn');

        // Create object URL for the audio blob
        const audioUrl = URL.createObjectURL(audioBlob);
        
        // Set up audio player
        audioPlayer.src = audioUrl;
        audioPlayer.load();

        // Apply current volume setting
        this.updateAudioVolume();

        // Set up download link
        downloadBtn.href = audioUrl;
        downloadBtn.download = `generated_voice_${Date.now()}.wav`;

        // Clean up previous URLs to prevent memory leaks
        audioPlayer.addEventListener('loadstart', () => {
            if (audioPlayer.previousSrc) {
                URL.revokeObjectURL(audioPlayer.previousSrc);
            }
            audioPlayer.previousSrc = audioUrl;
        });
    }

    updateAudioVolume() {
        const audioPlayer = document.getElementById('audioPlayer');
        const volumeValue = document.getElementById('volumeSlider').value;
        audioPlayer.volume = volumeValue / 100;
    }

    showLoading() {
        document.getElementById('loadingState').classList.remove('d-none');
        document.getElementById('generateBtn').disabled = true;
    }

    hideLoading() {
        document.getElementById('loadingState').classList.add('d-none');
        document.getElementById('generateBtn').disabled = false;
    }

    showAudioSection() {
        document.getElementById('audioSection').classList.remove('d-none');
    }

    hideAudioSection() {
        document.getElementById('audioSection').classList.add('d-none');
    }

    showError(message) {
        document.getElementById('errorMessage').textContent = message;
        document.getElementById('errorAlert').classList.remove('d-none');
    }

    hideError() {
        document.getElementById('errorAlert').classList.add('d-none');
    }
}

// SSML Helper Functions
function insertSSML(duration) {
    const textArea = document.getElementById('genText');
    const cursorPos = textArea.selectionStart;
    const textBefore = textArea.value.substring(0, cursorPos);
    const textAfter = textArea.value.substring(cursorPos);
    
    const ssmlTag = `<break time="${duration}"/>`;
    textArea.value = textBefore + ssmlTag + textAfter;
    
    // Move cursor after the inserted tag
    const newCursorPos = cursorPos + ssmlTag.length;
    textArea.setSelectionRange(newCursorPos, newCursorPos);
    textArea.focus();
}

// Initialize the TTS Manager when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new TTSManager();
    console.log('F5-TTS Voice Generator initialized');
});

// Handle page cleanup
window.addEventListener('beforeunload', () => {
    const audioPlayer = document.getElementById('audioPlayer');
    if (audioPlayer && audioPlayer.previousSrc) {
        URL.revokeObjectURL(audioPlayer.previousSrc);
    }
});
