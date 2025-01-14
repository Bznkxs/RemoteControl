export class SearchWidget {
    constructor() {
        this.searchDiv = document.createElement('div');
        this.searchDiv.id = 'search-widget';
        this.searchDiv.style.visibility = 'hidden';
        this.searchInput = document.createElement('input');
        this.searchInput.type = 'text';
        this.searchInput.id = 'search-input';
        this.searchInput.placeholder = 'Search';
        this.searchLabel = document.createElement('label');
        this.searchLabel.htmlFor = 'search-input';
        this.searchLabel.innerHTML = '';
        this.searchNextButton = document.createElement('div');
        this.searchNextButton.id = 'search-next';
        this.searchNextButton.classList.add('search-button');
        this.searchNextButton.innerHTML = '►';
        this.searchPrevButton = document.createElement('div');
        this.searchPrevButton.id = 'search-prev';
        this.searchPrevButton.classList.add('search-button');
        this.searchPrevButton.innerHTML = '◄';

        this.searchDiv.appendChild(this.searchInput);
        this.searchDiv.appendChild(this.searchLabel);
        this.searchDiv.appendChild(this.searchPrevButton);
        this.searchDiv.appendChild(this.searchNextButton);
        document.body.appendChild(this.searchDiv);

        this.searchInput.addEventListener('input', (e) => {
            if (this.searchDisabled) return;
            console.log("[SearchWidget] Input", this);
            this.searchText(this.searchInput.value);
            this.searchNext();
        });
        this.searchNextButton.addEventListener('click', (e) => {
            if (this.searchDisabled) return;
            this.searchNext();
        });
        this.searchPrevButton.addEventListener('click', (e) => {
            if (this.searchDisabled) return;
            this.searchPrev();
        });

        this.searchInput.addEventListener('keydown', (e) => {
            if (!this.searchDisabled && e.key === 'Enter') {
                if (e.shiftKey) {
                    this.searchPrev();
                } else {
                    this.searchNext();
                }
            }
        });

        this._searchText = '';
        this.searchIndex = -1;
        this.searchVisible = false;
        this.searchResults = [];

        this.searchDisabled = true;

        document.body.addEventListener('keydown', (e) => {
            if (this.searchDisabled) return;
            if (e.key === 'Escape') {
                this.hide();
            }
        });

        document.body.addEventListener('keydown', (e) => {

            if (this.searchDisabled) return;
            if (e.key === 'f' && e.ctrlKey) {
                this.show();
                this.searchText(this.searchInput.value);
            }
        }
        );

        this.container = document.body;

        this.updateSearchButtonEnabled();
    }

    show() {
        if (this.searchDisabled) return;
        this.searchDiv.style.visibility = 'visible';
        this.searchInput.focus();
        this.searchInput.select();
        this.searchVisible = true;
    }

    hide() {
        if (this.searchDisabled) return;
        this.searchDiv.style.visibility = 'hidden';
        this.searchVisible = false;
    }

    updateCurrentSearch(newSearchIndex) {
        if (this.searchResults.length === 0) {
            return false;
        }
        if (this.searchIndex >= 0) {
            this.searchResults[this.searchIndex][0].classList.remove('current-search-result');
        }
        this.searchIndex = newSearchIndex;
        console.log("[SearchWidget] update", newSearchIndex, this.searchResults[this.searchIndex]);
        this.searchResults[this.searchIndex][0].scrollIntoView();
        this.searchResults[this.searchIndex][0].classList.add('current-search-result');
        this.searchLabel.innerHTML = `${this.searchIndex + 1}/${this.searchResults.length}`;
        return true;
    }

    searchNext() {
        if (this.updateCurrentSearch((this.searchIndex + 1) % this.searchResults.length)) {
            console.log("[SearchWidget] Next", this.searchResults[this.searchIndex]);
        }

    }

    searchPrev() {
        if (this.updateCurrentSearch((this.searchIndex - 1 + this.searchResults.length) % this.searchResults.length)) {
            console.log("[SearchWidget] Prev", this.searchResults[this.searchIndex]);
        }
    }

    selectContainer(container) {
        if (this.container !== container) {
            this.container = container;
            this.clearSearch();
        }
    }

    setDisabled(disabled) {
        this.searchDisabled = disabled;
        if (disabled) {
            this.hide();
        }
    }

    updateSearchButtonEnabled() {
        if (this.searchDisabled || this.searchResults.length === 0) {
            this.searchNextButton.classList.add('disabled');
            this.searchPrevButton.classList.add('disabled');
        } else {
            this.searchNextButton.classList.remove('disabled');
            this.searchPrevButton.classList.remove('disabled');
        }
    }

    addElementToSearch(element) {
        const index = this.searchResults.length;
        const clickHandler = (e) => {
            this.updateCurrentSearch(index);
        }

        this.searchResults.push([element, clickHandler]);
        element.addEventListener('click', clickHandler);
        element.classList.add('search-result');

    }

    removeElementFromSearch(element, clickHandler) {
        element.classList.remove('search-result');
        element.classList.remove('current-search-result');
        element.removeEventListener('click', clickHandler);
    }

    clearSearch() {
        const oldStatus = {
            text: this._searchText,
            searchIndex: this.searchIndex,
            searchResults: [...this.searchResults]
        };
        this._searchText = '';
        for (const element of this.searchResults) {
            this.removeElementFromSearch(...element);
        }
        this.searchResults = [];
        this.searchIndex = -1;
        this.searchLabel.innerHTML = "";
        this.updateSearchButtonEnabled();
        return oldStatus;
    }

    getVisibility(element) {
        if (element === this.container || element === document.body) {
            return true;
        }
        const style = window.getComputedStyle(element);
        if (style.display === 'none' || style.visibility === "hidden" || style.opacity === "0") {
            return false;
        }
        return this.getVisibility(element.parentElement);
    }

    searchText(text) {
        const oldStatus = this.clearSearch();
        if (text === '') {
            return;
        }
        const elements = this.container.querySelectorAll('div, span');
        elements.forEach((element) => {
            if (this.getVisibility(element) === false) {
                return;
            }
            const textContentList = Array.from(element.childNodes)
                .map(child => [child.nodeType, child.textContent]);
            const textNodeContent = textContentList.map(([nodeType, text]) => nodeType === Node.TEXT_NODE ? text : "\0").join('');

            if (textNodeContent.includes(text)) {
                this.addElementToSearch(element);
            }
            else {
                const textContentListShortened = textContentList.map(([nodeType, _text]) => [nodeType, _text.length <= 2 * text.length - 1 ? _text : _text.slice(0, text.length - 1) + "\0" + _text.slice(_text.length-text.length+1)]);
                const textContent = textContentListShortened.map(([nodeType, text]) => text).join('');
                const textNodeIndex = textContentListShortened.map(([nodeType, text], index) => new Array(text.length).fill(index)).flat();
                try {
                    new RegExp(text);
                } catch (e) {
                    this.searchInput.classList.add('error');
                    return;
                }
                this.searchInput.classList.remove('error');
                for (const match of textContent.matchAll(text)) {
                    const start = match.index;
                    const end = start + match[0].length;
                    const startIndex = textNodeIndex[start];
                    const endIndex = textNodeIndex[end - 1];
                    if (startIndex !== endIndex) {
                        this.addElementToSearch(element);
                        console.log("[SearchWidget] Match", element, startIndex, endIndex, start, end, JSON.stringify(textContent), textContentListShortened, textNodeIndex);
                        break;
                    }
                }
            }
        });
        this._searchText = text;
        this.searchLabel.innerHTML = `${this.searchResults.length} results`;
        let sameAsOld = true;
        if (oldStatus.text !== this._searchText) {
            sameAsOld = false;
        }
        else if (oldStatus.searchResults.length !== this.searchResults.length) {
            sameAsOld = false;
        }
        else {
            for (let i = 0; i < this.searchResults.length; i++) {
                if (oldStatus.searchResults[i][0] !== this.searchResults[i][0]) {
                    sameAsOld = false;
                    break;
                }
            }
        }
        if (sameAsOld) {
            this.updateCurrentSearch(oldStatus.searchIndex);
        }

        this.updateSearchButtonEnabled();
    }
}