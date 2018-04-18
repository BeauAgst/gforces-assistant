const keySize = 256;
const iterations = 100;

const background = {

    init() {
        chrome.runtime.onInstalled.addListener((details) => {
            if (details.reason === 'install') {
                const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
                let passphrase = '';

                for (let i = 0; i < 32; i++) {
                    passphrase += possible.charAt(Math.floor(Math.random() * possible.length));
                }

                chrome.storage.local.set({
                    passphrase,
                });
            }
        });
    },

    save(data) {
        const dataOptions = {};
        dataOptions[data.label] = data.value;
        chrome.storage.local.set(dataOptions);
    },

    get(data) {
        const setting = data.label;
        return new Promise(((resolve) => {
            chrome.storage.local.get(setting, (result) => {
                resolve(result);
            });
        }));
    },

    openTab(data) {
        chrome.tabs.create({ url: data.url });
    },

    scrape() {
        const getDOM = () => {
            const pageUrl = window.location.hostname;
            const pageHead = document.head.innerHTML;
            const pageDOM = document.body.innerHTML;
            const bodyClassList = document.body.classList;
            const data = {
                url: pageUrl,
                head: pageHead,
                body: pageDOM,
                bodyClassList: [...bodyClassList],
            };

            return data;
        };

        return new Promise((resolve) => {
            chrome.tabs.executeScript({
                code: `(${getDOM})();`,
            }, (data) => {
                resolve(data);
            });
        });
    },

    encrypt(msg, pass) {
        const salt = CryptoJS.lib.WordArray.random(128 / 8);
        const key = CryptoJS.PBKDF2(pass, salt, {
            keySize: keySize / 32,
            iterations,
        });
        const iv = CryptoJS.lib.WordArray.random(128 / 8);
        const encrypted = CryptoJS.AES.encrypt(msg, key, {
            iv,
            padding: CryptoJS.pad.Pkcs7,
            mode: CryptoJS.mode.CBC,
        });
        const transitmessage = salt.toString() + iv.toString() + encrypted.toString();

        return transitmessage;
    },

    decrypt(transitmessage, pass) {
        const salt = CryptoJS.enc.Hex.parse(transitmessage.substr(0, 32));
        const iv = CryptoJS.enc.Hex.parse(transitmessage.substr(32, 32));
        const encrypted = transitmessage.substring(64);
        const key = CryptoJS.PBKDF2(pass, salt, {
            keySize: keySize / 32,
            iterations,
        });
        const decrypted = CryptoJS.AES.decrypt(encrypted, key, {
            iv,
            padding: CryptoJS.pad.Pkcs7,
            mode: CryptoJS.mode.CBC,
        });

        return decrypted;
    },

    setAuth(data) {
        this.get('passphrase')
            .then((result) => {
                const { passphrase } = result;
                const { username, password } = data;
                const encrypted = this.encrypt(password, passphrase);
                const userData = {
                    label: 'userData',
                    value: {
                        username,
                        password: encrypted,
                    },
                };
                this.save(userData);
            });
    },

    getAuth() {
        return new Promise(((resolve) => {
            this.get('passphrase')
                .then((data) => {
                    const { passphrase, userData } = data;
                    if (userData === undefined) return;
                    const { username, password: encrypted } = data.userData;
                    const decrypted = this.decrypt(encrypted, passphrase);
                    const authData = {};

                    authData.username = username;
                    authData.password = decrypted.toString(CryptoJS.enc.Utf8);
                    resolve(authData);
                });
        }));
    },
};

background.init();

chrome.runtime.onMessage.addListener((data, sender, sendResponse) => {
    switch (data.action) {
    case 'saveSetting':
        background.save(data);
        break;
    case 'getSetting':
        background.get(data).then((option) => {
            sendResponse(option);
        });
        break;
    case 'getPageData':
        background.scrape().then((DOM) => {
            sendResponse(DOM);
        });
        break;
    case 'openPage':
        background.openTab(data);
        break;
    case 'reloadPage':
        chrome.tabs.reload();
        break;
    case 'sendAuthData':
        background.setAuth(data);
        break;
    case 'getAuthData':
        background.getAuth().then((authData) => {
            sendResponse(authData);
        });
        break;
    case 'generateDropdown':
        chrome.tabs.executeScript({ file: 'js/v10/frontend/dropdown.js' });
        break;
    case 'checkSlashes':
        chrome.tabs.executeScript({ file: 'js/v10/frontend/checkSlashes.js' });
        break;
    case 'checkOverflow':
        chrome.tabs.executeScript({ file: 'js/v10/frontend/checkOverflow.js' });
        break;
    case 'inTemplateEditor':
        chrome.tabs.executeScript({ file: 'js/v10/backend/site-editor.js' });
        break;
    default:
        console.log('Error, no case found');
    }

    return true;
});
