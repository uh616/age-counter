(function() {
    if (document.querySelector('.age-tracker-widget')) {
        return;
    }

    let settings = {};
    let isMinimized = false;
    let intervalId;
    const msInYear = 365.25 * 24 * 60 * 60 * 1000;

    const widget = document.createElement('div');
    widget.classList.add('age-tracker-widget');

    const header = document.createElement('div');
    header.classList.add('age-tracker-widget-header');
    header.textContent = '::';

    const content = document.createElement('div');
    content.classList.add('age-tracker-widget-content');
    const ageLabel = document.createElement('div');
    ageLabel.classList.add('age-label');
    ageLabel.textContent = 'Age';
    const integerPartSpan = document.createElement('span');
    integerPartSpan.classList.add('integer-part');
    const fractionalPartSpan = document.createElement('span');
    fractionalPartSpan.classList.add('fractional-part');
    content.appendChild(ageLabel);
    content.appendChild(integerPartSpan);
    content.appendChild(fractionalPartSpan);

    const minimizedContent = document.createElement('div');
    minimizedContent.classList.add('age-tracker-minimized-content');
    const minimizedAgeLabel = document.createElement('div');
    minimizedAgeLabel.classList.add('minimized-age-label');
    minimizedAgeLabel.textContent = 'Age';
    const minimizedIntegerSpan = document.createElement('div');
    minimizedIntegerSpan.classList.add('minimized-integer');
    minimizedContent.appendChild(minimizedAgeLabel);
    minimizedContent.appendChild(minimizedIntegerSpan);

    widget.appendChild(header);
    widget.appendChild(content);
    widget.appendChild(minimizedContent);
    document.body.appendChild(widget);

    let isDragging = false;
    let wasDragged = false;
    let startX, startY;

    function clamp(value, min, max) {
        return Math.min(Math.max(value, min), max);
    }

    header.addEventListener('mousedown', (e) => {
        isDragging = true;
        wasDragged = false;
        const rect = widget.getBoundingClientRect();
        startX = e.clientX - rect.left;
        startY = e.clientY - rect.top;
        header.style.cursor = 'grabbing';
        document.body.style.userSelect = 'none';
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        wasDragged = true;
        e.preventDefault();
        
        let newX = e.clientX - startX;
        let newY = e.clientY - startY;

        const viewWidth = window.innerWidth;
        const viewHeight = window.innerHeight;
        const widgetWidth = widget.offsetWidth;
        const widgetHeight = widget.offsetHeight;

        newX = clamp(newX, 0, viewWidth - widgetWidth);
        newY = clamp(newY, 0, viewHeight - widgetHeight);
        
        widget.style.left = `${newX}px`;
        widget.style.top = `${newY}px`;
        widget.style.right = 'auto';
        widget.style.bottom = 'auto';
    });

    document.addEventListener('mouseup', (e) => {
        if (isDragging) {
            isDragging = false;
            header.style.cursor = 'grab';
            document.body.style.userSelect = '';

            const rect = widget.getBoundingClientRect();
            const position = {
                left: (rect.left / window.innerWidth) * 100,
                top: (rect.top / window.innerHeight) * 100
            };
            chrome.storage.sync.set({ widgetPositionPercentage: position });
        }
    });

    header.addEventListener('click', (e) => {
        if (wasDragged) return;
        isMinimized = !isMinimized;
        widget.classList.toggle('minimized', isMinimized);
    });

    function setPosition(position) {
        if (position && typeof position.left === 'number' && typeof position.top === 'number') {
            const viewWidth = window.innerWidth;
            const viewHeight = window.innerHeight;
            
            let newX = (position.left / 100) * viewWidth;
            let newY = (position.top / 100) * viewHeight;
            
            // Загружаем виджет, но проверяем, чтобы он не выходил за рамки
            const widgetWidth = widget.offsetWidth || 150; // Примерная ширина по умолчанию
            const widgetHeight = widget.offsetHeight || 70; // Примерная высота

            newX = clamp(newX, 0, viewWidth - widgetWidth);
            newY = clamp(newY, 0, viewHeight - widgetHeight);
            
            widget.style.left = `${newX}px`;
            widget.style.top = `${newY}px`;
        } else {
            widget.style.right = '20px';
            widget.style.bottom = '20px';
            widget.style.left = 'auto';
            widget.style.top = 'auto';
        }
    }
    
    window.addEventListener('resize', () => {
        chrome.storage.sync.get('widgetPositionPercentage', ({ widgetPositionPercentage }) => {
            setPosition(widgetPositionPercentage);
        });
    });

    function applySettings(newSettings, position) {
        settings = newSettings;
        setPosition(position);
        
        if (settings.fontUrl) {
            const fontId = 'custom-age-tracker-font';
            let fontLink = document.getElementById(fontId);
            if (!fontLink) {
                fontLink = document.createElement('link');
                fontLink.id = fontId;
                fontLink.rel = 'stylesheet';
                document.head.appendChild(fontLink);
            }
            fontLink.href = settings.fontUrl;
            [content, minimizedContent].forEach(el => {
                el.style.fontFamily = `'${getFontNameFromUrl(settings.fontUrl)}', "Roboto Mono", "Courier New", Courier, monospace`;
            });
        } else {
             [content, minimizedContent].forEach(el => {
                el.style.fontFamily = `"Roboto Mono", "Courier New", Courier, monospace`;
            });
        }

        widget.style.color = settings.textColor || '#00FF7F';

        if (settings.birthdate) {
            widget.style.display = 'block';
            startCounter();
        } else {
            widget.style.display = 'none';
        }
    }

    function getFontNameFromUrl(url) {
        try {
            const fontName = new URL(url).searchParams.get('family');
            return fontName.split(':')[0].replace(/\+/g, ' ');
        } catch (e) {
            return 'Roboto Mono'; 
        }
    }

    function startCounter() {
        if (intervalId) clearInterval(intervalId);

        function updateAge() {
            const now = new Date();
            const durationMs = now.getTime() - new Date(settings.birthdate).getTime();
            const age = durationMs / msInYear;
            const ageString = age.toFixed(9);
            const parts = ageString.split('.');
            
            integerPartSpan.textContent = parts[0];
            fractionalPartSpan.textContent = `.${parts[1]}`;
            minimizedIntegerSpan.textContent = parts[0];
        }
        updateAge();
        intervalId = setInterval(updateAge, 50);
    }

    function initialize() {
        chrome.storage.sync.get(['birthdate', 'textColor', 'fontUrl', 'widgetPositionPercentage'], (result) => {
            applySettings(result, result.widgetPositionPercentage);
        });
    }

    chrome.storage.onChanged.addListener((changes, namespace) => {
        initialize();
    });

    initialize();
})();