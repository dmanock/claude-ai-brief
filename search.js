(function() {
  var TAG = '[search]';
  console.log(TAG, 'init: script running');

  var input = document.getElementById('searchInput');
  var box   = document.getElementById('searchResults');
  if (!input || !box) {
    console.error(TAG, 'init failed: missing #searchInput or #searchResults');
    return;
  }
  console.log(TAG, 'init: input + box bound');

  var pagefind = null;     // resolved module
  var loading  = null;     // in-flight Promise (dedupes concurrent loads)
  var loadErr  = null;
  var activeIdx = -1;
  var lastQuery = '';

  // Eagerly import on script load. Lazy-loading on focus was failing for some
  // visitors when CDN cache or page-load timing dropped the focus event before
  // the listener was attached. A few hundred KB up-front is cheap insurance.
  function loadPagefind() {
    if (pagefind) return Promise.resolve(pagefind);
    if (loading)  return loading;
    console.log(TAG, 'loadPagefind: importing /pagefind/pagefind.js');
    var t0 = Date.now();
    loading = import('/pagefind/pagefind.js')
      .then(function(mod) {
        console.log(TAG, 'loadPagefind: imported in', (Date.now()-t0)+'ms; exports:', Object.keys(mod));
        // The exported options() IS async, but we don't need to await it —
        // it just stores config that pagefind.search() will consume on first call.
        try {
          if (typeof mod.options === 'function') mod.options({ baseUrl: '/' });
        } catch (e) {
          console.warn(TAG, 'options() threw (non-fatal):', e);
        }
        pagefind = mod;
        loadErr = null;
        return mod;
      })
      .catch(function(err) {
        loadErr = (err && err.message) ? err.message : String(err);
        loading = null;  // allow retry
        console.error(TAG, 'loadPagefind: import failed:', err);
        throw err;
      });
    return loading;
  }

  // Kick the load now — don't wait for focus. If we error, store and surface
  // when the user actually searches.
  loadPagefind().catch(function(){ /* error already logged + stored */ });

  function escHtml(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  function formatDate(iso) {
    if (!iso) return '';
    var dt = new Date(iso + 'T12:00:00');
    if (isNaN(dt)) return iso;
    return dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  }
  function dateFromUrl(url) {
    var m = (url || '').match(/(\d{4}-\d{2}-\d{2})/);
    return m ? m[1] : '';
  }
  // Pull the headline portion out of "Claude AI Daily Brief — May 3, 2026 | Headline | Headline2"
  function stripPrefix(title) {
    if (!title) return '';
    var pipeIdx = title.indexOf('|');
    return pipeIdx > -1 ? title.substring(pipeIdx + 1).trim() : title;
  }
  // Pagefind already wraps matched terms in <mark>. Sanitize everything else.
  // We allow only <mark>...</mark> through, escape the rest.
  function sanitizeMarked(html) {
    if (!html) return '';
    return String(html)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
      .replace(/&lt;mark&gt;/g, '<mark>')
      .replace(/&lt;\/mark&gt;/g, '</mark>');
  }

  function showBox(html) { box.innerHTML = html; box.classList.add('open'); }
  function close() { box.classList.remove('open'); activeIdx = -1; }

  function doSearch(query) {
    lastQuery = query;
    console.log(TAG, 'doSearch:', JSON.stringify(query), '| pagefind=', !!pagefind, '| loadErr=', loadErr);

    if (!query || query.length < 2) { close(); return; }

    if (loadErr) {
      showBox('<div class="sr-empty">Search failed to load (' + escHtml(loadErr) + '). Try refreshing the page.</div>');
      return;
    }

    if (!pagefind) {
      showBox('<div class="sr-empty">Loading search...</div>');
      loadPagefind()
        .then(function() {
          if (lastQuery === query) doSearch(query);
        })
        .catch(function(err) {
          showBox('<div class="sr-empty">Search failed to load (' + escHtml(err.message || 'unknown') + '). Try refreshing.</div>');
        });
      return;
    }

    var t0 = Date.now();
    pagefind.search(query).then(function(result) {
      if (lastQuery !== query) return;  // race guard
      var hits = (result && result.results) || [];
      console.log(TAG, 'pagefind.search returned', hits.length, 'hits for', JSON.stringify(query), 'in', (Date.now()-t0)+'ms');
      Promise.all(hits.slice(0, 12).map(function(r){ return r.data(); }))
        .then(function(items) {
          if (lastQuery !== query) return;
          var reports = items.filter(function(it){ return /\/reports\/claude-ai-daily-/.test(it.url); });
          render(reports, reports.length, query);
        })
        .catch(function(err) {
          console.error(TAG, 'data() resolution failed:', err);
          showBox('<div class="sr-empty">Search error resolving results: ' + escHtml(err.message || 'unknown') + '</div>');
        });
    }).catch(function(err) {
      console.error(TAG, 'pagefind.search failed:', err);
      showBox('<div class="sr-empty">Search error: ' + escHtml(err.message || 'unknown') + '</div>');
    });
  }

  function render(items, totalCount, query) {
    activeIdx = -1;
    if (!items.length) {
      showBox('<div class="sr-empty">No matching reports found</div>');
      return;
    }
    var html = '<div class="sr-count">' + totalCount + ' report' + (totalCount !== 1 ? 's' : '') + ' found</div>';
    items.forEach(function(it, i) {
      var date = (it.meta && it.meta.date) || dateFromUrl(it.url);
      var titleSrc = (it.meta && it.meta.title) || it.url;
      var headline = stripPrefix(titleSrc);
      // Pagefind puts a contextual snippet with <mark> tags in `excerpt`.
      var excerpt  = sanitizeMarked(it.excerpt || '');

      // Scroll-To-Text fragment so the browser jumps to the match in the report.
      var frag = (query || '').substring(0, 60).replace(/\s+\S*$/, '');
      var href = it.url + (frag ? '#:~:text=' + encodeURIComponent(frag) : '');

      html += '<a class="sr-item" href="' + escHtml(href) + '" data-idx="' + i + '" role="option">'
            +   '<div class="sr-date">' + escHtml(formatDate(date)) + '</div>'
            +   '<div class="sr-title">' + escHtml(headline) + '</div>'
            +   '<div class="sr-match">' + excerpt + '</div>'
            + '</a>';
    });
    showBox(html);
  }

  // Debounced input handler.
  var debounce;
  input.addEventListener('input', function() {
    var v = this.value.trim();
    console.log(TAG, 'input event, value:', JSON.stringify(v));
    clearTimeout(debounce);
    debounce = setTimeout(function(){ doSearch(v); }, 120);
  });
  input.addEventListener('focus', function() {
    console.log(TAG, 'focus event');
  });

  input.addEventListener('keydown', function(e) {
    var items = box.querySelectorAll('.sr-item');
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      activeIdx = Math.min(activeIdx + 1, items.length - 1);
      for (var i = 0; i < items.length; i++) items[i].classList.toggle('active', i === activeIdx);
      if (items[activeIdx]) items[activeIdx].scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      activeIdx = Math.max(activeIdx - 1, 0);
      for (var j = 0; j < items.length; j++) items[j].classList.toggle('active', j === activeIdx);
      if (items[activeIdx]) items[activeIdx].scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter' && activeIdx >= 0 && items[activeIdx]) {
      e.preventDefault();
      items[activeIdx].click();
    } else if (e.key === 'Escape') {
      close();
      input.blur();
    }
  });

  document.addEventListener('click', function(e) {
    if (!e.target.closest('.search-wrap')) close();
  });
  document.addEventListener('keydown', function(e) {
    if (e.key === '/' && document.activeElement !== input && !e.ctrlKey && !e.metaKey) {
      if (document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
        e.preventDefault();
        input.focus();
      }
    }
  });
})();
