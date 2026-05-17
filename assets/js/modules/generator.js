/**
 * Generator Module — QR Gate App
 * Generates QR codes, saves to Supabase, renders for print.
 * No dependency on work_days or events.
 */
(async function () {
  'use strict';

  // 1. Auth Guard
  const session = await window.Auth.guardOrRedirect(['admin']);
  if (!session) return;

  const sb = window.sb;
  const user = session.user;

  // 2. Elements
  const qtyInput = document.getElementById('qty');
  const paperSelect = document.getElementById('paperSize');
  const qrSizeSelect = document.getElementById('qrSize');
  const titleInput = document.getElementById('titleText');
  const previewArea = document.getElementById('previewArea');
  const printArea = document.getElementById('printArea');
  const previewMeta = document.getElementById('previewMeta');
  const btnPreview = document.getElementById('btnPreview');
  const btnGenerate = document.getElementById('btnGenerate');

  // Modal
  const modal = document.getElementById('confirmModal');
  const modalMsg = document.getElementById('modalMsg');
  const modalCancel = document.getElementById('modalCancel');
  const modalConfirm = document.getElementById('modalConfirm');

  // 3. UUID Generator
  function generateUUID() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  }

  // 4. Generate Payloads
  function generatePayloads() {
    const qty = Math.max(1, Math.min(500, parseInt(qtyInput.value || 1)));
    const out = [];
    for (let i = 0; i < qty; i++) {
      out.push(generateUUID());
    }
    return out;
  }

  // 5. Preview
  btnPreview.addEventListener('click', () => {
    const payloads = generatePayloads();
    renderPreview(payloads);
  });

  function renderPreview(payloads) {
    previewArea.innerHTML = '';

    const limit = Math.min(payloads.length, 50);
    previewMeta.textContent = payloads.length > 50
      ? `${payloads.length} códigos (vista previa: primeros 50)`
      : `${payloads.length} códigos`;

    payloads.slice(0, limit).forEach(text => {
      const card = document.createElement('div');
      card.className = 'preview-card';

      const qrBox = document.createElement('div');
      card.appendChild(qrBox);

      const caption = document.createElement('div');
      caption.className = 'preview-caption';
      caption.textContent = '...' + text.slice(-8);
      card.appendChild(caption);

      previewArea.appendChild(card);

      new QRCode(qrBox, {
        text: text,
        width: 80,
        height: 80,
        colorDark: "#000000",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.H
      });
    });
  }

  // 6. Generate & Save
  btnGenerate.addEventListener('click', () => {
    const qty = Math.max(1, Math.min(500, parseInt(qtyInput.value || 1)));
    modalMsg.textContent = `¿Generar ${qty} códigos QR y guardarlos en la base de datos?`;
    modal.classList.add('active');
  });

  modalCancel.addEventListener('click', () => modal.classList.remove('active'));
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.remove('active'); });

  modalConfirm.addEventListener('click', async () => {
    modalConfirm.disabled = true;
    modalConfirm.textContent = 'Guardando...';

    try {
      const payloads = generatePayloads();

      // 1. Create Batch
      const today = new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'short' });
      const batchName = `Lote ${today}`;

      const { data: batch, error: batchErr } = await sb
        .from('qr_batches')
        .insert({
          name: batchName,
          created_by: user.id
        })
        .select()
        .single();

      if (batchErr) throw batchErr;

      // 2. Insert Codes (bulk)
      const rows = payloads.map(code => ({
        batch_id: batch.id,
        code: code,
        status: 'PENDIENTE'
      }));

      const { error: codesErr } = await sb.from('qr_codes').insert(rows);
      if (codesErr) throw codesErr;

      // 3. Render for Print
      modal.classList.remove('active');
      window.Toast.success(`${payloads.length} códigos guardados.`);

      btnGenerate.disabled = true;
      btnGenerate.textContent = 'Generando tickets...';

      await renderPrintTickets(payloads);

      // 4. Print
      setTimeout(() => {
        window.print();
        printArea.style.display = 'none';
        btnGenerate.disabled = false;
        btnGenerate.textContent = 'Guardar e Imprimir';
      }, 600);

    } catch (err) {
      console.error('[Generator] Error:', err);
      window.Toast.error('Error: ' + err.message);
    } finally {
      modalConfirm.disabled = false;
      modalConfirm.textContent = 'Sí, Generar';
    }
  });

  // 7. Render Print Tickets
  async function renderPrintTickets(payloads) {
    printArea.innerHTML = '';
    printArea.style.display = 'block';

    // Apply print vars
    document.documentElement.style.setProperty('--paper-mm', paperSelect.value + 'mm');
    document.documentElement.style.setProperty('--qr-mm', qrSizeSelect.value + 'mm');

    const title = titleInput.value || '';
    const qrPx = Math.round(parseInt(qrSizeSelect.value) * 3.78 * 2); // High-res for print

    for (const text of payloads) {
      const ticket = document.createElement('div');
      ticket.className = 'ticket';
      ticket.innerHTML = `
        <div class="ticket-inner">
          ${title ? `<div class="t-title">${title}</div>` : ''}
          <div class="t-qr"></div>
          <div class="t-code">${text.slice(-8)}</div>
        </div>
      `;
      printArea.appendChild(ticket);

      const qrDiv = ticket.querySelector('.t-qr');
      new QRCode(qrDiv, {
        text: text,
        width: qrPx,
        height: qrPx,
        correctLevel: QRCode.CorrectLevel.H
      });
      
      // Asegurar que sólo se vea la imagen y no el canvas, forzando con !important
      // para evitar duplicados en la impresión sin depender del CSS que puede estar cacheado
      const cvs = qrDiv.querySelector('canvas');
      if (cvs) cvs.style.setProperty('display', 'none', 'important');
      const img = qrDiv.querySelector('img');
      if (img) img.style.setProperty('display', 'block', 'important');
    }

    // Wait for QR rendering
    await new Promise(r => setTimeout(r, 500));
  }

  // Also render preview on load
  renderPreview(generatePayloads());

})();
