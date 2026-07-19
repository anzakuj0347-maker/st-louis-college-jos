(function () {
  'use strict';

  let printTriggered = false;

  function runPrint() {
    if (printTriggered) return;
    printTriggered = true;
    window.print();
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
    printBtn.addEventListener('click', () => {
      printTriggered = false;
      runPrint();
    });
  }

  if (document.readyState === 'complete') {
    schedulePrint();
  } else {
    window.addEventListener('load', schedulePrint, { once: true });
  }
})();
