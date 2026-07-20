(function () {
  'use strict';

  let printTriggered = false;

  const A4_WIDTH_MM = 210;
  const A4_HEIGHT_MM = 297;
  const PAGE_MARGIN_MM = 4;
  const MM_TO_PX = 96 / 25.4;

  function getA4PrintSizePx() {
    const marginPx = PAGE_MARGIN_MM * MM_TO_PX * 2;
    return {
      width: Math.floor(A4_WIDTH_MM * MM_TO_PX - marginPx),
      height: Math.floor(A4_HEIGHT_MM * MM_TO_PX - marginPx)
    };
  }

  function getReportCard() {
    return document.querySelector('.student-report-card');
  }

  function applySubjectDensity() {
    const card = getReportCard();
    if (!card) return 0;

    const count = card.querySelectorAll('.report-card-table tbody tr').length;
    card.dataset.subjectCount = String(count);
    card.classList.remove(
      'student-report-card--compact',
      'student-report-card--dense',
      'student-report-card--extra-dense'
    );

    if (count >= 22) {
      card.classList.add('student-report-card--extra-dense');
    } else if (count >= 16) {
      card.classList.add('student-report-card--dense');
    } else if (count >= 11) {
      card.classList.add('student-report-card--compact');
    }

    return count;
  }

  function resetPrintFit() {
    const fit = document.querySelector('.print-result-fit');
    const stage = document.querySelector('.print-result-stage');
    if (fit) {
      fit.style.transform = '';
      fit.style.transformOrigin = '';
      fit.style.width = '';
      fit.style.maxWidth = '';
      fit.style.height = '';
      fit.style.maxHeight = '';
      fit.style.marginTop = '';
    }
    if (stage) {
      stage.style.width = '';
      stage.style.height = '';
    }
  }

  function fitResultToOnePage() {
    const stage = document.querySelector('.print-result-stage');
    const fit = document.querySelector('.print-result-fit');
    if (!fit || !stage) return;

    applySubjectDensity();
    resetPrintFit();

    const page = getA4PrintSizePx();
    stage.style.width = page.width + 'px';
    stage.style.height = page.height + 'px';
    fit.style.width = page.width + 'px';
    fit.style.maxWidth = page.width + 'px';

    // Width is handled by CSS (table-layout: fixed, 100%). Only shrink vertically when needed.
    const contentHeight = fit.scrollHeight;
    let scale = Math.min(1, page.height / contentHeight);

    if (scale >= 0.995) {
      fit.style.transform = '';
      fit.style.marginTop = '';
      return;
    }

    const subjectCount = Number(getReportCard()?.dataset.subjectCount || 0);
    const minScale = subjectCount >= 22 ? 0.5 : subjectCount >= 16 ? 0.55 : subjectCount >= 11 ? 0.62 : 0.78;
    scale = Math.max(minScale, scale);

    fit.style.transformOrigin = 'top center';
    fit.style.transform = 'scale(' + scale + ')';

    const scaledHeight = contentHeight * scale;
    fit.style.marginTop = Math.max(0, (page.height - scaledHeight) / 2) + 'px';
  }

  function runPrint() {
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        fitResultToOnePage();
        requestAnimationFrame(function () {
          if (printTriggered) return;
          printTriggered = true;
          window.print();
        });
      });
    });
  }

  function schedulePrint() {
    const qrImage = document.querySelector('.print-result-qr-code');
    if (qrImage && !qrImage.complete) {
      qrImage.addEventListener('load', runPrint, { once: true });
      qrImage.addEventListener('error', runPrint, { once: true });
      setTimeout(runPrint, 1200);
      return;
    }
    setTimeout(runPrint, 150);
  }

  const printBtn = document.getElementById('printResultBtn');
  if (printBtn) {
    printBtn.addEventListener('click', function () {
      printTriggered = false;
      runPrint();
    });
  }

  window.addEventListener('beforeprint', fitResultToOnePage);
  window.addEventListener('afterprint', function () {
    printTriggered = false;
    resetPrintFit();
  });

  if (document.readyState === 'complete') {
    schedulePrint();
  } else {
    window.addEventListener('load', schedulePrint, { once: true });
  }
})();
