(function () {
  'use strict';

  const input = document.querySelector('[data-admin-search]');
  const table = document.querySelector('[data-admin-search-table]');
  const meta = document.querySelector('[data-admin-search-meta]');
  const emptyMsg = document.querySelector('[data-admin-search-empty]');

  if (!input || !table) return;

  const rows = Array.from(table.querySelectorAll('tbody tr[data-search-row]'));
  const total = rows.length;

  function update() {
    const query = input.value.trim().toLowerCase();
    let visible = 0;

    rows.forEach((row) => {
      const haystack = (row.getAttribute('data-search-row') || '').toLowerCase();
      const match = !query || haystack.includes(query);
      row.hidden = !match;
      if (match) visible += 1;
    });

    if (meta) {
      meta.textContent = query
        ? `Showing ${visible} of ${total}`
        : `${total} records`;
    }

    if (emptyMsg) {
      emptyMsg.hidden = visible > 0;
    }
  }

  input.addEventListener('input', update);
  update();
})();
