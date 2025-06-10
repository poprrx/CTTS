// F5-TTS Voice Generator JavaScript
class TTSManager {
    constructor() {
        this.apiUrl = 'https://0q8lf8gdlh6u8t-7860.proxy.runpod.net/generate';
        this.currentAudioBlob = null;
        this.testMode = false;
        this.initializeEventListeners();
        this.initializeTooltips();
        this.checkBackendStatus();
    }

    async checkBackendStatus() {
        // Skip status check since HEAD method returns 405 on working F5-TTS backend
        // The backend will be tested when user actually tries to generate voice
        console.log('F5-TTS backend configured at:', this.apiUrl);
    }

    showBackendWarning() {
        const warningDiv = document.createElement('div');
        warningDiv.id = 'backendWarning';
        warningDiv.className = 'alert alert-warning mb-4';
        warningDiv.innerHTML = `
            <i class="fas fa-exclamation-triangle me-2"></i>
            <strong>Backend Service Notice:</strong> The F5-TTS backend service appears to be unavailable. 
            Please ensure the RunPod instance is running and accessible.
        `;
        
        const container = document.querySelector('.container .row .col-lg-8');
        const card = container.querySelector('.card');
        container.insertBefore(warningDiv, card);
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
            formData.append('speed', parseFloat(document.getElementById('speedSlider').value));

            console.log('Sending request to:', this.apiUrl);
            console.log('Form data:', {
                gen_text: document.getElementById('genText').value,
                ref_text: document.getElementById('refText').value,
                voice_name: document.getElementById('voiceName').value,
                speed: parseFloat(document.getElementById('speedSlider').value)
            });

            // Make API request with proper headers for CORS
            const response = await fetch(this.apiUrl, {
                method: 'POST',
                mode: 'cors',
                headers: {
                    'Accept': 'application/octet-stream, audio/wav, audio/*'
                },
                body: formData
            });

            console.log('Response status:', response.status);
            console.log('Response headers:', Object.fromEntries(response.headers.entries()));
            console.log('Response content-type:', response.headers.get('content-type'));

            if (!response.ok) {
                let errorText;
                try {
                    const contentType = response.headers.get('content-type');
                    if (contentType && contentType.includes('application/json')) {
                        const errorData = await response.json();
                        errorText = errorData.detail || errorData.message || JSON.stringify(errorData);
                    } else {
                        errorText = await response.text();
                    }
                } catch (e) {
                    errorText = `HTTP ${response.status} ${response.statusText}`;
                }
                throw new Error(`Server error (${response.status}): ${errorText}`);
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
            let errorMessage = error.message;
            
            // Handle specific error types
            if (error.name === 'TypeError' && error.message.includes('fetch')) {
                errorMessage = 'Unable to connect to the voice generation service. Please verify the F5-TTS backend is running on RunPod.';
            } else if (error.message.includes('CORS')) {
                errorMessage = 'Cross-origin request blocked. The backend needs CORS configuration.';
            } else if (error.message.includes('500')) {
                errorMessage = 'The F5-TTS backend encountered an internal error. Please check the RunPod service logs.';
            }
            
            this.showError(errorMessage);
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
