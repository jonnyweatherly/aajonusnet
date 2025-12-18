// debounce + abort management
let searchTimeout = null;
let currentSearchController = null;

// escape helper for exact‑match detection
function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function createResultCard(title, snippets, link, query) {
  const card = document.createElement('div');
  card.className = 'card';

  // Title (only s=…)
  const h2 = document.createElement('h2');
  h2.innerHTML = `<a class="result-link" href="${link}?s=${encodeURIComponent(query)}">${title}</a>`;
  card.appendChild(h2);

  // Snippet links
  snippets.forEach(htmlSnippet => {
    // pull out plain text to re‑encode into &search=
    const tmp = document.createElement('div');
    tmp.innerHTML = htmlSnippet;
    const snippetText = tmp.textContent || tmp.innerText || '';

    const a = document.createElement('a');
    a.className = 'result-link';
    a.href = `${link}?s=${encodeURIComponent(query)}&search=${encodeURIComponent(snippetText)}`;

    const p = document.createElement('p');
    p.innerHTML = htmlSnippet;
    a.appendChild(p);

    card.appendChild(a);
  });

  return card;
}

async function performCloudSearch(query, controller) {
  const resultsDOM = document.querySelector('.results');

  try {
    const response = await fetch('cloudsearch.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({ query })
    });

    if (!response.ok) {
      resultsDOM.innerHTML = '<p>Error performing search.</p>';
      return;
    }

    const data = await response.json();
    // clear old
    resultsDOM.innerHTML = '';

    // fragments for grouping
    const fragTitle   = document.createDocumentFragment();
    const fragExact   = document.createDocumentFragment();
    const fragPartial = document.createDocumentFragment();

    // count total snippets
    const totalResults = data.reduce(
      (sum, item) => sum + (item.sn?.length || 0),
      0
    );

    // build regex to detect exact‐phrase highlights
    const escapedQuery = escapeRegExp(query);
    const exactRegex   = new RegExp(
      `<span class="highlight">${escapedQuery}</span>`,
      'i'
    );

    // distribute each result into the right fragment
    data.forEach(item => {
      const { t: title, l: link, sn: snippets = [] } = item;

      if (snippets.length === 0) {
        // a pure title match
        fragTitle.appendChild(createResultCard(title, [], link, query));

      } else {
        // snippet card: decide exact vs partial by looking for the full phrase‑highlight
        const isExact = snippets.some(s => exactRegex.test(s));
        if (isExact) {
          fragExact.appendChild(createResultCard(title, snippets, link, query));
        } else {
          fragPartial.appendChild(createResultCard(title, snippets, link, query));
        }
      }
    });

    // 1) total summary
    const summary = document.createElement('p');
    summary.textContent = `There are ${totalResults} results.`;
    resultsDOM.appendChild(summary);

    // 2) title matches
    resultsDOM.appendChild(fragTitle);

    // 3) exact matches
    resultsDOM.appendChild(fragExact);

    // 4) partial heading (if needed)
    if (fragPartial.childElementCount > 0) {
      const header = document.createElement('p');
      header.style.fontStyle = 'italic';
      header.style.margin    = '20px 0 10px';
      header.textContent     = 'Partial matches:';
      resultsDOM.appendChild(header);
    }

    // 5) partial matches
    resultsDOM.appendChild(fragPartial);

  } catch (err) {
    if (err.name === 'AbortError') return;
    console.error('Error during cloud search:', err);
    document.querySelector('.results').innerHTML = '<p>Error performing search.</p>';
  }
}

function search(input) {
  const searchValue        = input.value.toLowerCase();
  const trimmedSearchValue = searchValue.trim();
  const grid               = document.querySelector('.grid');
  const resultsDOM         = document.querySelector('.results');

  resultsDOM.innerHTML = '';
  document.getElementById('clear-icon').style.display =
    searchValue.length > 0 ? 'block' : 'none';

  const words = searchValue
    .split(/\s+/)
    .filter(w => w && w !== 'the');

  // ignore <3‑char queries
  if (words.every(w => w.length < 3)) {
    grid.style.display    = 'block';
    resultsDOM.style.display = 'none';
    return;
  }

  grid.style.display      = 'none';
  resultsDOM.style.display = 'block';
  resultsDOM.innerHTML     = '<p>Loading...</p>';

  // debounce + abort
  if (searchTimeout) clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    if (currentSearchController) currentSearchController.abort();
    currentSearchController = new AbortController();
    performCloudSearch(searchValue, currentSearchController);
  }, 300);
}


// Clear button
function clearSearch() {
    const searchEl = document.getElementById('search');
    searchEl.value = '';
    document.getElementById('clear-icon').style.display = 'none';
    document.querySelector('.grid').style.display = 'block';
    document.querySelector('.results').style.display = 'none';
    document.querySelector('.results').innerHTML = '';
}

function goBack() {
    if (document.referrer == "" || document.referrer.indexOf(window.location.hostname) < 0 || window.history.length <= 1) {
        // There is no previous page, go to the homepage
        window.location.href = '/';
    } else {
        // There is a previous page in the history stack, go back to it
        window.history.back();
    }
}

window.onload = function() {
	var searchInput = document.getElementById('search');
	if (searchInput){
		searchInput.focus();
		search(searchInput) // may be not needed
        searchInput.addEventListener('keyup', function(event) {
            // Key code 13 is the "Return" key
            if (event.keyCode === 13) {
                // Remove focus to close the keyboard
                searchInput.blur();
            }
        });
	}
};

function scrollToElement(element) {
	var viewHeight = window.innerHeight;
	var elementPosition = element.getBoundingClientRect().top;
	var scrollPosition = elementPosition - (viewHeight / 2);
	window.scrollBy({
		top: scrollPosition,
		behavior: 'smooth'
     });
}
function scrollToPosition() {
    const element = document.getElementById("scrollToThis");
    if (element) {
        scrollToElement(element);
        return;
    }
    const specialBlocks = document.querySelectorAll("code, pre");
    for (let block of specialBlocks) {
        const index = block.textContent.indexOf('<span id="scrollToThis"></span>');
        if (index !== -1) {
            scrollToElement(block);
            // Remove the <span id="scrollToThis"></span> from the text content
            block.textContent = block.textContent.replace('<span id="scrollToThis"></span>', '');
            return;
         }
     }
}
scrollToPosition();

document.body.addEventListener('click', function(e) {
    var target = e.target;
    
    // Traverse up to find the anchor tag
    while (target && target.tagName !== 'A') {
        target = target.parentNode;
    }
    
    // If an anchor tag is found and it matches the criteria
    if (target && /\.(jpg|png|gif)$/.test(target.href)) {
        e.preventDefault();
        var imgSrc = target.href;
        var previewDiv = document.createElement('div');
        previewDiv.className = 'image-preview';
        var img = document.createElement('img');
        img.src = imgSrc;
        img.style.maxWidth = '100%';
        img.style.height = 'auto';
        img.style.display = 'block';
        img.style.margin = '10px auto';
        img.style.border = '1px solid #ddd';
        previewDiv.appendChild(img);

        // Toggle the image preview
        if (target.nextElementSibling && target.nextElementSibling.className === 'image-preview') {
            target.parentNode.removeChild(target.nextElementSibling);
        } else {
            target.parentNode.insertBefore(previewDiv, target.nextSibling);
        }
    }
});

function filterCategory(category, sanitizedCategory, element) {
  // Deselect all categories
  event.preventDefault();
  var categories = document.querySelectorAll('.categories a');
  for (var i = 0; i < categories.length; i++) {
    categories[i].classList.remove('chosen-link');
  }

  // Clear search input
  var searchInput = document.getElementById('search');
  searchInput.value = '';
  search(searchInput);


  // Select the clicked category
  element.classList.add('chosen-link');

  var cards = document.getElementsByClassName('card-md');
  for (var i = 0; i < cards.length; i++) {
    var card = cards[i];
    var cardCategory = card.getElementsByClassName('category')[0].innerText;

    if (category === 'All' || cardCategory.startsWith(category)) {
      card.style.display = '';
    } else {
      card.style.display = 'none';
    }
  }

  var notFoundMessage = document.getElementById('not-found');
  if (notFoundMessage) {
    notFoundMessage.style.display = 'none';
  }

  // Update URL without reloading the page
  if (category === 'All') {
    window.history.replaceState({}, '', '/');
  } else {
    window.history.replaceState({}, '', `/${sanitizedCategory}/`);
  }
}

document.addEventListener("DOMContentLoaded", function() {
  const input = document.getElementById('search');
  input.disabled = false;
  input.placeholder = 'Search';
  var removeHighlightsBtn = document.getElementById("removeHighlights");
  
  if (removeHighlightsBtn) {
    removeHighlightsBtn.addEventListener("click", function() {
        removeHighlights();
    });
  }
  
  // Check if running as a web app and article is open
  if (window.navigator.standalone && document.getElementById("share-button")) {
      document.getElementById("share-button").style.display = "inline-block";
  }
});

function removeHighlights() {
      var removeHighlightsBtn = document.getElementById("removeHighlights");
      if (!removeHighlightsBtn) {
          return;
      }
      // Remove highlights
      var highlighted = document.querySelectorAll(".highlight");
      for (var i = 0; i < highlighted.length; i++) {
        highlighted[i].outerHTML = highlighted[i].innerHTML;
      }

      // Hide the "X Remove Highlights" button
      removeHighlightsBtn.style.display = "none";
  
      // Update URL
      var url = window.location.href;
      url = url.split('?')[0];
      window.history.replaceState({}, '', url);
}

function shareArticle() {
    const url = window.location.href;

    // Check if Web Share API is supported
    if (navigator.share) {
        navigator.share({
            title: document.title,
            url: url
        }).then(() => {
            console.log("Successfully shared.");
        }).catch((error) => {
            console.log("Error sharing:", error);
        });
    } else {
      // Fallback to copying URL to clipboard
      const textArea = document.createElement("textarea");
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("Copy");
      textArea.remove();
      alert("URL copied to clipboard.");
    }
}