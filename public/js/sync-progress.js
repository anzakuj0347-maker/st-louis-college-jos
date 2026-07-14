(function () {
  const syncBtn = document.getElementById('syncStartBtn');
  const progressWrap = document.getElementById('syncProgressWrap');
  const progressBar = document.getElementById('syncProgressBar');
  const progressText = document.getElementById('syncProgressText');
  const progressPercent = document.getElementById('syncProgressPercent');
  const alertSuccess = document.getElementById('syncAlertSuccess');
  const alertError = document.getElementById('syncAlertError');
  const resultPanel = document.getElementById('syncResultPanel');
  const resultBody = document.getElementById('syncResultBody');
  const resultSummary = document.getElementById('syncResultSummary');

  if (!syncBtn || !progressWrap) return;

  const labels = window.syncStepLabels || {
    subjects: 'Subjects',
    users: 'Students',
    staffs: 'Staff',
    academicsessions: 'Sessions',
    results: 'Results',
    heroslides: 'Hero Slides',
    events: 'Events',
    news: 'News'
  };

  function hideAlerts() {
    if (alertSuccess) alertSuccess.hidden = true;
    if (alertError) alertError.hidden = true;
  }

  function showError(message) {
    hideAlerts();
    if (alertError) {
      alertError.textContent = message;
      alertError.hidden = false;
    }
  }

  function showSuccess(message) {
    hideAlerts();
    if (alertSuccess) {
      alertSuccess.textContent = message;
      alertSuccess.hidden = false;
    }
  }

  function setProgress(percent, message) {
    const safePercent = Math.max(0, Math.min(100, Number(percent) || 0));
    progressBar.style.width = `${safePercent}%`;
    progressBar.setAttribute('aria-valuenow', String(safePercent));
    if (progressPercent) progressPercent.textContent = `${safePercent}%`;
    if (progressText) progressText.textContent = message || 'Synchronising...';
  }

  function renderResult(syncResult) {
    if (!resultPanel || !resultBody || !syncResult) return;

    const rows = Object.keys(labels).map((key) => {
      const row = syncResult.results[key] || { created: 0, updated: 0, skipped: 0 };
      return `<tr>
        <td>${labels[key]}</td>
        <td>${row.created}</td>
        <td>${row.updated}</td>
        <td>${row.skipped || 0}</td>
      </tr>`;
    }).join('');

    resultBody.innerHTML = rows;
    const syncedAt = syncResult.syncedAt ? new Date(syncResult.syncedAt).toLocaleString() : 'just now';
    resultSummary.textContent = `Synchronised at ${syncedAt}.`;
    resultPanel.hidden = false;
  }

  async function startSync() {
    if (!window.confirm('Push local changes to MongoDB Atlas?')) return;

    hideAlerts();
    if (resultPanel) resultPanel.hidden = true;
    progressWrap.hidden = false;
    syncBtn.disabled = true;
    setProgress(0, 'Starting synchronisation...');

    try {
      const response = await fetch('/slc-admin/sync/run', {
        method: 'POST',
        headers: { Accept: 'application/x-ndjson' }
      });

      if (!response.ok || !response.body) {
        throw new Error('Could not start synchronisation.');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let finalResult = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line);

          if (event.type === 'error') {
            throw new Error(event.message || 'Synchronisation failed.');
          }

          if (event.type === 'progress') {
            setProgress(event.percent, event.message);
            if (event.result) finalResult = event.result;
          }

          if (event.type === 'complete') {
            finalResult = event.syncResult;
            setProgress(100, 'Synchronisation complete.');
          }
        }
      }

      if (finalResult?.totals) {
        const { totals } = finalResult;
        const parts = [
          `${totals.created} new record(s) pushed`,
          `${totals.updated} updated`
        ];
        if (totals.deleted) parts.push(`${totals.deleted} removed`);
        showSuccess(parts.join(', ') + '.');
        renderResult(finalResult);
      } else {
        showSuccess('Synchronisation complete.');
      }
    } catch (err) {
      showError(err.message || 'Synchronisation failed.');
      setProgress(0, 'Synchronisation failed.');
    } finally {
      syncBtn.disabled = false;
    }
  }

  syncBtn.addEventListener('click', startSync);
})();
