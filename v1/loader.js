(function(window, document) {
  'use strict';

  const CONFIG = {
    API_URL: 'https://api.riskengine.dev/v1/api/risk',
    TIMEOUT: 1000, // Если не ответили за 1с - пропускаем юзера
    DEBUG: false
  };

  // Получаем ключ из data-атрибута: <script data-key="pk_live_xxx">
  const SCRIPT_TAG = document.currentScript;
  const PUBLIC_KEY = SCRIPT_TAG.getAttribute('data-key');
  
  if (!PUBLIC_KEY) {
    log('RiskEngine: Public key missing. Add data-key="pk_live_xxx"');
    return;
  }

  const RiskEngine = {
    token: null,
    
    init: function() {
      this.findForms();
      this.observeNewForms();
    },

    findForms: function() {
      // Ищем формы регистрации. Казино обычно ставят id="reg-form" или data-form="signup"
      const forms = document.querySelectorAll('form[id*="reg"], form[id*="signup"], form[data-form*="reg"]');
      forms.forEach(form => this.attachToForm(form));
    },

    observeNewForms: function() {
      // Для SPA типа React/Vue где формы рендерятся после загрузки
      const observer = new MutationObserver(() => this.findForms());
      observer.observe(document.body, { childList: true, subtree: true });
    },

    attachToForm: function(form) {
      if (form.dataset.riskEngineAttached) return;
      form.dataset.riskEngineAttached = 'true';
      
      form.addEventListener('submit', (e) => this.handleSubmit(e, form));
      log('RiskEngine: Attached to form', form);
    },

    handleSubmit: async function(e, form) {
      // Если токен уже есть - не чекаем второй раз
      if (this.token) {
        this.injectToken(form);
        return;
      }

      // Стопорим форму, но не дольше TIMEOUT
      e.preventDefault();
      e.stopPropagation();
      
      const submitBtn = form.querySelector('[type="submit"]');
      if (submitBtn) submitBtn.disabled = true;

      try {
        const payload = await this.buildPayload(form);
        const result = await this.apiCheck(payload);
        this.token = result.user_token;
        log('RiskEngine: Check complete', result);
      } catch (err) {
        log('RiskEngine: Check failed, passing through', err);
        // Если мы упали - не блочим регу казино. Это критично.
        this.token = 're_' + Date.now(); // Фейковый токен чтобы не упасть
      } finally {
        this.injectToken(form);
        if (submitBtn) submitBtn.disabled = false;
        // Триггерим submit еще раз, уже с токеном
        HTMLFormElement.prototype.submit.call(form);
      }
    },

    buildPayload: async function(form) {
      const formData = new FormData(form);
      const email = formData.get('email') || formData.get('mail') || '';
      
      // 1. Собираем фингерпринт. Юзаем легкую либу.
      const device_hash = await this.getDeviceHash();
      
      // 2. Хешируем email чтобы не слать PII в открытом виде
      const email_hash = email ? await this.sha256(email.toLowerCase().trim()) : null;

      return {
        public_key: PUBLIC_KEY,
        device_hash: device_hash,
        email_hash: email_hash,
        url: window.location.href,
        ref: document.referrer,
        ts: Date.now(),
        // Автоматические флаги
        webdriver: navigator.webdriver || false,
        lang: navigator.language,
        tz_offset: new Date().getTimezoneOffset()
      };
    },

    getDeviceHash: async function() {
      // Легкий фингерпринт без тяжелых либ. Canvas + screen + timezone
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      ctx.textBaseline = 'top';
      ctx.font = '14px Arial';
      ctx.fillText('riskengine', 2, 2);
      const canvas_fp = canvas.toDataURL();
      
      const data = [
        navigator.userAgent,
        screen.width + 'x' + screen.height,
        new Date().getTimezoneOffset(),
        !!window.chrome,
        canvas_fp.slice(-50) // берем кусок base64
      ].join('::');
      
      return this.sha256(data);
    },

    sha256: async function(str) {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
      return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
    },

    apiCheck: function(payload) {
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', CONFIG.API_URL, true);
        xhr.setRequestHeader('Content-Type', 'application/json');
		xhr.setRequestHeader('X-API-KEY', 'ck_live_7gZ0zYG2-f8OwXYNUSBjlT3JQdsz5kEnMFahJvXjzDw');
        xhr.timeout = CONFIG.TIMEOUT;
        
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(JSON.parse(xhr.responseText));
          } else {
            reject(xhr.statusText);
          }
        };
        xhr.onerror = () => reject('Network error');
        xhr.ontimeout = () => reject('Timeout');
        
        xhr.send(JSON.stringify(payload));
      });
    },

    injectToken: function(form) {
      let input = form.querySelector('input[name="risk_token"]');
      if (!input) {
        input = document.createElement('input');
        input.type = 'hidden';
        input.name = 'risk_token';
        form.appendChild(input);
      }
      input.value = this.token;
    }
  };

  function log(...args) {
    if (CONFIG.DEBUG || window.location.search.includes('risk_debug=1')) {
      console.log(...args);
    }
  }

  // Запуск
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => RiskEngine.init());
  } else {
    RiskEngine.init();
  }

})(window, document);