(function () {
  'use strict';

  const form = document.getElementById('admissionApplicationForm');
  const previewPanel = document.getElementById('applicationPreviewPanel');
  const previewContent = document.getElementById('applicationPreviewContent');
  const previewBtn = document.getElementById('previewApplicationBtn');
  const backToEditBtn = document.getElementById('backToEditBtn');
  const printPreviewBtn = document.getElementById('printPreviewBtn');
  const confirmSubmitBtn = document.getElementById('confirmSubmitBtn');

  if (!form || !previewPanel || !previewContent) return;

  function fieldValue(name) {
    const field = form.elements[name];
    if (!field) return '—';
    if (field.type === 'select-one') return field.value || '—';
    return String(field.value || '').trim() || '—';
  }

  function fullName() {
    return [fieldValue('firstName'), fieldValue('middleName'), fieldValue('lastName')]
      .filter(function (part) { return part && part !== '—'; })
      .join(' ');
  }

  function formatDateInput(value) {
    if (!value || value === '—') return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString('en-NG', { dateStyle: 'long' });
  }

  function previewRow(label, value) {
    return '<div><dt>' + label + '</dt><dd>' + value + '</dd></div>';
  }

  function buildPreviewHtml() {
    const emergency = fieldValue('emergencyContactName');
    const emergencyPhone = fieldValue('emergencyContactPhone');
    const emergencyDisplay = emergency +
      (emergencyPhone !== '—' ? ' · ' + emergencyPhone : '');

    return ''
      + '<article class="application-review-sheet application-review-sheet--draft">'
      + '<header class="application-review-header">'
      + '<img src="/images/logo.jpg" alt="School Logo" class="application-review-logo">'
      + '<div class="application-review-school">'
      + '<h1>St. Louis College Jos</h1>'
      + '<p>Jos, Plateau State, Nigeria</p>'
      + '</div></header>'
      + '<div class="application-review-title">'
      + '<h2>Admission Application Form</h2>'
      + '<p class="application-review-ref application-review-ref--draft">Draft preview — not yet submitted</p>'
      + '</div>'
      + '<section class="application-review-section"><h3>Applicant Information</h3>'
      + '<dl class="application-review-grid">'
      + previewRow('Full Name', fullName())
      + previewRow('Date of Birth', formatDateInput(fieldValue('dateOfBirth')))
      + previewRow('Gender', fieldValue('gender'))
      + previewRow('Nationality', fieldValue('nationality'))
      + previewRow('State of Origin', fieldValue('stateOfOrigin'))
      + previewRow('Local Government', fieldValue('localGovernment'))
      + previewRow('Religion', fieldValue('religion'))
      + previewRow('Class Applying For', fieldValue('classApplyingFor'))
      + '</dl></section>'
      + '<section class="application-review-section"><h3>Previous School</h3>'
      + '<dl class="application-review-grid">'
      + previewRow('Previous School', fieldValue('previousSchool'))
      + previewRow('Last Class Completed', fieldValue('lastClassCompleted'))
      + '</dl></section>'
      + '<section class="application-review-section"><h3>Parent / Guardian</h3>'
      + '<dl class="application-review-grid">'
      + previewRow('Name', fieldValue('parentName'))
      + previewRow('Phone', fieldValue('parentPhone'))
      + previewRow('Email', fieldValue('parentEmail'))
      + previewRow('Address', fieldValue('parentAddress'))
      + previewRow('Emergency Contact', emergencyDisplay)
      + '</dl></section>'
      + (fieldValue('applicantNotes') !== '—'
        ? '<section class="application-review-section"><h3>Additional Notes</h3>'
          + '<p class="application-review-notes">' + fieldValue('applicantNotes') + '</p></section>'
        : '')
      + '</article>';
  }

  function showPreview() {
    if (!form.reportValidity()) return;
    previewContent.innerHTML = buildPreviewHtml();
    previewPanel.hidden = false;
    form.hidden = true;
    document.body.classList.add('application-preview-mode');
    previewPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function hidePreview() {
    previewPanel.hidden = true;
    form.hidden = false;
    document.body.classList.remove('application-preview-mode');
  }

  previewBtn?.addEventListener('click', showPreview);
  backToEditBtn?.addEventListener('click', hidePreview);
  printPreviewBtn?.addEventListener('click', function () {
    window.print();
  });
  confirmSubmitBtn?.addEventListener('click', function () {
    form.requestSubmit();
  });
})();
