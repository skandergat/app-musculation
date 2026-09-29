(() => {
  const form = document.querySelector('[data-email-action]');
  if (!form) return;
  const status = form.querySelector('[role="status"]');
  const tokenKey = `liftely.action-token:${window.location.pathname}`;
  const tokenFromLink = new URLSearchParams(window.location.hash.slice(1)).get('token');
  let tokenSaved = null;
  if (tokenFromLink) {
    try {
      sessionStorage.setItem(tokenKey, tokenFromLink);
    } catch {}
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }
  try {
    tokenSaved = sessionStorage.getItem(tokenKey);
  } catch {}
  const token = tokenFromLink || tokenSaved;
  const kind = form.dataset.emailAction;
  const endpoints = {
    verify: '/auth/verify-email',
    'reset-password': '/auth/password-reset',
    'delete-request': '/auth/account-deletion-request',
    'delete-confirm': '/auth/account-delete-confirm',
  };
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    status.textContent = 'Traitement en cours…';
    let payload = {};
    if (kind === 'delete-request') {
      payload.email = new FormData(form).get('email');
    } else if (kind === 'reset-password') {
      const password = new FormData(form).get('password');
      const confirm = new FormData(form).get('confirm');
      if (password !== confirm) {
        status.textContent = 'Les deux mots de passe ne correspondent pas.';
        return;
      }
      payload = { token, password };
    } else {
      payload = { token };
    }
    try {
      const response = await fetch(endpoints[kind], {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'La demande n’a pas abouti.');
      status.textContent = data.message || 'Opération terminée.';
      if (kind !== 'delete-request') {
        try {
          sessionStorage.removeItem(tokenKey);
        } catch {}
      }
      if (kind !== 'delete-request') {
        const button = form.querySelector('button');
        if (button) button.disabled = true;
        if (kind === 'reset-password') form.querySelectorAll('input').forEach((input) => { input.disabled = true; });
      }
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : 'Une erreur est survenue.';
    }
  });
})();
