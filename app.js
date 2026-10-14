(() => {
      'use strict';
      const LIMIT = 25;
      const LARGE_TOTAL_BYTES = 250 * 1024 * 1024;
      const $ = (id) => document.getElementById(id);
      const root = document.documentElement;
      const fileInput = $('fileInput');
      const chooseButton = $('chooseButton');
      const dropzone = $('dropzone');
      const dropOverlay = $('dropOverlay');
      const filesList = $('filesList');
      const alerts = $('alerts');
      const mergeButton = $('mergeButton');
      const downloadButton = $('downloadButton');
      const progressWrap = $('progressWrap');
      const progressBar = $('progressBar');
      const progressLabel = $('progressLabel');
      const progressPercent = $('progressPercent');
      const successPanel = $('successPanel');
      let items = [];
      let nextId = 1;
      let busy = false;
      let resultUrl = null;
      let resultBlob = null;
      let resultRevoker = null;
      let completed = false;
      let dragId = null;
      let globalDragDepth = 0;

      if (window.pdfjsLib && window.pdfjsLib.GlobalWorkerOptions) {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      }

      const icon = {
        alert: '<svg viewBox="0 0 18 18" fill="none" aria-hidden="true"><circle cx="9" cy="9" r="7" stroke="currentColor" stroke-width="1.5"/><path d="M9 5.5v4M9 12.5h.01" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
        warning: '<svg viewBox="0 0 18 18" fill="none" aria-hidden="true"><path d="m9 2 7 12.3a1 1 0 0 1-.87 1.5H2.87A1 1 0 0 1 2 14.3L9 2Z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path d="M9 6.2v4M9 12.8h.01" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
        check: '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><circle cx="8" cy="8" r="6.2" stroke="currentColor" stroke-width="1.4"/><path d="m4.8 8 2.1 2.1 4.3-4.3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
        file: '<svg viewBox="0 0 20 22" fill="none" aria-hidden="true"><path d="M4.5 1.75h7l5 5V19A1.25 1.25 0 0 1 15.25 20.25h-10A1.25 1.25 0 0 1 4 19V2.25a.5.5 0 0 1 .5-.5Z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path d="M11.25 2v5h5M7 11h7M7 14h7" stroke="currentColor" stroke-width="1.35" stroke-linecap="round"/></svg>',
        grip: '<svg viewBox="0 0 16 20" fill="currentColor" aria-hidden="true"><circle cx="5" cy="4" r="1.2"/><circle cx="11" cy="4" r="1.2"/><circle cx="5" cy="10" r="1.2"/><circle cx="11" cy="10" r="1.2"/><circle cx="5" cy="16" r="1.2"/><circle cx="11" cy="16" r="1.2"/></svg>',
        up: '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m4 10 4-4 4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
        down: '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m4 6 4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
        remove: '<svg viewBox="0 0 18 18" fill="none" aria-hidden="true"><path d="M3.5 5h11M7 5V3.5h4V5m2.5 0-.6 9.1a1 1 0 0 1-1 .9H6.1a1 1 0 0 1-1-.9L4.5 5m3 2.5v5m3-5v5" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round"/></svg>'
      };

      function setTheme(theme) {
        root.dataset.theme = theme;
        try { localStorage.setItem('fold-theme', theme); } catch (_) {}
        $('themeToggle').setAttribute('aria-label', theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
        $('themeToggle').title = theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme';
        $('themeIcon').innerHTML = theme === 'dark'
          ? '<circle cx="10" cy="10" r="3.25" stroke="currentColor" stroke-width="1.5"/><path d="M10 2.2v1.5M10 16.3v1.5M17.8 10h-1.5M3.7 10H2.2m13.3-5.5-1.1 1.1m-8.8 8.8-1.1 1.1m11 0-1.1-1.1M5.5 5.5 4.4 4.4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>'
          : '<path d="M16.2 12.3A6.7 6.7 0 0 1 7.7 3.8a6.8 6.8 0 1 0 8.5 8.5Z" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>';
      }
      try { setTheme(localStorage.getItem('fold-theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')); }
      catch (_) { setTheme('light'); }
      $('themeToggle').addEventListener('click', () => setTheme(root.dataset.theme === 'dark' ? 'light' : 'dark'));

      function formatBytes(bytes) {
        if (!bytes) return '0 B';
        const units = ['B', 'KB', 'MB', 'GB'];
        const power = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
        const amount = bytes / Math.pow(1024, power);
        return `${amount.toFixed(power === 0 || amount >= 100 ? 0 : 1)} ${units[power]}`;
      }
      function escapeHtml(value) {
        return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
      }
      function showAlert(message, type = 'error', persistent = true) {
        const el = document.createElement('div');
        el.className = `alert ${type}`;
        el.innerHTML = `${type === 'warning' ? icon.warning : icon.alert}<span>${escapeHtml(message)}</span><button type="button" class="dismiss-alert" aria-label="Dismiss message"><svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m4 4 8 8m0-8-8 8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg></button>`;
        el.querySelector('button').addEventListener('click', () => el.remove());
        alerts.appendChild(el);
        if (!persistent) setTimeout(() => el.remove(), 7000);
      }
      function setBusy(value, label = '') {
        busy = value;
        chooseButton.disabled = value;
        fileInput.disabled = value;
        $('themeToggle').disabled = value;
        $('themeToggle').style.opacity = value ? '.48' : '';
        $('themeToggle').style.cursor = value ? 'not-allowed' : '';
        mergeButton.classList.toggle('processing', value && label.toLowerCase().includes('merg'));
        if (value) {
          progressWrap.classList.add('show');
          progressLabel.textContent = label || 'Working…';
          progressPercent.textContent = '0%';
          progressBar.style.width = '0%';
        } else {
          progressWrap.classList.remove('show');
        }
        render();
      }
      function updateProgress(percent, label) {
        const safe = Math.max(0, Math.min(100, percent));
        progressBar.style.width = `${safe}%`;
        progressPercent.textContent = `${Math.round(safe)}%`;
        if (label) progressLabel.textContent = label;
      }
      function releaseResult() {
        if (resultRevoker) { clearTimeout(resultRevoker); resultRevoker = null; }
        if (resultUrl) URL.revokeObjectURL(resultUrl);
        resultUrl = null;
        resultBlob = null;
        completed = false;
        successPanel.classList.remove('show');
        downloadButton.style.display = 'none';
        downloadButton.disabled = false;
      }
      function render() {
        $('fileCount').textContent = `${items.length} / ${LIMIT} files`;
        $('summaryFiles').innerHTML = `${items.length}<small>${items.length === 1 ? 'file' : 'files'}</small>`;
        const totalSize = items.reduce((sum, item) => sum + item.file.size, 0);
        const pageCount = items.reduce((sum, item) => sum + (item.pages || 0), 0);
        $('totalSize').textContent = formatBytes(totalSize);
        $('totalPages').textContent = pageCount.toLocaleString();
        const allReady = items.length >= 2 && items.every((item) => item.status === 'ready');
        mergeButton.disabled = busy || !allReady;
        mergeButton.querySelector('#mergeButtonText').textContent = busy && progressLabel.textContent.toLowerCase().includes('merg') ? 'Merging your PDFs…' : (completed ? 'Merge again' : 'Merge PDFs');
        downloadButton.disabled = busy || !resultBlob;
        if (!items.length) {
          filesList.innerHTML = `<div class="empty-state"><div><div class="empty-illustration">${icon.file}${icon.file}</div><p class="empty-title">Your list is looking nice and empty</p><p class="empty-copy">Add two or more PDFs to see them here.</p></div></div>`;
        } else {
          filesList.innerHTML = items.map((item, index) => {
            const status = item.status === 'ready'
              ? `<span class="file-state ready">${icon.check}<span>${item.pages.toLocaleString()} ${item.pages === 1 ? 'page' : 'pages'}</span></span>`
              : item.status === 'failed'
                ? `<span class="file-state failed">${icon.alert}<span>Couldn’t read</span></span>`
                : `<span class="file-state"><i class="spinner" aria-hidden="true"></i><span>Reading…</span></span>`;
            return `<article class="file-row" data-id="${item.id}" draggable="${item.status === 'ready' && !busy}" aria-label="${escapeHtml(item.file.name)}, position ${index + 1} of ${items.length}">
              <span class="grabber" aria-label="Drag to reorder" title="Drag to reorder">${icon.grip}</span>
              <span class="pdf-icon">${icon.file}</span>
              <div class="file-info"><p class="file-name" title="${escapeHtml(item.file.name)}">${escapeHtml(item.file.name)}</p><div class="file-meta"><span>${formatBytes(item.file.size)}</span><i class="separator"></i><span>PDF document</span></div></div>
              ${status}
              <div class="row-actions"><button class="move-button" type="button" data-move="up" data-id="${item.id}" aria-label="Move ${escapeHtml(item.file.name)} earlier" title="Move earlier" ${index === 0 || busy ? 'disabled' : ''}>${icon.up}</button><button class="move-button" type="button" data-move="down" data-id="${item.id}" aria-label="Move ${escapeHtml(item.file.name)} later" title="Move later" ${index === items.length - 1 || busy ? 'disabled' : ''}>${icon.down}</button><button class="icon-button" type="button" data-remove="${item.id}" aria-label="Remove ${escapeHtml(item.file.name)}" title="Remove file" ${busy ? 'disabled' : ''}>${icon.remove}</button></div>
            </article>`;
          }).join('');
          filesList.querySelectorAll('.file-row').forEach(bindRow);
        }
        $('totalSize').setAttribute('aria-label', `Total selected size ${formatBytes(totalSize)}`);
        if (totalSize > LARGE_TOTAL_BYTES && !busy) {
          const exists = [...alerts.querySelectorAll('.alert.warning')].some((el) => el.dataset.memoryWarning === 'true');
          if (!exists) {
            showAlert(`These PDFs add up to ${formatBytes(totalSize)}. Merging many large files may use substantial memory or slow down your browser.`, 'warning', true);
            alerts.lastElementChild.dataset.memoryWarning = 'true';
          }
        } else {
          alerts.querySelectorAll('.alert.warning[data-memory-warning="true"]').forEach((el) => el.remove());
        }
      }
      function invalidateOutput() {
        if (completed || resultBlob || resultUrl) releaseResult();
      }
      function bindRow(row) {
        row.querySelectorAll('[data-remove]').forEach((button) => button.addEventListener('click', () => {
          if (busy) return;
          invalidateOutput();
          items = items.filter((item) => item.id !== Number(button.dataset.remove));
          render();
        }));
        row.querySelectorAll('[data-move]').forEach((button) => button.addEventListener('click', () => {
          if (busy) return;
          const index = items.findIndex((item) => item.id === Number(button.dataset.id));
          const other = index + (button.dataset.move === 'up' ? -1 : 1);
          if (index < 0 || other < 0 || other >= items.length) return;
          invalidateOutput();
          [items[index], items[other]] = [items[other], items[index]];
          render();
          filesList.querySelector(`[data-id="${button.dataset.id}"] .grabber`)?.focus();
        }));
        row.addEventListener('dragstart', (event) => {
          if (busy || !row.draggable) { event.preventDefault(); return; }
          dragId = Number(row.dataset.id);
          row.classList.add('dragging-row');
          event.dataTransfer.effectAllowed = 'move';
          event.dataTransfer.setData('text/plain', String(dragId));
        });
        row.addEventListener('dragend', () => { dragId = null; filesList.querySelectorAll('.file-row').forEach((el) => el.classList.remove('dragging-row', 'drag-target')); });
        row.addEventListener('dragover', (event) => {
          if (busy || dragId === null || Number(row.dataset.id) === dragId) return;
          event.preventDefault();
          event.dataTransfer.dropEffect = 'move';
          row.classList.add('drag-target');
        });
        row.addEventListener('dragleave', () => row.classList.remove('drag-target'));
        row.addEventListener('drop', (event) => {
          if (busy || dragId === null) return;
          event.preventDefault();
          const from = items.findIndex((item) => item.id === dragId);
          const to = items.findIndex((item) => item.id === Number(row.dataset.id));
          if (from < 0 || to < 0 || from === to) return;
          invalidateOutput();
          const [moved] = items.splice(from, 1);
          items.splice(to, 0, moved);
          render();
        });
      }
      function identifyPdfError(error) {
        const name = String(error && error.name || '');
        const message = String(error && error.message || '').toLowerCase();
        if (/password|encrypt/i.test(name) || /password|encrypted|encryption/i.test(message) || (error && (error.code === 1 || error.code === 2) && /password/i.test(name))) return 'This PDF is password-protected. Unlock it first, then add it again.';
        return 'This PDF appears to be damaged or unreadable. Try opening it in a PDF reader, then add it again.';
      }
      async function readPageCount(file) {
        if (!window.pdfjsLib) throw new Error('PDF_PAGE_READER_UNAVAILABLE');
        const bytes = new Uint8Array(await file.arrayBuffer());
        let task;
        try {
          task = window.pdfjsLib.getDocument({ data: bytes, isEvalSupported: false });
          const doc = await task.promise;
          const pages = doc.numPages;
          await doc.destroy();
          return pages;
        } catch (error) {
          if (task && task.destroy) { try { await task.destroy(); } catch (_) {} }
          throw error;
        }
      }
      function isPdf(file) {
        return file.name.toLowerCase().endsWith('.pdf');
      }
      function fingerprint(file) { return `${file.name.toLowerCase()}\u0000${file.size}\u0000${file.lastModified}`; }
      async function addFiles(fileLikeList) {
        if (busy) { showAlert('Please wait until the current files finish processing before adding more.', 'warning', false); return; }
        const selected = Array.from(fileLikeList || []);
        if (!selected.length) return;
        const valid = [];
        for (const file of selected) {
          if (!isPdf(file)) {
            showAlert(`“${file.name}” isn’t a PDF. Only .pdf files can be added.`, 'error', false);
            continue;
          }
          if (file.size === 0) {
            showAlert(`“${file.name}” is empty (0 bytes), so it can’t be merged.`, 'error', false);
            continue;
          }
          valid.push(file);
        }
        const available = LIMIT - items.length;
        if (valid.length > available) showAlert('You can merge up to 25 PDFs at a time.', 'warning', true);
        const toAdd = valid.slice(0, Math.max(0, available));
        if (!toAdd.length) { fileInput.value = ''; return; }
        invalidateOutput();
        const seen = new Set(items.map((item) => fingerprint(item.file)));
        for (const file of toAdd) {
          if (seen.has(fingerprint(file))) showAlert(`“${file.name}” has already been added. This copy is included too.`, 'warning', false);
          seen.add(fingerprint(file));
          items.push({ id: nextId++, file, pages: 0, status: 'reading' });
        }
        render();
        setBusy(true, 'Reading your PDFs…');
        let processed = 0;
        const pending = items.filter((item) => item.status === 'reading');
        for (const item of pending) {
          try {
            item.pages = await readPageCount(item.file);
            item.status = 'ready';
          } catch (error) {
            item.status = 'failed';
            showAlert(`Couldn’t add “${item.file.name}”. ${error && error.message === 'PDF_PAGE_READER_UNAVAILABLE' ? 'The PDF reader could not load. Check your connection and refresh the page.' : identifyPdfError(error)}`, 'error', true);
            items = items.filter((entry) => entry.id !== item.id);
          }
          processed += 1;
          updateProgress((processed / pending.length) * 100, 'Reading your PDFs…');
          render();
        }
        setBusy(false);
        fileInput.value = '';
      }
      chooseButton.addEventListener('click', () => { if (!busy) fileInput.click(); });
      fileInput.addEventListener('change', (event) => addFiles(event.target.files));
      dropzone.addEventListener('dragover', (event) => { event.preventDefault(); if (!busy) dropzone.classList.add('dragging'); });
      dropzone.addEventListener('dragleave', (event) => { if (!dropzone.contains(event.relatedTarget)) dropzone.classList.remove('dragging'); });
      dropzone.addEventListener('drop', (event) => { event.preventDefault(); dropzone.classList.remove('dragging'); if (event.dataTransfer.files.length) addFiles(event.dataTransfer.files); });
      document.addEventListener('dragenter', (event) => {
        if (!event.dataTransfer || !Array.from(event.dataTransfer.types || []).includes('Files')) return;
        event.preventDefault();
        globalDragDepth++;
        if (!busy) dropOverlay.classList.add('show');
      });
      document.addEventListener('dragover', (event) => { if (event.dataTransfer && Array.from(event.dataTransfer.types || []).includes('Files')) event.preventDefault(); });
      document.addEventListener('dragleave', (event) => {
        if (!event.dataTransfer || !Array.from(event.dataTransfer.types || []).includes('Files')) return;
        globalDragDepth = Math.max(0, globalDragDepth - 1);
        if (globalDragDepth === 0) dropOverlay.classList.remove('show');
      });
      document.addEventListener('drop', (event) => {
        if (!event.dataTransfer || !Array.from(event.dataTransfer.types || []).includes('Files')) return;
        event.preventDefault();
        globalDragDepth = 0;
        dropOverlay.classList.remove('show');
        if (!dropzone.contains(event.target) && event.dataTransfer.files.length) addFiles(event.dataTransfer.files);
      });

      async function mergePdfs() {
        if (busy || items.length < 2 || !items.every((item) => item.status === 'ready')) return;
        if (!window.PDFLib || !window.PDFLib.PDFDocument) {
          showAlert('The PDF merge library could not load. Check your connection, then refresh the page.', 'error', true);
          return;
        }
        releaseResult();
        const queue = [...items];
        const total = queue.length;
        try {
          setBusy(true, 'Merging your PDFs…');
          const merged = await window.PDFLib.PDFDocument.create();
          for (let i = 0; i < queue.length; i += 1) {
            const item = queue[i];
            updateProgress((i / total) * 100, `Adding ${item.file.name}`);
            const bytes = await item.file.arrayBuffer();
            let source;
            try {
              source = await window.PDFLib.PDFDocument.load(bytes, { updateMetadata: false });
              const indices = source.getPageIndices();
              const pages = await merged.copyPages(source, indices);
              pages.forEach((page) => merged.addPage(page));
            } catch (error) {
              const msg = String(error && error.message || '').toLowerCase();
              if (/encrypt|password/i.test(msg) || (error && error.name === 'EncryptedPDFError')) {
                throw new Error(`“${item.file.name}” is password-protected. Unlock it first, then try again.`);
              }
              throw new Error(`“${item.file.name}” could not be merged. The PDF may be damaged or use unsupported features.`);
            } finally {
              source = null;
            }
            updateProgress(((i + 1) / total) * 94, `Added ${i + 1} of ${total} files`);
            await new Promise((resolve) => setTimeout(resolve, 0));
          }
          updateProgress(96, 'Finishing your merged PDF…');
          const outputBytes = await merged.save();
          resultBlob = new Blob([outputBytes], { type: 'application/pdf' });
          resultUrl = URL.createObjectURL(resultBlob);
          completed = true;
          updateProgress(100, 'Your PDF is ready');
          successPanel.classList.add('show');
          $('successText').textContent = `${queue.length} files and ${queue.reduce((sum, item) => sum + item.pages, 0).toLocaleString()} pages are together in one PDF.`;
          downloadButton.style.display = 'inline-flex';
          downloadButton.disabled = false;
        } catch (error) {
          showAlert(error && error.message ? error.message : 'Something went wrong while merging. Please try again.', 'error', true);
          releaseResult();
        } finally {
          setTimeout(() => setBusy(false), completed ? 420 : 0);
        }
      }
      mergeButton.addEventListener('click', mergePdfs);
      downloadButton.addEventListener('click', () => {
        if (!resultBlob || busy) return;
        if (resultUrl) URL.revokeObjectURL(resultUrl);
        resultUrl = URL.createObjectURL(resultBlob);
        const link = document.createElement('a');
        link.href = resultUrl;
        link.download = 'merged.pdf';
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        link.remove();
        downloadButton.disabled = true;
        $('successText').textContent = 'Your download has started. The temporary merged file will be released from memory.';
        resultRevoker = setTimeout(() => {
          if (resultUrl) URL.revokeObjectURL(resultUrl);
          resultUrl = null;
          resultBlob = null;
          resultRevoker = null;
          downloadButton.style.display = 'none';
          $('successText').textContent = 'Downloaded — your temporary merged file has been released.';
        }, 1400);
      });

      render();
    })();

