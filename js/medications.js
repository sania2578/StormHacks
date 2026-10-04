/* ---------- Manage ---------- */
function renderMeds() {
  const m = store.get('meds', []);

  $('meds').innerHTML = m.length
    ? m.map((x, i) => `
      <div class="med">
        <strong>${esc(x.n)}</strong>
        <div>${esc(x.d)}</div>

        <button
          class="btn"
          data-a="Taken"
          data-i="${i}"
          style="padding:.35rem .8rem"
        >
          ${esc(t('medTaken'))}
        </button>

        <button
          class="btn g"
          data-a="Skipped"
          data-i="${i}"
          style="padding:.35rem .8rem"
        >
          ${esc(t('medSkip'))}
        </button>

        <button
          class="btn g"
          data-a="Later"
          data-i="${i}"
          style="padding:.35rem .8rem"
        >
          ${esc(t('medLater'))}
        </button>

        <div class="log">
          ${x.l ? esc(x.l) : ''}
        </div>
      </div>
    `).join('')
    : `<p class="sub">${esc(t('medEmpty'))}</p>`;

  $('meds').querySelectorAll('button').forEach(b => {
    b.onclick = () => {
      const arr = store.get('meds', []);

      let actionText = '';

      if (b.dataset.a === 'Taken') {
        actionText = t('medTakenLog');
      } else if (b.dataset.a === 'Skipped') {
        actionText = t('medSkippedLog');
      } else {
        actionText = t('medLaterLog');
      }

      const time = new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
      });

      arr[b.dataset.i].l = `${actionText} · ${time}`;

      store.set('meds', arr);

      log(`${arr[b.dataset.i].n}: ${actionText}`);

      renderMeds();
    };
  });
}