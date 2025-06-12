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
            const genText = document.getElementById('genText').value;
            const voiceName = document.getElementById('voiceSelect').value;
            const speedPercentage = parseInt(document.getElementById('speedSlider').value);
            const speed = Math.max(0.1, speedPercentage / 100); // Convert percentage to decimal, minimum 0.1
            
            // Save generation to database before starting
            const generationData = {
                text_input: genText,
                voice_name: voiceName,
                speed: speedPercentage, // Store percentage in database
                status: 'pending'
            };
            
            const saveResponse = await fetch('/api/generations', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(generationData)
            });
            
            const saveResult = await saveResponse.json();
            const generationId = saveResult.id;

            // Process text to add automatic pauses at commas (if enabled)
            const autoPauseEnabled = document.getElementById('autoPauseCheck').checked;
            const processedText = autoPauseEnabled ? this.addAutomaticPauses(genText) : genText;
            
            const formData = new FormData();
            formData.append('gen_text', processedText);
            formData.append('ref_text', document.getElementById('refText').value);
            formData.append('voice_name', voiceName);
            formData.append('speed', speed);

            console.log('Sending request to:', this.apiUrl);
            console.log('Form data:', {
                gen_text: processedText,
                ref_text: document.getElementById('refText').value,
                voice_name: voiceName,
                speed: speed
            });

            // Make API request with proper headers for CORS and timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 minute timeout for longer texts
            
            const response = await fetch(this.apiUrl, {
                method: 'POST',
                mode: 'cors',
                headers: {
                    'Accept': 'application/octet-stream, audio/wav, audio/*'
                },
                body: formData,
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);

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
            
            // Update generation status to completed
            await fetch(`/api/generations/${generationId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({status: 'completed'})
            });
            


        } catch (error) {
            // Update generation status to failed
            if (typeof generationId !== 'undefined') {
                await fetch(`/api/generations/${generationId}`, {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({status: 'failed'})
                });
            }
            console.error('Full error details:', error);
            console.error('Error name:', error.name);
            console.error('Error message:', error.message);
            console.error('Error stack:', error.stack);
            
            let errorMessage = error.message || 'Unknown error occurred';
            
            // Handle specific error types
            if (error.name === 'AbortError') {
                errorMessage = 'Request timed out. Text may be too long or backend is overloaded.';
            } else if (error.name === 'TypeError' && error.message.includes('fetch')) {
                errorMessage = 'Network connection failed. F5-TTS backend may be temporarily unavailable.';
            } else if (error.message.includes('CORS')) {
                errorMessage = 'Cross-origin request blocked. Backend needs CORS configuration.';
            } else if (error.message.includes('500')) {
                errorMessage = 'F5-TTS backend internal error. Check RunPod service logs.';
            } else if (error.name === 'TypeError') {
                errorMessage = `Network or parsing error: ${error.message}`;
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

    async loadHistory(page = 1) {
        try {
            const response = await fetch(`/api/generations?page=${page}&limit=5`);
            const data = await response.json();
            
            const historyLoading = document.getElementById('historyLoading');
            const historyContent = document.getElementById('historyContent');
            const historyList = document.getElementById('historyList');
            const noHistory = document.getElementById('noHistory');
            
            historyLoading.classList.add('d-none');
            historyContent.classList.remove('d-none');
            
            if (data.generations.length === 0 && page === 1) {
                noHistory.classList.remove('d-none');
                historyList.innerHTML = '';
            } else {
                noHistory.classList.add('d-none');
                
                if (page === 1) {
                    // First page - replace content
                    historyList.innerHTML = this.renderGenerations(data.generations);
                } else {
                    // Additional pages - append content
                    historyList.innerHTML += this.renderGenerations(data.generations);
                }
                
                // Add or update "Show More" button
                this.updateShowMoreButton(data.has_more, page);
            }
        } catch (error) {
            console.error('Error loading history:', error);
            const historyLoading = document.getElementById('historyLoading');
            historyLoading.innerHTML = '<div class="text-danger"><i class="fas fa-exclamation-triangle me-2"></i>Error loading history</div>';
        }
    }

    renderGenerations(generations) {
        return generations.map(gen => {
            const createdAt = new Date(gen.created_at).toLocaleString();
            const statusIcon = gen.status === 'completed' ? 'fas fa-check-circle text-success' :
                             gen.status === 'failed' ? 'fas fa-times-circle text-danger' :
                             'fas fa-clock text-warning';
            
            const truncatedText = gen.text.length > 100 ? 
                gen.text.substring(0, 100) + '...' : gen.text;
            
            return `
                <div class="border-bottom border-secondary pb-3 mb-3">
                    <div class="d-flex justify-content-between align-items-start">
                        <div class="flex-grow-1">
                            <div class="small text-muted mb-1">
                                <i class="${statusIcon} me-1"></i>
                                ${createdAt} • ${gen.voice} • Speed: ${gen.speed}x
                            </div>
                            <div class="text-light">${truncatedText}</div>
                        </div>
                        <span class="badge bg-secondary ms-2">${gen.status}</span>
                    </div>
                </div>
            `;
        }).join('');
    }

    updateShowMoreButton(hasMore, currentPage) {
        const historyList = document.getElementById('historyList');
        
        // Remove existing button
        const existingButton = document.getElementById('showMoreBtn');
        if (existingButton) {
            existingButton.remove();
        }
        
        // Add new button if there are more items
        if (hasMore) {
            const showMoreBtn = document.createElement('div');
            showMoreBtn.id = 'showMoreBtn';
            showMoreBtn.className = 'text-center mt-3';
            showMoreBtn.innerHTML = `
                <button class="btn btn-outline-secondary btn-sm" onclick="ttsManager.loadHistory(${currentPage + 1})">
                    <i class="fas fa-chevron-down me-2"></i>
                    Show More
                </button>
            `;
            historyList.appendChild(showMoreBtn);
        }
    }

    addAutomaticPauses(text) {
        // Limit automatic pauses to prevent backend overload
        // Only add pauses at sentence boundaries and major clause separators
        let processed = text;
        
        // Add pauses after periods (but not abbreviations)
        processed = processed.replace(/\.(\s+)(?=[A-Z])/g, '.$1<break time="400ms"/>');
        
        // Add pauses at major clause breaks only (limit to 5 total to prevent timeout)
        const commaMatches = processed.match(/,(\s+)(?=[A-Z]|and |or |but |which |that )/g);
        if (commaMatches && commaMatches.length <= 5) {
            processed = processed.replace(/,(\s+)(?=[A-Z]|and |or |but |which |that )/g, ',$1<break time="200ms"/>');
        }
        
        return processed;
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
let ttsManager;
document.addEventListener('DOMContentLoaded', () => {
    ttsManager = new TTSManager();
    console.log('F5-TTS Voice Generator initialized');
});

// Handle page cleanup
window.addEventListener('beforeunload', () => {
    const audioPlayer = document.getElementById('audioPlayer');
    if (audioPlayer && audioPlayer.previousSrc) {
        URL.revokeObjectURL(audioPlayer.previousSrc);
    }
});
