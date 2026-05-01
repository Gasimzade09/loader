(function() {
  'use strict';

  console.log('RiskEngine: Loader started');

  var script = document.currentScript || document.querySelector('script[data-key]');
  if (!script) {
    console.error('RiskEngine: script tag with data-key not found');
    return;
  }

  var publicKey = script.getAttribute('data-key');
  var debug = script.getAttribute('data-debug') === '1';

  if (!publicKey) {
    console.error('RiskEngine: data-key is missing');
    return;
  }

  if (debug) console.log('RiskEngine: Using key', publicKey);

  function attachToForms() {
    var forms = document.querySelectorAll('form');
    console.log('RiskEngine: Found forms', forms.length);

    forms.forEach(function(form, idx) {
      if (form.dataset.riskEngineAttached) return;
      form.dataset.riskEngineAttached = '1';

      console.log('RiskEngine: Attached to form', idx);

      form.addEventListener('submit', function(e) {
        e.preventDefault();
        console.log('RiskEngine: Form submit intercepted');

        var formData = new FormData(form);
        var data = {};
        formData.forEach(function(value, key) {
          data[key] = value;
        });

        if (debug) console.log('RiskEngine: Sending data', data);

        var xhr = new XMLHttpRequest();
        xhr.open('POST', 'https://api.riskengine.dev/v1/api/risk/check', true);
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.setRequestHeader('X-API-Key', publicKey);

        xhr.onreadystatechange = function() {
          if (xhr.readyState === 4) {
            console.log('RiskEngine: Status', xhr.status);
            console.log('RiskEngine: Response body', xhr.responseText);

            if (xhr.status === 200) {
              try {
                var json = JSON.parse(xhr.responseText);
                console.log('RiskEngine: Token received', json);

                var tokenInput = form.querySelector('input[name="risk_token"]');
                if (!tokenInput) {
                  tokenInput = document.createElement('input');
                  tokenInput.type = 'hidden';
                  tokenInput.name = 'risk_token';
                  form.appendChild(tokenInput);
                }
                tokenInput.value = json.token || json.risk_token || '';

                console.log('RiskEngine: Submitting form with token');
                form.submit();
              } catch (err) {
                console.error('RiskEngine: JSON parse error', err);
                form.submit();
              }
            } else {
              console.error('RiskEngine: Error', xhr.status, xhr.responseText);
              // Сабмитим форму даже при ошибке, чтобы не ломать юзеру регистрацию
              form.submit();
            }
          }
        };

        xhr.onerror = function() {
          console.error('RiskEngine: Network error');
          form.submit();
        };

        xhr.send(JSON.stringify(data));
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', attachToForms);
  } else {
    attachToForms();
  }

})();