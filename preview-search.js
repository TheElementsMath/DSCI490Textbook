<script>
(function () {
  const input = document.getElementById('book-search-input');
  const results = document.getElementById('search-results');
  if (!input || !results) return;

  const candidates = Array.from(document.querySelectorAll('h1, h2, h3, p, li'))
    .filter(function (node) { return !node.closest('#book-search'); });

  function anchorFor(node) {
    if (node.id) return node.id;
    let current = node.previousElementSibling;
    while (current) {
      if (/^H[1-3]$/.test(current.tagName) && current.id) return current.id;
      current = current.previousElementSibling;
    }
    return '';
  }

  input.addEventListener('input', function () {
    const query = input.value.trim().toLowerCase();
    results.innerHTML = '';
    if (query.length < 2) {
      results.style.display = 'none';
      return;
    }

    const seen = new Set();
    const matches = [];
    for (const node of candidates) {
      const text = node.textContent.replace(/\s+/g, ' ').trim();
      if (!text.toLowerCase().includes(query)) continue;
      const anchor = anchorFor(node);
      const key = anchor + '|' + text.slice(0, 100);
      if (seen.has(key)) continue;
      seen.add(key);
      matches.push({ anchor: anchor, text: text });
      if (matches.length === 20) break;
    }

    if (!matches.length) {
      results.textContent = 'No matches found.';
    } else {
      for (const match of matches) {
        const link = document.createElement('a');
        link.href = match.anchor ? '#' + match.anchor : '#';
        link.textContent = match.text.length > 180 ? match.text.slice(0, 177) + '...' : match.text;
        link.addEventListener('click', function () { results.style.display = 'none'; });
        results.appendChild(link);
      }
    }
    results.style.display = 'block';
  });
}());
</script>
