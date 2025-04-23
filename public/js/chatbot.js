// public/js/chatbot.js - Simplified version without language switching
document.addEventListener('DOMContentLoaded', function () {
    // DOM Elements
    const chatMessages = document.getElementById('chat-messages');
    const messageInput = document.getElementById('message-input');
    const sendButton = document.getElementById('send-btn');
    const micButton = document.getElementById('mic-btn');
    const typingIndicator = document.querySelector('.typing-indicator');
    const categoryTitles = document.querySelectorAll('.category-title');
    const questionItems = document.querySelectorAll('.question-item');
    const suggestions = document.querySelectorAll('.suggestion');
    const themeToggle = document.getElementById('theme-icon');
    const voiceToggle = document.getElementById('voice-toggle');
    const clearChat = document.getElementById('clear-chat');
    const attachmentBtn = document.getElementById('attachment-btn');

    // Check if required elements exist
    if (!chatMessages || !messageInput || !sendButton) {
        console.error('Critical elements not found on page');
        return; // Exit initialization if critical elements don't exist
    }

    // State variables
    let isVoiceEnabled = localStorage.getItem('voiceEnabled') === 'true';
    let isMicActive = false;
    let recognition = null;

    // Initialize speech synthesis and recognition if available
    const speechSynthesis = window.speechSynthesis;
    if ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.lang = 'en-US';

        recognition.onresult = function (event) {
            const transcript = event.results[0][0].transcript;
            messageInput.value = transcript;
            sendMessage();
        };

        recognition.onend = function () {
            if (micButton) {
                micButton.classList.remove('active');
                isMicActive = false;
            }
        };

        recognition.onerror = function (event) {
            console.error('Speech recognition error:', event.error);
            if (micButton) {
                micButton.classList.remove('active');
                isMicActive = false;
            }
        };
    } else if (micButton) {
        micButton.style.display = 'none';
    }

    // Category-wise responses database
    const categoryResponses = {
        booking: {
            'How do I book a service?': "To book a service, follow these easy steps:\n\n1. Log in to your account\n2. Select the service type you need\n3. Choose your preferred date and time\n4. Enter your location details\n5. Review and confirm\n\nYou'll receive a confirmation email with all details and the assigned professional.",

            'What services do you offer?': "We offer a wide range of home services including:\n\n• Plumbing\n• Electrical work\n• Appliance repair\n• Cleaning services\n• Home renovations\n• Painting\n• HVAC maintenance\n• Pest control\n• Gardening & landscaping\n• Furniture assembly\n\nEach service comes with qualified professionals and service guarantees.",

            'How to reschedule my booking?': "Rescheduling your booking is simple:\n\n1. Go to 'My Bookings' in your account dashboard\n2. Select the booking you want to reschedule\n3. Click on 'Reschedule' button\n4. Choose your new preferred date and time\n5. Confirm the changes\n\nYou can reschedule up to 4 hours before the scheduled service without any charges.",

            'Can I cancel my booking?': "Yes, you can cancel your booking:\n\n1. Navigate to 'My Bookings' section\n2. Select the booking you wish to cancel\n3. Click the 'Cancel Booking' button\n4. Provide a reason for cancellation (optional)\n5. Confirm cancellation\n\nCancellations made 24 hours before scheduled time receive a full refund. Later cancellations may be subject to a fee of 50% of the service charge."
        },

        payments: {
            'What payment methods do you accept?': "We accept multiple payment methods for your convenience:\n\n• Credit/Debit cards (Visa, Mastercard, Amex)\n• PayPal\n• Apple Pay & Google Pay\n• Bank transfers\n• UPI (for customers in India)\n• In-app wallet\n\nAll payment information is securely processed and encrypted.",

            'How much do services cost?': "Our service pricing varies based on:\n\n• Type of service requested\n• Complexity of the job\n• Duration of the service\n• Parts or materials required\n• Your location\n\nYou'll always see transparent pricing before confirming your booking. Our app provides instant quotes after you enter service details.",

            'Do you offer refunds?': "Yes, our refund policy is customer-friendly:\n\n• 100% refund for cancellations made 24+ hours before appointment\n• Partial refund (50%) for cancellations within 4-24 hours of appointment\n• Full refund if the service provider cancels or doesn't show up\n• Partial or full refund if you're not satisfied with the service quality\n\nRefunds are typically processed within 3-5 business days.",

            'Is there a booking fee?': "We have a transparent fee structure:\n\n• Standard booking: No additional booking fee\n• Express service (within 2 hours): Small convenience fee of $10-15\n• Holiday bookings: 10% additional charge\n• Late-night emergency services: Premium rates apply\n\nAll fees are clearly shown before you confirm the booking."
        },

        providers: {
            'How are service providers verified?': "Our service providers undergo a thorough verification process:\n\n• Identity verification\n• Background checks\n• License and certification validation\n• Skill assessment tests\n• Training completion\n• Reference checks\n• Customer reviews evaluation\n\nOnly professionals who pass all verification steps join our platform.",

            'Can I choose my service provider?': "Yes, you have options for selecting your service provider:\n\n• View available professionals with their ratings and specialties\n• Select your preferred provider when booking\n• Mark providers as favorites for future bookings\n• Request the same provider you've worked with before\n\nIf your preferred provider isn't available for your time slot, we'll match you with someone with similar expertise and ratings.",

            'What if I\'m not satisfied?': "Customer satisfaction is our priority. If you're not satisfied:\n\n1. Submit a complaint through the app or contact support\n2. Explain the issues you experienced\n3. We'll investigate immediately\n4. You may be offered a re-service at no additional cost\n5. If re-service isn't feasible, you'll receive a full or partial refund\n\nOur satisfaction guarantee covers all aspects of the service experience.",

            'Are your providers insured?': "Yes, all our service providers are fully insured:\n\n• Professional liability insurance\n• General liability coverage\n• Property damage protection\n• Workers' compensation\n\nThis ensures that you're protected against any accidental damage or incidents during service. You can request to view insurance certificates before service if needed."
        },

        account: {
            'How do I update my profile?': "Updating your profile is easy:\n\n1. Log in to your account\n2. Click on your profile icon or 'My Account'\n3. Select 'Edit Profile'\n4. Update your personal information, address, contact details\n5. Upload a new profile picture if desired\n6. Save changes\n\nKeeping your information updated ensures smooth service delivery.",

            'Where can I see my booking history?': "To view your booking history:\n\n1. Log in to your account\n2. Navigate to 'My Bookings' section\n3. You'll see tabs for Current, Upcoming, and Past bookings\n4. Click on any booking to see its details\n5. You can also download service reports and invoices\n\nBooking history is available for the past 12 months.",

            'How to change my password?': "To change your password:\n\n1. Go to 'My Account' settings\n2. Select 'Security' or 'Password'\n3. Enter your current password\n4. Create and confirm your new password\n5. Click 'Save Changes'\n\nFor security, create a strong password with letters, numbers, and special characters. You'll receive a confirmation email after changing your password.",

            'Can I delete my account?': "Yes, you can delete your account:\n\n1. Go to 'My Account' settings\n2. Scroll to 'Account Management'\n3. Select 'Delete Account'\n4. Confirm your password\n5. Provide feedback (optional)\n6. Confirm deletion\n\nNote that deleting your account will remove all your personal data, booking history, and saved addresses. This action cannot be undone."
        },

        safety: {
            'Is my personal information secure?': "Your personal information security is our top priority:\n\n• All data is encrypted using industry-standard protocols\n• Secure payment processing compliant with PCI-DSS\n• Limited employee access to personal data\n• Regular security audits and updates\n• No sharing of your information with third parties without consent\n• Option to delete your data upon request\n\nWe comply with GDPR, CCPA, and other regional data protection regulations.",

            'What safety measures do you have?': "We implement comprehensive safety measures:\n\n• All service providers undergo background checks\n• Real-time provider tracking during service visits\n• In-app emergency assistance button\n• Post-service verification and quality checks\n• Service provider ratings and review system\n• COVID-19 safety protocols including vaccinations and sanitation\n\nOur Trust & Safety team monitors all service activities to ensure your security.",

            'How do I report an issue?': "To report an issue:\n\n1. Open the app and go to 'Help & Support'\n2. Select 'Report an Issue'\n3. Choose the booking associated with the problem\n4. Describe the issue in detail\n5. Add photos if relevant\n6. Submit your report\n\nOur support team will respond within 2 hours for urgent issues and 24 hours for standard queries.",

            'Emergency contact information': "For emergencies during service:\n\n• Use the in-app SOS button for immediate assistance\n• Call our 24/7 emergency helpline: 1-800-123-4567\n• Email: emergency@serviceapp.com\n\nFor service-related emergencies (e.g., gas leak, electrical issues):\n• Contact the service provider directly through the app\n• Call local emergency services if there's immediate danger\n\nAll emergency contacts are available in the 'Safety' section of the app."
        }
    };

    // Toggle categories
    if (categoryTitles.length > 0) {
        categoryTitles.forEach(title => {
            title.addEventListener('click', function () {
                const category = this.parentElement;
                const arrow = this.querySelector('.arrow i');

                // Close all other categories
                document.querySelectorAll('.category').forEach(cat => {
                    if (cat !== category && cat.classList.contains('active')) {
                        cat.classList.remove('active');
                        const catArrow = cat.querySelector('.arrow i');
                        if (catArrow) catArrow.className = 'fas fa-chevron-right';
                    }
                });

                // Toggle current category
                category.classList.toggle('active');

                if (arrow) {
                    if (category.classList.contains('active')) {
                        arrow.className = 'fas fa-chevron-down';
                    } else {
                        arrow.className = 'fas fa-chevron-right';
                    }
                }
            });
        });
    }

    // Handle sending messages
    function sendMessage() {
        const message = messageInput.value.trim();
        if (message === '') return;

        // Add user message
        addMessage(message, 'user');
        messageInput.value = '';

        // Show typing indicator
        if (typingIndicator) {
            typingIndicator.classList.add('active');
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }

        // Simulate bot response after delay
        setTimeout(() => {
            if (typingIndicator) typingIndicator.classList.remove('active');

            // Generate bot response based on user input
            let botResponse = getBotResponse(message);
            addMessage(botResponse, 'bot');

            // Text-to-speech if enabled
            if (isVoiceEnabled && speechSynthesis) {
                speakText(botResponse);
            }
        }, 1000 + Math.random() * 1500);
    }

    function addMessage(text, sender) {
        if (!chatMessages || !typingIndicator) return;

        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', sender);

        const messageContent = document.createElement('div');
        messageContent.classList.add('message-content');

        const messageText = document.createElement('div');
        messageText.classList.add('message-text');

        // Convert newlines to <br> tags
        messageText.innerHTML = text.replace(/\n/g, '<br>');
        messageContent.appendChild(messageText);

        const timeDiv = document.createElement('div');
        timeDiv.classList.add('message-time');
        const now = new Date();
        timeDiv.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        messageContent.appendChild(timeDiv);

        messageDiv.appendChild(messageContent);
        chatMessages.insertBefore(messageDiv, typingIndicator);

        // Auto scroll to the bottom
        chatMessages.scrollTop = chatMessages.scrollHeight;

        // Save to local storage for chat history
        saveMessageToHistory(text, sender, now);
    }

    // Save message to local storage history
    async function saveMessageToHistory(text, sender, timestamp) {
        try {
            // Use localStorage instead of server API for simplicity
            const messages = JSON.parse(localStorage.getItem('chatMessages') || '[]');
            messages.push({
                text,
                sender,
                timestamp: timestamp.toISOString()
            });

            // Keep history manageable
            if (messages.length > 50) {
                messages.splice(0, messages.length - 50);
            }

            localStorage.setItem('chatMessages', JSON.stringify(messages));
        } catch (err) {
            console.error('Error saving message:', err);
        }
    }

    // Load chat history from local storage
    function loadChatHistory() {
        if (!chatMessages || !typingIndicator) return;

        try {
            const chatHistory = JSON.parse(localStorage.getItem('chatMessages') || '[]');

            if (chatHistory.length > 0) {
                // Clear existing messages
                chatMessages.innerHTML = '';
                chatMessages.appendChild(typingIndicator);

                chatHistory.forEach(msg => {
                    const messageDiv = document.createElement('div');
                    messageDiv.classList.add('message', msg.sender);

                    const messageContent = document.createElement('div');
                    messageContent.classList.add('message-content');

                    const messageText = document.createElement('div');
                    messageText.classList.add('message-text');
                    messageText.innerHTML = msg.text.replace(/\n/g, '<br>');
                    messageContent.appendChild(messageText);

                    const timeDiv = document.createElement('div');
                    timeDiv.classList.add('message-time');
                    const msgTime = new Date(msg.timestamp);
                    timeDiv.textContent = msgTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    messageContent.appendChild(timeDiv);

                    messageDiv.appendChild(messageContent);
                    chatMessages.insertBefore(messageDiv, typingIndicator);
                });

                chatMessages.scrollTop = chatMessages.scrollHeight;
            }
        } catch (err) {
            console.error('Error loading chat history:', err);
        }
    }

    // Clear chat history
    function clearChatHistory() {
        if (!chatMessages || !typingIndicator) return;

        try {
            // Clear from localStorage
            localStorage.removeItem('chatMessages');

            chatMessages.innerHTML = '';

            // Add default welcome message
            const welcomeMessage = document.createElement('div');
            welcomeMessage.classList.add('message', 'bot');

            const messageContent = document.createElement('div');
            messageContent.classList.add('message-content');

            const messageText = document.createElement('div');
            messageText.classList.add('message-text');
            messageText.textContent = "Hello! 👋 I'm your AI assistant. How can I help you today?";
            messageContent.appendChild(messageText);

            const timeDiv = document.createElement('div');
            timeDiv.classList.add('message-time');
            const now = new Date();
            timeDiv.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            messageContent.appendChild(timeDiv);

            welcomeMessage.appendChild(messageContent);
            chatMessages.appendChild(welcomeMessage);
            chatMessages.appendChild(typingIndicator);
        } catch (err) {
            console.error('Error clearing chat history:', err);
        }
    }

    // Text to speech function
    function speakText(text) {
        if (!speechSynthesis) return;

        // Clean the text for better speech (remove symbols that might cause issues)
        const cleanText = text.replace(/[•\n]/g, ' ').replace(/\s+/g, ' ');

        // Create utterance
        const utterance = new SpeechSynthesisUtterance(cleanText);
        utterance.rate = 1;
        utterance.pitch = 1;
        utterance.volume = 1;
        utterance.lang = 'en-US';

        // Get available voices and set a good one if available
        const voices = speechSynthesis.getVoices();
        if (voices.length > 0) {
            // Try to find a good English voice
            const preferredVoice = voices.find(voice =>
                voice.name.includes('Google') && voice.name.includes('US English') ||
                voice.name.includes('Samantha') ||
                voice.name.includes('Microsoft Zira')
            );

            if (preferredVoice) {
                utterance.voice = preferredVoice;
            }
        }

        // Cancel any ongoing speech
        speechSynthesis.cancel();

        // Speak the text
        speechSynthesis.speak(utterance);
    }

    // Get bot response based on user input
    function getBotResponse(userMessage) {
        userMessage = userMessage.toLowerCase();

        // Check for exact matches in the category responses
        for (const category in categoryResponses) {
            for (const question in categoryResponses[category]) {
                if (userMessage.includes(question.toLowerCase())) {
                    return categoryResponses[category][question];
                }
            }
        }

        // If no exact match, check for keywords
        if (userMessage.includes('book') || userMessage.includes('service') || userMessage.includes('appointment')) {
            return categoryResponses.booking['How do I book a service?'];
        }
        else if (userMessage.includes('payment') || userMessage.includes('pay') || userMessage.includes('cost') || userMessage.includes('price')) {
            return categoryResponses.payments['What payment methods do you accept?'];
        }
        else if (userMessage.includes('provider') || userMessage.includes('professional') || userMessage.includes('technician')) {
            return categoryResponses.providers['How are service providers verified?'];
        }
        else if (userMessage.includes('cancel') || userMessage.includes('reschedule')) {
            return categoryResponses.booking['Can I cancel my booking?'];
        }
        else if (userMessage.includes('refund') || userMessage.includes('money back')) {
            return categoryResponses.payments['Do you offer refunds?'];
        }
        else if (userMessage.includes('profile') || userMessage.includes('account') || userMessage.includes('login')) {
            return categoryResponses.account['How do I update my profile?'];
        }
        else if (userMessage.includes('emergency') || userMessage.includes('urgent')) {
            return categoryResponses.safety['Emergency contact information'];
        }
        else if (userMessage.includes('safety') || userMessage.includes('secure') || userMessage.includes('security')) {
            return categoryResponses.safety['What safety measures do you have?'];
        }
        else if (userMessage.includes('thank')) {
            return "You're welcome! If you need any further assistance, feel free to ask. We're here to help! 😊";
        }
        else if (userMessage.includes('hi') || userMessage.includes('hello') || userMessage.includes('hey')) {
            return "Hello there! 👋 How can I assist you with our services today?";
        }
        else {
            return "I'm here to help with any questions about our services. You can ask about booking services, payments, our providers, or check the categories on the left for more specific topics.";
        }
    }

    // Toggle dark/light theme
    function toggleTheme() {
        document.body.classList.toggle('dark-mode');

        if (themeToggle) {
            if (document.body.classList.contains('dark-mode')) {
                themeToggle.className = 'fas fa-sun';
                localStorage.setItem('theme', 'dark');
            } else {
                themeToggle.className = 'fas fa-moon';
                localStorage.setItem('theme', 'light');
            }
        }
    }

    // Toggle voice output
    function toggleVoice() {
        isVoiceEnabled = !isVoiceEnabled;

        if (voiceToggle) {
            if (isVoiceEnabled) {
                voiceToggle.style.color = '#28a745';
                // Provide feedback that voice is enabled
                addMessage("Voice output is now enabled.", "bot");
                if (speechSynthesis) {
                    speakText("Voice output is now enabled.");
                }
            } else {
                voiceToggle.style.color = '';
                if (speechSynthesis) speechSynthesis.cancel(); // Stop any ongoing speech
            }
        }

        localStorage.setItem('voiceEnabled', isVoiceEnabled);
    }

    // Toggle microphone for speech input
    function toggleMic() {
        if (!recognition || !micButton) return;

        if (!isMicActive) {
            recognition.start();
            micButton.classList.add('active');
            isMicActive = true;
        } else {
            recognition.stop();
            micButton.classList.remove('active');
            isMicActive = false;
        }
    }

    // Load user preferences
    function loadPreferences() {
        // Load theme preference
        if (themeToggle) {
            const savedTheme = localStorage.getItem('theme');
            if (savedTheme === 'dark') {
                document.body.classList.add('dark-mode');
                themeToggle.className = 'fas fa-sun';
            }
        }

        // Load voice preference
        if (voiceToggle) {
            if (isVoiceEnabled) {
                voiceToggle.style.color = '#28a745';
            }
        }

        // Load chat history
        loadChatHistory();
    }

    // Set up event listeners
    if (sendButton) {
        sendButton.addEventListener('click', sendMessage);
    }

    if (messageInput) {
        messageInput.addEventListener('keypress', function (e) {
            if (e.key === 'Enter') {
                sendMessage();
            }
        });
    }

    // Handle clicking on question items
    if (questionItems && questionItems.length > 0) {
        questionItems.forEach(item => {
            item.addEventListener('click', function () {
                if (messageInput) {
                    messageInput.value = this.textContent;
                    sendMessage();
                }

                // Close sidebar on mobile
                document.body.classList.remove('sidebar-open');
            });
        });
    }

    // Handle clicking on suggestions
    if (suggestions && suggestions.length > 0) {
        suggestions.forEach(suggestion => {
            suggestion.addEventListener('click', function () {
                if (messageInput) {
                    messageInput.value = this.textContent;
                    sendMessage();
                }
            });
        });
    }

    // Theme toggle
    if (themeToggle) {
        themeToggle.addEventListener('click', toggleTheme);
    }

    // Voice toggle
    if (voiceToggle) {
        voiceToggle.addEventListener('click', toggleVoice);
    }

    // Mic button
    if (micButton) {
        micButton.addEventListener('click', toggleMic);
    }

    // Clear chat
    if (clearChat) {
        clearChat.addEventListener('click', function () {
            if (confirm('Are you sure you want to clear the chat history?')) {
                clearChatHistory();
            }
        });
    }

    // Attachment button (placeholder functionality)
    if (attachmentBtn) {
        attachmentBtn.addEventListener('click', function () {
            alert('Attachment feature will be available in the next update!');
        });
    }

    // Mobile sidebar toggle
    const sidebarToggle = document.getElementById('minimize-sidebar');
    const closeSidebar = document.getElementById('close-sidebar');

    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', function () {
            document.body.classList.toggle('sidebar-open');
        });
    }

    if (closeSidebar) {
        closeSidebar.addEventListener('click', function () {
            document.body.classList.remove('sidebar-open');
        });
    }

    // Help button functionality
    const helpBtn = document.querySelector('.help-btn');
    if (helpBtn) {
        helpBtn.addEventListener('click', function () {
            document.body.classList.add('sidebar-open');
        });
    }

    // Initialize preferences and setup
    loadPreferences();

    // Make sure we have voices loaded (fixes issue in some browsers)
    if (speechSynthesis) {
        speechSynthesis.onvoiceschanged = function () {
            // Voices are now loaded
        };
    }

    // Focus input on page load
    if (messageInput) {
        messageInput.focus();
    }
});