function injectScripts(tabId) {
    // Убеждаемся, что не внедряем скрипты повторно, если они уже есть
    // (на случай, если события сработают несколько раз).
    chrome.scripting.executeScript({
        target: { tabId: tabId },
        func: () => document.querySelector('.age-tracker-widget') !== null,
    }).then(results => {
        if (!results[0].result) { // Если виджета еще нет
            // Внедряем CSS
            chrome.scripting.insertCSS({
                target: { tabId: tabId },
                files: ['content.css']
            }).catch(err => console.log('AgeTracker Error injecting CSS:', err));
    
            // Внедряем JavaScript
            chrome.scripting.executeScript({
                target: { tabId: tabId },
                files: ['content.js']
            }).catch(err => console.log('AgeTracker Error injecting JS:', err));
        }
    });
}

// Этот слушатель срабатывает, когда страница полностью загрузилась (включая картинки)
chrome.webNavigation.onCompleted.addListener((details) => {
    // Внедряем скрипт только в основной фрейм (не в iframe)
    // и только для http/https протоколов.
    if (details.frameId === 0 && details.url.startsWith('http')) {
        injectScripts(details.tabId);
    }
});

// Этот слушатель срабатывает при навигации внутри одной страницы
// (актуально для YouTube, Gmail и т.д.), когда меняется URL без перезагрузки.
chrome.webNavigation.onHistoryStateUpdated.addListener((details) => {
    if (details.frameId === 0 && details.url.startsWith('http')) {
        injectScripts(details.tabId);
    }
});