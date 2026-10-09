/* =====================================================================
   Сайт психолога — скрипт (чистый JavaScript, без библиотек)

   ВЛАДЕЛЬЦУ: всё, что нужно настроить, находится в блоке CONFIG ниже.
   Содержание:
   1. CONFIG            2. Вспомогательные функции   3. Контакты и год
   4. Мобильное меню    5. Подсветка раздела          6. CTA-кнопки
   7. Валидация формы   8. Отправка формы (3 режима)
   ===================================================================== */

(function () {
  'use strict';

  /* ------------------------------------------------------------------
     1. CONFIG — ваши данные и режим работы формы
     ------------------------------------------------------------------ */
  var CONFIG = {
    // Показывайте только те каналы, которые действительно используете. Пустая строка = канал скрыт.
    contacts: {
      email: '',      // например: 'name@example.com'
      telegram: '',   // имя без @, например: 'username'
      whatsapp: '',   // номер цифрами с кодом страны, например: '70000000000'
      phone: ''       // например: '+70000000000'
    },

    // Адрес вашего собственного обработчика заявок (backend). Должен принимать POST с JSON.
    // Пока пусто — форма работает без сервера (см. ниже режимы).
    formEndpoint: '',

    // Таймаут запроса к серверу, мс
    requestTimeoutMs: 15000
  };

  /* ------------------------------------------------------------------
     2. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
     ------------------------------------------------------------------ */
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function digitsOnly(str) { return String(str).replace(/\D/g, ''); }

  /* ------------------------------------------------------------------
     3. КОНТАКТЫ В БЛОКАХ ЗАПИСИ/ПОДВАЛА И ТЕКУЩИЙ ГОД
     ------------------------------------------------------------------ */
  function buildContactLinks() {
    var c = CONFIG.contacts, items = [];
    if (c.email)    items.push({ label: 'Email: ' + c.email, href: 'mailto:' + c.email });
    if (c.telegram) items.push({ label: 'Telegram: @' + c.telegram.replace(/^@/, ''), href: 'https://t.me/' + c.telegram.replace(/^@/, ''), external: true });
    if (c.whatsapp) items.push({ label: 'WhatsApp: +' + digitsOnly(c.whatsapp), href: 'https://wa.me/' + digitsOnly(c.whatsapp), external: true });
    if (c.phone)    items.push({ label: 'Телефон: ' + c.phone, href: 'tel:' + c.phone.replace(/[^\d+]/g, '') });
    return items;
  }

  function renderContacts() {
    var items = buildContactLinks();
    if (!items.length) return; // остаются заглушки из HTML
    $$('[data-contact-list]').forEach(function (list) {
      list.textContent = '';
      items.forEach(function (it) {
        var li = document.createElement('li');
        var a = document.createElement('a');
        a.href = it.href;
        a.textContent = it.label;
        if (it.external) { a.target = '_blank'; a.rel = 'noopener noreferrer'; }
        li.appendChild(a);
        list.appendChild(li);
      });
    });
  }

  function setYear() {
    $$('[data-year]').forEach(function (el) { el.textContent = new Date().getFullYear(); });
  }

  /* ------------------------------------------------------------------
     4. МОБИЛЬНОЕ МЕНЮ
     ------------------------------------------------------------------ */
  var toggle = $('.menu-toggle');
  var nav = $('#site-nav');

  function setMenu(open) {
    if (!toggle || !nav) return;
    nav.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
  }

  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      setMenu(toggle.getAttribute('aria-expanded') !== 'true');
    });

    // Закрываем меню после выбора пункта
    $$('a', nav).forEach(function (a) {
      a.addEventListener('click', function () { setMenu(false); });
    });

    // Escape закрывает меню и возвращает фокус на кнопку
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
        setMenu(false);
        toggle.focus();
      }
    });

    // Клик вне меню
    document.addEventListener('click', function (e) {
      if (toggle.getAttribute('aria-expanded') === 'true' && !nav.contains(e.target) && !toggle.contains(e.target)) {
        setMenu(false);
      }
    });

    // При переходе на десктопную ширину сбрасываем состояние
    window.addEventListener('resize', function () {
      if (window.innerWidth > 900) setMenu(false);
    });
  }

  /* ------------------------------------------------------------------
     5. ПОДСВЕТКА АКТИВНОГО РАЗДЕЛА В МЕНЮ
     ------------------------------------------------------------------ */
  function initActiveNav() {
    if (!('IntersectionObserver' in window)) return;
    var links = $$('.nav__link');
    var map = {};
    links.forEach(function (a) { map[a.getAttribute('href').slice(1)] = a; });

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting && map[entry.target.id]) {
          links.forEach(function (l) { l.classList.remove('is-active'); l.removeAttribute('aria-current'); });
          map[entry.target.id].classList.add('is-active');
          map[entry.target.id].setAttribute('aria-current', 'true');
        }
      });
    }, { rootMargin: '-40% 0px -55% 0px' });

    Object.keys(map).forEach(function (id) {
      var section = document.getElementById(id);
      if (section) observer.observe(section);
    });
  }

  /* ------------------------------------------------------------------
     6. CTA-КНОПКИ: ведут к форме, подставляют выбранную услугу, ставят фокус
     ------------------------------------------------------------------ */
  var form = $('#booking-form');

  $$('[data-cta]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var service = btn.getAttribute('data-service');
      var select = $('#f-service');
      if (service && select) select.value = service;
      if (!form) return;
      // Небольшая задержка, чтобы фокус не прерывал плавную прокрутку
      window.setTimeout(function () {
        var first = $('#f-name');
        if (first) first.focus({ preventScroll: true });
      }, reduceMotion ? 0 : 500);
    });
  });

  /* ------------------------------------------------------------------
     7. ВАЛИДАЦИЯ ФОРМЫ
     ------------------------------------------------------------------ */
  if (!form) { renderContacts(); setYear(); initActiveNav(); return; }

  var fields = {
    name: $('#f-name'),
    method: $('#f-method'),
    contact: $('#f-contact'),
    consent: $('#f-consent')
  };
  var errorEls = {
    name: $('#err-name'),
    method: $('#err-method'),
    contact: $('#err-contact'),
    consent: $('#err-consent')
  };
  var hintContact = $('#hint-contact');
  var summary = $('#form-summary');
  var result = $('#form-result');
  var submitBtn = $('#form-submit');
  var submitLabel = $('.form__submit-label', submitBtn);
  var modeEl = $('#form-mode');
  var defaultLabel = submitLabel.textContent;

  var METHOD_INFO = {
    telegram: { hint: 'Например: @username или ссылка t.me/username', placeholder: '@username', inputmode: 'text' },
    whatsapp: { hint: 'Номер с кодом страны, например: +7 900 000-00-00', placeholder: '+7 900 000-00-00', inputmode: 'tel' },
    phone:    { hint: 'Номер с кодом страны, например: +7 900 000-00-00', placeholder: '+7 900 000-00-00', inputmode: 'tel' },
    email:    { hint: 'Например: name@example.com', placeholder: 'name@example.com', inputmode: 'email' }
  };

  var METHOD_LABEL = { telegram: 'Telegram', whatsapp: 'WhatsApp', phone: 'Телефон', email: 'Email' };

  /* Проверки по полям. Возвращают текст ошибки или '' если всё в порядке. */
  function validateName() {
    var v = fields.name.value.trim();
    if (!v) return 'Введите имя, чтобы я знал(а), как к вам обращаться.';
    if (v.length < 2) return 'Имя слишком короткое: минимум 2 символа.';
    return '';
  }

  function validateMethod() {
    return fields.method.value ? '' : 'Выберите удобный способ связи.';
  }

  function validateContact() {
    var v = fields.contact.value.trim();
    var m = fields.method.value;
    if (!v) return 'Укажите контакт для связи.';
    if (m === 'email') {
      return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) ? '' : 'Проверьте email: он должен выглядеть как name@example.com.';
    }
    if (m === 'telegram') {
      var clean = v.replace(/^https?:\/\/(www\.)?(t\.me|telegram\.me)\//i, '').replace(/^@/, '');
      return /^[A-Za-z][A-Za-z0-9_]{4,31}$/.test(clean) ? '' : 'Проверьте Telegram: имя пользователя — от 5 до 32 символов (латиница, цифры, «_»).';
    }
    if (m === 'phone' || m === 'whatsapp') {
      var d = digitsOnly(v);
      if (!/^[+\d\s()\-]+$/.test(v)) return 'В номере могут быть только цифры, пробелы, «+», скобки и дефис.';
      return d.length >= 10 && d.length <= 15 ? '' : 'Проверьте номер: должно быть от 10 до 15 цифр, включая код страны.';
    }
    return '';
  }

  function validateConsent() {
    return fields.consent.checked ? '' : 'Для отправки нужно подтвердить согласие на обработку данных.';
  }

  var validators = { name: validateName, method: validateMethod, contact: validateContact, consent: validateConsent };

  function showFieldError(key, message) {
    var input = fields[key], el = errorEls[key];
    if (message) {
      el.textContent = message;
      el.hidden = false;
      input.setAttribute('aria-invalid', 'true');
    } else {
      el.textContent = '';
      el.hidden = true;
      input.removeAttribute('aria-invalid');
    }
  }

  function validateField(key) {
    var msg = validators[key]();
    showFieldError(key, msg);
    return !msg;
  }

  function validateAll() {
    var invalid = [];
    Object.keys(validators).forEach(function (key) {
      if (!validateField(key)) invalid.push(key);
    });
    return invalid;
  }

  // Проверка «на лету»: после ухода с поля, и повторно при исправлении уже подсвеченной ошибки
  Object.keys(fields).forEach(function (key) {
    var input = fields[key];
    input.addEventListener('blur', function () {
      if (input.value || input.type === 'checkbox' || input.getAttribute('aria-invalid')) validateField(key);
    });
    input.addEventListener(input.type === 'checkbox' || input.tagName === 'SELECT' ? 'change' : 'input', function () {
      if (input.getAttribute('aria-invalid')) validateField(key);
    });
  });

  // Подсказка формата контакта зависит от выбранного способа связи
  fields.method.addEventListener('change', function () {
    var info = METHOD_INFO[fields.method.value];
    if (info) {
      hintContact.textContent = info.hint;
      fields.contact.placeholder = info.placeholder;
      fields.contact.setAttribute('inputmode', info.inputmode);
      fields.contact.type = fields.method.value === 'email' ? 'email' : 'text';
    } else {
      hintContact.textContent = 'Сначала выберите способ связи — подскажем формат.';
      fields.contact.placeholder = '';
    }
    if (fields.contact.value) validateField('contact');
  });

  /* ------------------------------------------------------------------
     8. ОТПРАВКА ФОРМЫ
     Три честных режима (выбираются автоматически по CONFIG):
       A) endpoint — отправка на ваш сервер (POST JSON). Нужен backend.
       B) mailto / Telegram — форма готовит текст и открывает почту или Telegram.
          Заявка уходит только когда пользователь сам отправит письмо/сообщение.
       C) demo — ничего не отправляется, это прямо сказано пользователю.
     ------------------------------------------------------------------ */
  var contacts = CONFIG.contacts;
  var mode = CONFIG.formEndpoint ? 'endpoint'
           : contacts.email ? 'email'
           : contacts.telegram ? 'telegram'
           : 'demo';

  var MODE_TEXT = {
    endpoint: 'Заявка будет отправлена напрямую специалисту.',
    email: 'Форма подготовит письмо в вашей почтовой программе. Заявка будет отправлена только после того, как вы отправите это письмо.',
    telegram: 'Форма подготовит текст заявки и откроет Telegram. Заявка будет отправлена только после того, как вы отправите сообщение.',
    demo: 'Демонстрационный режим: форма пока не подключена, данные никуда не отправляются. Подготовленный текст можно скопировать и отправить вручную.'
  };
  modeEl.textContent = MODE_TEXT[mode];

  function collectData() {
    var get = function (id) { return $('#' + id).value.trim(); };
    return {
      name: get('f-name'),
      method: fields.method.value,
      contact: get('f-contact'),
      format: get('f-format'),
      service: get('f-service'),
      comment: get('f-comment')
    };
  }

  function buildMessage(d) {
    var lines = [
      'Заявка на консультацию',
      '',
      'Имя: ' + d.name,
      'Способ связи: ' + (METHOD_LABEL[d.method] || d.method),
      'Контакт: ' + d.contact,
      'Формат: ' + d.format,
      'Интересует: ' + d.service
    ];
    if (d.comment) lines.push('Комментарий: ' + d.comment);
    lines.push('', 'Согласие на обработку персональных данных дано.');
    return lines.join('\n');
  }

  function setLoading(on) {
    submitBtn.disabled = on;
    submitBtn.classList.toggle('is-loading', on);
    submitBtn.setAttribute('aria-busy', String(on));
    submitLabel.textContent = on ? 'Отправляем' : defaultLabel;
  }

  function copyText(text, pre, button) {
    var done = function () { button.textContent = 'Скопировано'; };
    var fail = function () {
      // Запасной вариант: выделяем текст, пользователь копирует вручную
      var range = document.createRange();
      range.selectNodeContents(pre);
      var sel = window.getSelection();
      sel.removeAllRanges(); sel.addRange(range);
      button.textContent = 'Выделено — нажмите Ctrl+C';
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, fail);
    } else { fail(); }
  }

  /* Показывает блок результата. Весь текст вставляется через textContent (без innerHTML). */
  function showResult(state, title, body, messageText) {
    result.textContent = '';
    result.hidden = false;
    result.setAttribute('data-state', state);

    var strong = document.createElement('strong');
    strong.textContent = title;
    result.appendChild(strong);

    var p = document.createElement('p');
    p.textContent = body;
    result.appendChild(p);

    if (messageText) {
      var pre = document.createElement('pre');
      pre.textContent = messageText;
      result.appendChild(pre);

      var copy = document.createElement('button');
      copy.type = 'button';
      copy.className = 'btn btn--outline';
      copy.textContent = 'Скопировать текст заявки';
      copy.addEventListener('click', function () { copyText(messageText, pre, copy); });
      result.appendChild(copy);
    }

    // Если есть прямые контакты — предлагаем их как запасной путь
    var alt = buildContactLinks();
    if (alt.length && state === 'error') {
      var p2 = document.createElement('p');
      p2.textContent = 'Можно связаться напрямую: ' + alt.map(function (a) { return a.label; }).join('; ') + '.';
      result.appendChild(p2);
    }
  }

  function submitToEndpoint(data, text) {
    var controller = 'AbortController' in window ? new AbortController() : null;
    var timer = controller ? window.setTimeout(function () { controller.abort(); }, CONFIG.requestTimeoutMs) : null;

    setLoading(true);
    fetch(CONFIG.formEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      signal: controller ? controller.signal : undefined
    }).then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      showResult('success', 'Спасибо! Заявка отправлена.', 'Я свяжусь с вами по указанному контакту.');
      form.reset();
      hintContact.textContent = 'Сначала выберите способ связи — подскажем формат.';
    }).catch(function () {
      showResult('error', 'Не удалось отправить заявку.',
        'Проверьте соединение и попробуйте ещё раз. Вы также можете скопировать текст заявки и отправить его вручную.', text);
    }).then(function () {
      if (timer) window.clearTimeout(timer);
      setLoading(false);
      result.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'nearest' });
    });
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    result.hidden = true;

    var invalid = validateAll();
    if (invalid.length) {
      summary.textContent = 'Заявка не отправлена: исправьте ' + (invalid.length === 1 ? 'поле, отмеченное ошибкой.' : 'поля, отмеченные ошибками (' + invalid.length + ').');
      summary.hidden = false;
      fields[invalid[0]].focus();
      return;
    }
    summary.hidden = true;

    var data = collectData();
    var text = buildMessage(data);

    if (mode === 'endpoint') {
      submitToEndpoint(data, text);
      return;
    }

    if (mode === 'email') {
      var href = 'mailto:' + contacts.email +
        '?subject=' + encodeURIComponent('Заявка на консультацию') +
        '&body=' + encodeURIComponent(text);
      window.location.href = href;
      showResult('success', 'Письмо подготовлено — заявка ещё не отправлена.',
        'Если почтовая программа открылась, нажмите «Отправить» в ней. Если ничего не произошло, скопируйте текст и отправьте на ' + contacts.email + '.', text);
    } else if (mode === 'telegram') {
      var tg = contacts.telegram.replace(/^@/, '');
      copyToClipboardQuiet(text);
      window.open('https://t.me/' + tg, '_blank', 'noopener');
      showResult('success', 'Текст заявки подготовлен — заявка ещё не отправлена.',
        'Мы открыли чат в Telegram. Вставьте текст (он скопирован, если браузер разрешил) и отправьте сообщение. Если текст не скопировался, используйте кнопку ниже.', text);
    } else {
      showResult('demo', 'Демонстрационный режим: заявка не отправлена.',
        'Форма пока не подключена к почте, мессенджеру или серверу. Ниже — текст заявки, который можно отправить вручную.', text);
    }
    result.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'nearest' });
  });

  function copyToClipboardQuiet(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(function () { /* пользователь скопирует кнопкой */ });
    }
  }

  /* ------------------------------------------------------------------
     Инициализация
     ------------------------------------------------------------------ */
  renderContacts();
  setYear();
  initActiveNav();
})();
