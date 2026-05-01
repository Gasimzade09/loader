(function() {
  'use strict';

  var script = document.currentScript || document.querySelector('script[data-key]');
  if (!script) return;

  var publicKey = script.getAttribute('data-key');
  var debug = script.getAttribute('data-debug') === '1';

  if (!publicKey) {
    console.error('RiskEngine: data-key is missing');
    return;
  }

  // Поля которые не шлем на бэк
  var SENSITIVE_FIELDS = ['password', 'passwd', 'pass', 'pwd', 'cardnumber', 'card_number', 'cvv', 'cvc', 'secret'];

  function toCamelCase(str) {
    return str.replace(/_([a-z])/g, function(g) { return g[1].toUpperCase(); });
  }

  function isSensitiveField(name) {
    var lower = name.toLowerCase();
    return SENSITIVE_FIELDS.some(function(field) {
      return lower.includes(field);
    });
  }

  function getDeviceType() {
    var ua = navigator.userAgent;
    if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) return "tablet";
    if (/Mobile|iP(hone|od)|Android|BlackBerry|IEMobile|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(ua)) return "mobile";
    return "desktop";
  }

  function collectFormData(form) {
    var data = {};
    var formData = new FormData(form);

    formData.forEach(function(value, key) {
      if (isSensitiveField(key)) {
        if (debug) console.log('RiskEngine: Skipping sensitive field', key);
        return; // Не добавляем пароль и карты в payload
      }
      var camelKey = toCamelCase(key);
      data[camelKey] = value;
    });

    // Браузер и система
    data.userAgent = navigator.userAgent;
    data.language = navigator.language;
    data.languages = navigator.languages;
    data.platform = navigator.platform;
    data.vendor = navigator.vendor;
    data.deviceType = getDeviceType();

    // Экран
    data.screenResolution = window.screen.width + 'x' + window.screen.height;
    data.screenColorDepth = window.screen.colorDepth;
    data.devicePixelRatio = window.devicePixelRatio || 1;
    data.viewportSize = window.innerWidth + 'x' + window.innerHeight;

    // Время и локаль
    data.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    data.timezoneOffset = new Date().getTimezoneOffset();
    data.timestamp = new Date().toISOString();

    // URL и реферер
    data.currentUrl = window.location.href;
    data.referrer = document.referrer || null;

    // Куки и хранилище
    data.cookiesEnabled = navigator.cookieEnabled;
    data.localStorageEnabled =!!window.localStorage;
    data.sessionStorageEnabled =!!window.sessionStorage;

    // Canvas fingerprint
    try {
      var canvas = document.createElement('canvas');
      var ctx = canvas.getContext('2d');
      ctx.textBaseline = 'top';
      ctx.font = '14px Arial';
      ctx.fillText('RiskEngine', 2, 2);
      data.canvasFingerprint = canvas.toDataURL().slice(-50);
    } catch (e) {
      data.canvasFingerprint = null;
    }

    return data;
  }

  function attachToForms() {
    var forms = document.querySelectorAll('form');
    if (debug) console.log('RiskEngine: Found forms', forms.length);

    forms.forEach(function(form) {
      if (form.dataset.riskEngineAttached) return;
      form.dataset.riskEngineAttached = '1';

      form.addEventListener('submit', function(e) {
        e.preventDefault();
        if (debug) console.log('RiskEngine: Form submit intercepted');

        var payload = collectFormData(form);
        if (debug) console.log('RiskEngine: Sending payload', payload);

        var xhr = new XMLHttpRequest();
        xhr.open('POST', 'https://api.riskengine.dev/v1/api/risk/check', true);
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.setRequestHeader('X-API-Key', 'ck_live_7gZ0zYG2-f8OwXYNUSBjlT3JQdsz5kEnMFahJvXjzDw');

        xhr.onreadystatechange = function() {
          if (xhr.readyState === 4) {
            if (debug) console.log('RiskEngine: Status', xhr.status);
            if (debug) console.log('RiskEngine: Response', xhr.responseText);

            if (xhr.status === 200) {
              try {
                var json = JSON.parse(xhr.responseText);
                var token = json.token || json.riskToken || json.risk_token;

                var tokenInput = form.querySelector('input[name="risk_token"]');
                if (!tokenInput) {
                  tokenInput = document.createElement('input');
                  tokenInput.type = 'hidden';
                  tokenInput.name = 'risk_token';
                  form.appendChild(tokenInput);
                }
                tokenInput.value = token || '';
                form.submit();
              } catch (err) {
                console.error('RiskEngine: JSON parse error', err);
                form.submit();
              }
            } else {
              console.error('RiskEngine: API error', xhr.status, xhr.responseText);
              form.submit();
            }
          }
        };

        xhr.onerror = function() {
          console.error('RiskEngine: Network error');
          form.submit();
        };

        xhr.send(JSON.stringify(payload));
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', attachToForms);
  } else {
    attachToForms();
  }

})();