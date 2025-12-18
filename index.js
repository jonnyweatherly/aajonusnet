async function search(input) {
    const searchValue = input.value.toLowerCase();
    const grid = document.querySelector('.grid');
    const results_DOM = document.querySelector('.results');
    const search_min_length = 3;
    results_DOM.innerHTML = '';

	const hasThreeConsecutiveChars = /.*\S{3,}.*/.test(searchValue);

    if (!hasThreeConsecutiveChars) {
        // Less than 3 consecutive non-space characters, ignore this search
        document.querySelector('.grid').style.display = 'block';
        document.querySelector('.results').style.display = 'none';
        return;
    }
    
    if (searchValue.length >= search_min_length) {
        grid.style.display = 'none';
        results_DOM.style.display = 'block';
    
        const cards = document.querySelectorAll('.card-md');
        const fragmentExact = document.createDocumentFragment(); // Fragment for exact matches
        const fragmentPartial = document.createDocumentFragment(); // Fragment for partial matches
    
        for (let i = 0; i < cards.length; i++) {
        		const card = cards[i];
        		const title = card.querySelector('h2').textContent.toLowerCase();
        		const content = card.querySelector('.data').innerHTML.toLowerCase();
        		const link = card.querySelector('.read-more').href;
        		const [exactResults, partialResults] = await highlightSearchText(content, searchValue, link);
    
		   if (exactResults.length > 0) {
                const resultCard = createResultCard(card, [...exactResults, ...partialResults], link);
                fragmentExact.appendChild(resultCard); // Append the result card to the exact matches fragment
            } else if (partialResults.length > 0) {
                const resultCard = createResultCard(card, partialResults, link);
                fragmentPartial.appendChild(resultCard); // Append the result card to the partial matches fragment
            }
        }
    
        if (fragmentExact.childElementCount === 0 && fragmentPartial.childElementCount === 0) {
        		const noResults = document.createElement('p');
        		noResults.textContent = 'No results found';
        		fragmentExact.appendChild(noResults); // Append the "No results found" message to the fragment
        }
    
        results_DOM.appendChild(fragmentExact); // Append exact matches
        results_DOM.appendChild(fragmentPartial); // Append partial matches
    } else {
        grid.style.display = 'block';
        results_DOM.style.display = 'none';
    }
}

function createResultCard(card, results, link) {
    // Create a new card for the search result
    const resultCard = document.createElement('div');
    resultCard.className = 'card';

    const resultTitle = document.createElement('h2');
    resultTitle.innerHTML = `<a class="result-link" href="${link}">${card.querySelector('h2').textContent}</a>`;
    resultCard.appendChild(resultTitle);
    // Convert results array to Set to remove duplicates
    const uniqueResults = [...new Set(results)];

    for (let result of uniqueResults) {
        const resultContent = document.createElement('p');
        resultContent.innerHTML = result;
        resultCard.appendChild(resultContent);
    }

    return resultCard;
}
          

async function highlightSearchText(text, searchValue ,link) {
    var maxLength = 200; // Maximum number of characters to display before and after the search value
    
    let searchNoTrim = searchValue;
    searchValue = searchValue.trim()
    let words = searchValue.split(" ").filter(
        word => word.length >= 3 && ["and","the"].indexOf(word) == -1 
        ).join("|");

    let exactMatchRegex = new RegExp(searchNoTrim, 'gi');
    let partialMatchRegex = new RegExp(words.split("|").map(word => 
        word.length === 3 ? `\\b${word}\\b` : word).join("|"), 'gi');
            
    let exactMatches = findMatches(text, searchNoTrim, exactMatchRegex, maxLength, link);
    let partialMatches = findMatches(text, words, partialMatchRegex, maxLength, link);

 // Return two separate arrays for exact and partial matches
    return [exactMatches, partialMatches];
}

function findMatches(text, searchValue, regex, maxLength, link) {
    let matches = text.match(regex);
    let results = [];
    if (matches == null) {
        return results;
    }

    let idx = text.indexOf(matches[0]);

    while (idx != -1) {
        let start = Math.max(0, idx - maxLength);
        let end = Math.min(text.length, idx + maxLength);
        let result = text.substring(start, end);
        let s = result.substr(0,result.length);
        text = text.substring(end);

        let subMatches = result.match(regex);
        if(subMatches == null) {
            idx = -1;
            continue;
        }
        let set_Matchs = [...new Set(subMatches)];
        let set_words = [...new Set(searchValue.split("|"))];

        // make sure the search value terms exist is in the result
        if(set_Matchs.indexOf(searchValue) != -1 || set_Matchs.length == set_words.length) {
            for(let subMatch of set_Matchs) {
                result = result.replaceAll(subMatch, '<span class="highlight">' + subMatch + '</span>');
            }

            results.push(`<a class='result-link' href=${link}&len=${end-start}&s=${encodeURIComponent(s)}>${result}</a><br><br><hr>`);
        }

        matches = text.match(regex);
        if (matches == null) {
            idx = -1;
            continue;
        }

        idx = text.indexOf(matches[0]);
    }

    return results;
}

function goBack() {
    if (document.referrer == "" || document.referrer.indexOf(window.location.hostname) < 0) {
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
		search(searchInput)
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

if (document.getElementById("scrollToThis"))
scrollToElement(document.getElementById("scrollToThis"));