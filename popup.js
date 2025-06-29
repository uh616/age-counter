const birthdateInput = document.getElementById('birthdate-input');
const colorInput = document.getElementById('color-input');
const fontUrlInput = document.getElementById('font-url-input');
const saveButton = document.getElementById('saveButton');
const statusDiv = document.getElementById('status');

// Загрузка сохраненных настроек при открытии окна.
document.addEventListener('DOMContentLoaded', () => {
    chrome.storage.sync.get(['birthdate', 'textColor', 'fontUrl'], (result) => {
        if (result.birthdate) birthdateInput.value = result.birthdate;
        if (result.textColor) colorInput.value = result.textColor;
        if (result.fontUrl) fontUrlInput.value = result.fontUrl;
    });
});

// Сохранение настроек.
saveButton.addEventListener('click', () => {
    const settings = {
        birthdate: birthdateInput.value,
        textColor: colorInput.value,
        fontUrl: fontUrlInput.value.trim()
    };
    chrome.storage.sync.set(settings, () => {
        statusDiv.textContent = 'Settings saved!';
        setTimeout(() => { statusDiv.textContent = ''; }, 2000);
    });
});