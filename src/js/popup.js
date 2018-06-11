const popup = {
    devMode: false,
    buckets: {
        'nd-auto-gmme-styles-temp-production': 'GMME',
        'nd-auto-styles-temp-jardinev10-production': 'Jardine',
        'nd-auto-styles-temp-jlr-production-2': 'JLR China',
        'nd-auto-styles-temp-jlr-euwest1-production': 'JLR EU',
        'nd-auto-temp-styles-jlr-japan-production': 'JLR Japan',
        'nd-auto-styles-temp-marshall-production': 'Marshalls',
        'nd-auto-styles-temp-mazda-production': 'Mazda',
        'nd-auto-styles-temp-mercedesuvl-production': 'Mercedes UVL',
        'nd-auto-styles-temp-subaru-production': 'Subaru',
        'nd-auto-styles-temp-production': 'V10',
        'nd-auto-styles-temp-titan-production': 'V10 Australia',
        'nd-auto-styles-temp-vauxhall-production': 'Vauxhall',
    },

    async init() {
        this.modal();
        this.getToggles();

        const data = await this.checkPage();
        this.checkLogIn(data.url)
            .then(() => {
                this.checkSplit(data);
                this.getDeploy(data.url)
                    .then((whiteLabel) => {
                        this.checkDevMode(data, whiteLabel);
                    });
                this.setDevMode(data.url);
                this.buttons(data.url);
                this.dropdownButton();
                this.trailingSlashes();
                this.checkOverflow();
                this.getPageId(data);
                this.darkTheme();
            })
            .catch(() => {
                this.loginFailure();
            });
    },

    parseHTML(str) {
        const tmp = document.implementation.createHTMLDocument();
        tmp.body.innerHTML = str;
        return tmp.body;
    },

    checkPage() {
        const isOnND = '<link href="https://images.netdirector.co.uk" rel="preconnect">';
        return new Promise(((resolve) => {
            chrome.runtime.sendMessage({ action: 'getPageData' }, (data) => {
                const DOMBody = data[0].head;
                if (DOMBody.indexOf(isOnND) === -1) return;
                resolve(data[0]);
            });
        }));
    },

    loginFailure() {
        let shouldLogin = false;
        V10settings.get('autoLogin')
            .then((setting) => {
                if (!setting) return;
                shouldLogin = true;
            })
            .then(() => {
                if (!shouldLogin) return;
                V10settings.get('loginFailed')
                    .then((setting) => {
                        if (setting || setting === undefined) {
                            const loginFailed = document.querySelector('.login-failed');
                            loginFailed.style.display = 'block';

                            loginFailed.querySelector('.btn').addEventListener('click', (e) => {
                                e.preventDefault();
                                loginFailed.remove();
                            });
                        }
                    });
            });
    },

    checkLogIn(hostname) {
        return new Promise((resolve, reject) => {
            const request = new XMLHttpRequest();
            request.open('GET', `http://${hostname}/backend/`, true);
            request.onload = () => {
                if (request.status >= 200 && request.status < 400) {
                    const html = this.parseHTML(request.responseText);
                    const error = html.querySelector('#login-form');
                    if (error) {
                        reject();
                        return;
                    }
                    document.querySelector('.backend').style.display = 'block';
                    resolve();
                } else {
                    reject();
                }
            };
            request.send();
        });
    },

    getToggles() {
        const toggles = document.querySelectorAll('.switch');

        toggles.forEach((toggle) => {
            const { option } = toggle.dataset;
            if (!option) return;
            this.setToggle(toggle);
            this.clickToggle(toggle);
        });
    },

    setToggle(el) {
        const setting = el.dataset.option;
        V10settings.get(setting).then((result) => {
            if (!result) return;
            el.setAttribute('enabled', result);
            el.classList.add('checked');
        });
    },

    clickToggle(el) {
        el.addEventListener('click', () => {
            el.classList.toggle('checked');
            const isActive = el.classList.contains('checked');
            const { option } = el.dataset;
            if (!option) return;

            el.setAttribute('enabled', isActive);

            chrome.runtime.sendMessage({
                action: 'saveSetting',
                label: option,
                value: isActive,
            });
        });
    },

    checkSplit(data) {
        if (!data.body.includes('vwo_loaded')) return;
        const splitAlert = document.querySelector('.backend .splitTests');
        splitAlert.classList.add('active');
    },

    trailingSlashes() {
        const button = document.querySelector('.trailing-slashes .btn');
        button.addEventListener('click', (e) => {
            e.preventDefault();
            chrome.runtime.sendMessage({
                action: 'checkSlashes',
            });
        });
    },

    checkOverflow() {
        const button = document.querySelector('.overflow-elements .btn');
        button.addEventListener('click', (e) => {
            e.preventDefault();
            chrome.runtime.sendMessage({
                action: 'checkOverflow',
            });
        });
    },

    getPageId(data) {
        const theId = Array.from(data.bodyClassList).find(cls => cls.startsWith('id-'));
        document.querySelector('.page-id').innerHTML = theId;
    },

    darkTheme() {
        var cb = document.getElementById('darkThemeCheck');
        var page = document.getElementById('pageWrap');
        
        var checked = function(bool) {
            if (bool) {
                page.setAttribute('class', 'dark');
                localStorage.setItem('checkedDark', true);
            } else {
                page.removeAttribute('class', 'dark');
                localStorage.removeItem('checkedDark');
            }
        }
        
        cb.addEventListener('change', function () {
            checked(cb.checked);
        }); 
        
        cb.checked = localStorage.getItem('checkedDark');
        checked(localStorage.getItem('checkedDark'));

    },

    getDeploy(hostname) {
        return new Promise((resolve) => {
            const request = new XMLHttpRequest();
            request.open('GET', `http://${hostname}/backend/assets/`, true);
            request.onload = () => {
                if (request.status >= 200 && request.status < 400) {
                    const response = request.responseText;
                    const html = this.parseHTML(response);
                    const date = html.querySelector('#Site_assets_path option[selected=selected]');
                    const url = html.querySelector('.nd-widget-box .alert-info').innerHTML;
                    const hash = url.split('/').slice(-1)[0];
                    const bucket = Object.keys(this.buckets).filter(string => url.includes(string));

                    document.querySelector('.backendBucket').innerHTML = this.buckets[bucket];
                    document.querySelector('.backendHash').innerHTML = hash === 'white-label' ? 'No hash set' : hash;
                    if (date) document.querySelector('.timestamp').innerHTML = date.innerHTML;
                    resolve(hash === 'white-label');
                }
            };

            request.send();
        });
    },

    modal() {
        const options = document.querySelector('.options');
        const modal = document.querySelector('.modal');
        const confirm = document.querySelector('.modal .btn.confirm');
        const cancel = document.querySelector('.modal .btn.cancel');
        const input = document.querySelector('.modal input.password');

        options.addEventListener('click', (e) => {
            e.preventDefault();
            modal.style.display = 'block';
        });

        input.addEventListener('keypress', (event) => {
            const keypress = event.keyCode || event.which;
            if (keypress !== 13) return;
            modal.style.display = '';
            this.sendAuth();
        });

        confirm.addEventListener('click', (e) => {
            e.preventDefault();

            modal.style.display = '';
            this.sendAuth();
        });

        cancel.addEventListener('click', (e) => {
            e.preventDefault();
            modal.style.display = '';
            input.value = '';
        });
    },

    sendAuth() {
        const username = document.querySelector('.modal input.username').value;
        const password = document.querySelector('.modal input.password').value;

        chrome.runtime.sendMessage({
            action: 'sendAuthData',
            username,
            password,
        });
    },

    buttons(hostname) {
        const buttons = document.querySelectorAll('.btn');

        buttons.forEach((button) => {
            const dataPath = button.dataset.path;
            if (!dataPath) return;
            button.href = `http://${hostname}${dataPath}`;
        });
    },

    dropdownButton() {
        const button = document.querySelector('.sprite .btn');

        button.addEventListener('click', () => {
            chrome.runtime.sendMessage({
                action: 'generateDropdown',
            });
        });
    },

    checkDevMode(data, whiteLabel) {
        const tempBucket = data.head.match(/<link.+temp-[^"]+/g);
        if (!tempBucket) return;
        const toggle = document.querySelector('.devmode.switch');

        if (!whiteLabel) {
            toggle.classList.add('checked');
            toggle.setAttribute('enabled', true);
            this.devMode = true;
        }
    },

    setDevMode(hostname) {
        const toggle = document.querySelector('.devmode.switch');

        toggle.addEventListener('click', () => {
            this.devMode = toggle.getAttribute('enabled') === 'true'; // Convert string to boolean
            const request = new XMLHttpRequest();
            request.open('GET', `http://${hostname}/backend/assets/set-development-mode?mode=${!this.devMode}`, true);
            request.onload = () => {
                if (request.status >= 200 && request.status < 400) {
                    toggle.setAttribute('enabled', !this.devMode);
                    toggle.classList.toggle('checked');
                    chrome.runtime.sendMessage({
                        action: 'reloadPage',
                    });
                }
            };
            request.send();
        });
    },
};

popup.init();
