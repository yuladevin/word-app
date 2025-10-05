document.addEventListener('DOMContentLoaded', () => {
    // === DOM Elements ===
    const mainTitle = document.getElementById('main-title');
    const mainDescription = document.getElementById('main-description');
    const wordGrid = document.getElementById('word-grid');
    const userSelect = document.getElementById('user-select');
    const levelFilter = document.getElementById('level-filter');
    const knownFilter = document.getElementById('known-filter');
    const rateControl = document.getElementById('rate-control');

    // === Global State ===
    let allWords = [];
    let currentUser = 'user1';
    let knownWords = new Set();
    
    // === Speech Synthesis ===
    const synth = window.speechSynthesis;
    let voices = [];
    function loadVoices() { voices = synth.getVoices(); }
    loadVoices();
    if (synth.onvoiceschanged !== undefined) { synth.onvoiceschanged = loadVoices; }

    function speakWord(text) {
        if (synth.speaking) { synth.cancel(); }
        if (text) {
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.voice = voices.find(voice => voice.name === 'Google US English') || voices.find(voice => voice.lang === 'en-US');
            utterance.lang = 'en-US';
            utterance.pitch = 1;
            utterance.rate = parseFloat(rateControl.value);
            synth.speak(utterance);
        }
    }

    // === Event Listeners ===
    wordGrid.addEventListener('click', (event) => {
        const clickedButton = event.target.closest('button');
        if (!clickedButton) return;
        const card = event.target.closest('.word-card');
        if (!card) return;

        if (clickedButton.classList.contains('known-button')) {
            const wordId = parseInt(card.dataset.wordId, 10);
            toggleKnownStatus(wordId);
        } else if (clickedButton.classList.contains('speak-button')) {
            const wordToSpeak = clickedButton.dataset.word;
            speakWord(wordToSpeak);
        } else if (clickedButton.classList.contains('youglish-button')) {
            // --- שינוי הלוגיקה כאן ---
            // במקום לפתוח פופאפ, פותחים לשונית חדשה
            const wordForYouglish = clickedButton.dataset.word;
            const youglishUrl = `https://youglish.com/pronounce/${encodeURIComponent(wordForYouglish)}/english`;
            window.open(youglishUrl, '_blank');
        }
    });
    
    // App Initialization
    async function initializeApp() {
        userSelect.addEventListener('change', handleUserChange);
        levelFilter.addEventListener('change', renderFilteredWords);
        knownFilter.addEventListener('change', renderFilteredWords);

        try {
            const [gameWordsRes, levelWordsRes, generalDataRes] = await Promise.all([
                fetch('data/gameWords.json'),
                fetch('data/levelwords.json'),
                fetch('data/generalExternalData.json')
            ]);
            const gameWords = await gameWordsRes.json();
            const levelWords = await levelWordsRes.json();
            const generalData = await generalDataRes.json();
            
            const combinedWords = [...gameWords, ...levelWords];
            const uniqueWordsMap = new Map();
            combinedWords.forEach(word => { if (!uniqueWordsMap.has(word.id)) { uniqueWordsMap.set(word.id, word); } });
            allWords = Array.from(uniqueWordsMap.values());

            updateHeader(generalData);
            loadUserState();
            renderFilteredWords();
        } catch (error) {
            console.error("שגיאה בטעינת הנתונים:", error);
            mainTitle.textContent = "אופס! קרתה שגיאה";
        }
    }

    // Update Header
    function updateHeader(data) {
        mainTitle.textContent = data.externalName;
        mainDescription.textContent = data.descriptionHeaderContent;
    }

    // Filter and Render Words
    function renderFilteredWords() {
        const selectedLevel = levelFilter.value;
        const knownStatus = knownFilter.value;
        let filteredByLevel = allWords.filter(word => selectedLevel === 'all' || word.level.toString() === selectedLevel);
        let finalFilteredWords;
        if (knownStatus === 'new') {
            finalFilteredWords = filteredByLevel.filter(word => !knownWords.has(word.id));
        } else if (knownStatus === 'known') {
            finalFilteredWords = filteredByLevel.filter(word => knownWords.has(word.id));
        } else {
            finalFilteredWords = filteredByLevel;
        }
        displayWords(finalFilteredWords);
    }

    // Display Cards
    function displayWords(wordsToDisplay) {
        wordGrid.innerHTML = '';
        wordsToDisplay.forEach(word => {
            const card = document.createElement('div');
            const isKnown = knownWords.has(word.id);
            card.className = 'word-card';
            if (isKnown) { card.classList.add('known'); }
            card.dataset.wordId = word.id;
            card.innerHTML = `
                <h2>
                    <span class="word-text">${word.value}</span>
                    <button class="speak-button" data-word="${word.value}" title="השמעת המילה">🔊</button>
                    <span class="word-level">רמה ${word.level}</span>
                </h2>
                <p class="meaning">${word.meaning}</p>
                <p class="example">"${word.exampleSentence}"</p>
                <div class="card-actions">
                    <button class="known-button">${isKnown ? 'לסמן כחדשה' : 'אני יודע/ת'}</button>
                    <button class="youglish-button" data-word="${word.value}">▶️ YouGlish</button>
                </div>
            `;
            wordGrid.appendChild(card);
        });
    }

    // Toggle Known Status
    function toggleKnownStatus(wordId) {
        const card = wordGrid.querySelector(`[data-word-id="${wordId}"]`);
        if (!card) return;
        const button = card.querySelector('.known-button');
        if (knownWords.has(wordId)) { knownWords.delete(wordId); } 
        else { knownWords.add(wordId); }
        saveUserState();
        const isNowKnown = knownWords.has(wordId);
        card.classList.toggle('known', isNowKnown);
        button.textContent = isNowKnown ? 'לסמן כחדשה' : 'אני יודע/ת';
    }

    // User State Management
    function handleUserChange(event) {
        currentUser = event.target.value;
        localStorage.setItem('wordApp_currentUser', currentUser);
        loadUserState();
        renderFilteredWords();
    }
    function saveUserState() {
        try {
            localStorage.setItem(`wordApp_${currentUser}_knownWords`, JSON.stringify(Array.from(knownWords)));
        } catch (error) {
            console.error("לא ניתן לשמור שינויים:", error);
            alert("לא ניתן לשמור את ההתקדמות. ייתכן שאחסון הדפדפן מלא.");
        }
    }
    function loadUserState() {
        const savedUser = localStorage.getItem('wordApp_currentUser');
        if (savedUser) {
            currentUser = savedUser;
            userSelect.value = currentUser;
        }
        const savedWords = localStorage.getItem(`wordApp_${currentUser}_knownWords`);
        if (savedWords) {
            knownWords = new Set(JSON.parse(savedWords));
        } else {
            knownWords = new Set();
        }
    }

    // Run the app
    initializeApp();
});