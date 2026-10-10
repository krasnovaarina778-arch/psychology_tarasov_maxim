
(function () {
  'use strict';

  var CONFIG = {
    formEndpoint: '/api/appointments',
    requestTimeoutMs: 15000,
    contacts: {
      email: '',
      telegram: '',
      whatsapp: '',
      phone: ''
    }
  };

  var $ = function (selector, root) {
    return (root || document).querySelector(selector);
  };

  var $$ = function (selector, root) {
    return Array.prototype.slice.call(
      (root || document).querySelectorAll(selector)
    );
  };

  var reduceMotion = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function digitsOnly(value) {
    return String(value || '').replace(/\D/g, '');
  }

  function buildContactLinks() {
    var c = CONFIG.contacts;
    var items = [];

    if (c.email) {
      items.push({
        label: 'Email: ' + c.email,
        href: 'mailto:' + c.email
      });
    }

    if (c.telegram) {
      var username = c.telegram.replace(/^@/, '');
      items.push({
        label: 'Telegram: @' + username,
        href: 'https://t.me/' + username,
        external: true
      });
    }

    if (c.whatsapp) {
      var number = digitsOnly(c.whatsapp);
      items.push({
        label: 'WhatsApp: +' + number,
        href: 'https://wa.me/' + number,
        external: true
      });
    }

    if (c.phone) {
      items.push({
        label: 'Телефон: ' + c.phone,
        href: 'tel:' + c.phone.replace(/[^\d+]/g, '')
      });
    }

    return items;
  }

  function renderContacts() {
    var items = buildContactLinks();
    if (!items.length) return;

    $$('[data-contact-list]').forEach(function (list) {
      list.textContent = '';

      items.forEach(function (item) {
        var li = document.createElement('li');
        var a = document.createElement('a');

        a.href = item.href;
        a.textContent = item.label;

        if (item.external) {
          a.target = '_blank';
          a.rel = 'noopener noreferrer';
        }

        li.appendChild(a);
        list.appendChild(li);
      });
    });
  }

  $$('[data-year]').forEach(function (el) {
    el.textContent = new Date().getFullYear();
  });

  // Мобильное меню
  var toggle = $('.menu-toggle');
  var nav = $('#site-nav');

  function setMenu(open) {
    if (!toggle || !nav) return;

    nav.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute(
      'aria-label',
      open ? 'Закрыть меню' : 'Открыть меню'
    );
  }

  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      setMenu(toggle.getAttribute('aria-expanded') !== 'true');
    });

    $$('a', nav).forEach(function (link) {
      link.addEventListener('click', function () {
        setMenu(false);
      });
    });

    document.addEventListener('keydown', function (event) {
      if (
        event.key === 'Escape' &&
        toggle.getAttribute('aria-expanded') === 'true'
      ) {
        setMenu(false);
        toggle.focus();
      }
    });

    document.addEventListener('click', function (event) {
      if (
        toggle.getAttribute('aria-expanded') === 'true' &&
        !nav.contains(event.target) &&
        !toggle.contains(event.target)
      ) {
        setMenu(false);
      }
    });

    window.addEventListener('resize', function () {
      if (window.innerWidth > 900) setMenu(false);
    });
  }

  // Подсветка активного раздела
  function initActiveNav() {
    if (!('IntersectionObserver' in window)) return;

    var links = $$('.nav__link');
    var map = {};

    links.forEach(function (link) {
      var href = link.getAttribute('href');
      if (href && href.charAt(0) === '#') {
        map[href.slice(1)] = link;
      }
    });

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting && map[entry.target.id]) {
          links.forEach(function (link) {
            link.classList.remove('is-active');
            link.removeAttribute('aria-current');
          });

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

  // Кнопки записи
  var form = $('#booking-form');

  $$('[data-cta]').forEach(function (button) {
    button.addEventListener('click', function () {
      if (!form) return;

      window.setTimeout(function () {
        var nameField = $('#f-name');
        if (nameField) nameField.focus({ preventScroll: true });
      }, reduceMotion ? 0 : 500);
    });
  });

  renderContacts();
  initActiveNav();

  if (!form) return;

  var fields = {
    name: $('#f-name'),
    contact: $('#f-contact'),
    comment: $('#f-comment'),
    consent: $('#f-consent')
  };

  var errors = {
    name: $('#err-name'),
    contact: $('#err-contact'),
    consent: $('#err-consent')
  };

  var summary = $('#form-summary');
  var result = $('#form-result');
  var submitBtn = $('#form-submit');
  var submitLabel = $('.form__submit-label', submitBtn);
  var modeEl = $('#form-mode');

  if (
    !fields.name ||
    !fields.contact ||
    !fields.consent ||
    !submitBtn ||
    !submitLabel ||
    !result
  ) {
    console.error(
      'Форма: проверьте ID полей в index.html.'
    );
    return;
  }

  var defaultLabel = submitLabel.textContent;

  if (modeEl) {
    modeEl.textContent =
      'После отправки заявки психолог свяжется с вами по телефону.';
  }

  function validateName() {
    var value = fields.name.value.trim();

    if (!value) return 'Введите ваше имя.';
    if (value.length < 2) return 'Имя должно содержать минимум 2 символа.';

    return '';
  }

  function validatePhone() {
    var value = fields.contact.value.trim();
    var digits = digitsOnly(value);

    if (!value) return 'Укажите номер телефона для подтверждения записи.';

    if (!/^[+\d\s()\-]+$/.test(value)) {
      return 'В номере используйте цифры, пробелы, +, скобки или дефис.';
    }

    if (digits.length < 10 || digits.length > 15) {
      return 'Проверьте номер: должно быть от 10 до 15 цифр.';
    }

    return '';
  }

  function validateConsent() {
    return fields.consent.checked
      ? ''
      : 'Подтвердите согласие на обработку персональных данных.';
  }

  var validators = {
    name: validateName,
    contact: validatePhone,
    consent: validateConsent
  };

  function showFieldError(key, message) {
    var input = fields[key];
    var error = errors[key];

    if (!input) return;

    if (message) {
      if (error) {
        error.textContent = message;
        error.hidden = false;
      }
      input.setAttribute('aria-invalid', 'true');
    } else {
      if (error) {
        error.textContent = '';
        error.hidden = true;
      }
      input.removeAttribute('aria-invalid');
    }
  }

  function validateField(key) {
    var message = validators[key]();
    showFieldError(key, message);
    return !message;
  }

  function validateAll() {
    var invalid = [];

    Object.keys(validators).forEach(function (key) {
      if (!validateField(key)) invalid.push(key);
    });

    return invalid;
  }

  Object.keys(fields).forEach(function (key) {
    var input = fields[key];
    if (!input) return;

    input.addEventListener('blur', function () {
      if (
        input.value ||
        input.type === 'checkbox' ||
        input.getAttribute('aria-invalid')
      ) {
        validateField(key);
      }
    });

    input.addEventListener(
      input.type === 'checkbox' ? 'change' : 'input',
      function () {
        if (input.getAttribute('aria-invalid')) {
          validateField(key);
        }
      }
    );
  });

  function collectData() {
    return {
      name: fields.name.value.trim(),
      phone: fields.contact.value.trim(),
      comment: fields.comment ? fields.comment.value.trim() : ''
    };
  }

  function buildMessage(data) {
    var lines = [
      'Новая заявка на консультацию',
      '',
      'Имя: ' + data.name,
      'Телефон: ' + data.phone
    ];

    if (data.comment) {
      lines.push('Комментарий: ' + data.comment);
    }

    lines.push('', 'Согласие на обработку персональных данных дано.');

    return lines.join('\n');
  }

  function setLoading(loading) {
    submitBtn.disabled = loading;
    submitBtn.classList.toggle('is-loading', loading);
    submitBtn.setAttribute('aria-busy', String(loading));
    submitLabel.textContent = loading ? 'Отправляем…' : defaultLabel;
  }

  function showResult(state, title, message) {
    result.textContent = '';
    result.hidden = false;
    result.setAttribute('data-state', state);

    var heading = document.createElement('strong');
    heading.textContent = title;
    result.appendChild(heading);

    var paragraph = document.createElement('p');
    paragraph.textContent = message;
    result.appendChild(paragraph);
  }

  function submitToEndpoint(data) {
    var controller = 'AbortController' in window
      ? new AbortController()
      : null;

    var timer = controller
      ? window.setTimeout(function () {
          controller.abort();
        }, CONFIG.requestTimeoutMs)
      : null;

    setLoading(true);

    fetch(CONFIG.formEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        clientName: data.name,
        notificationMethod: 'phone',
        contact: data.phone,
        consultationFormat: 'unknown',
        service: 'Не указано',
        comment: data.comment
      }),
      signal: controller ? controller.signal : undefined
    })
      .then(function (response) {
        if (!response.ok) {
          throw new Error('Ошибка сервера: ' + response.status);
        }

        showResult(
          'success',
          'Спасибо! Заявка отправлена.',
          'Психолог свяжется с вами по указанному номеру телефона.'
        );

        form.reset();

        Object.keys(errors).forEach(function (key) {
          showFieldError(key, '');
        });

        if (summary) summary.hidden = true;
      })
      .catch(function (error) {
        console.error('Ошибка отправки заявки:', error);

        showResult(
          'error',
          'Не удалось отправить заявку.',
          'Попробуйте ещё раз немного позже. Если ошибка повторяется, сообщите об этом администратору сайта.'
        );
      })
      .then(function () {
        if (timer) window.clearTimeout(timer);

        setLoading(false);

        result.scrollIntoView({
          behavior: reduceMotion ? 'auto' : 'smooth',
          block: 'nearest'
        });
      });
  }

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    result.hidden = true;

    var invalid = validateAll();

    if (invalid.length) {
      if (summary) {
        summary.textContent =
          'Проверьте поля, отмеченные ошибками.';
        summary.hidden = false;
      }

      fields[invalid[0]].focus();
      return;
    }

    if (summary) summary.hidden = true;

    submitToEndpoint(collectData());
  });
})();