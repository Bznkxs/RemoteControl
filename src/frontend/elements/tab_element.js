import {toggleElementVisibility} from "./element_utils.js";

export class TabPageElementWrapper {
    /**
     * This class is designed such that it supports another owner other than
     * the container. However, it is not safe
     * to call member functions after destroyed.
     * @param containerTabElementWrapper
     * @param tabName
     * @param id
     * @param creator
     */
    constructor(containerTabElementWrapper, tabName, id=null, creator=null) {

        this.containerTabElementWrapper = containerTabElementWrapper;
        this.containerTabHeadElement = containerTabElementWrapper.tabHeadElement;
        this.tabLabelElement = document.createElement("div");
        this.tabLabelElement.classList.add("tab-label");
        this.innerTabLabelElement = document.createElement("div");
        this.innerTabLabelElement.classList.add("inner-tab-label");
        this.tabLabelElement.appendChild(this.innerTabLabelElement);
        this.changeTabName(tabName);


        if (id === null) {
            id = this.id + "-tab-content-" + tabName
        }
        this.containerTabBodyElement = containerTabElementWrapper.tabBodyElement;
        this.id = id;
        this.tabContentElement = document.createElement("div");
        this.tabContentElement.id = "tab-content-" + id;
        this.tabContentElement.classList.add("tab");


        this.tabLabelElement.addEventListener("click", () => {
            this.containerTabElementWrapper.selectTab(this);
        });
        this.destroyed = false;

        if (creator !== null && creator !== this.containerTabElementWrapper) {
            this.containerTabElementWrapper.pushTab(this);
        }
    }

    changeTabName = (newName) => {
        console.log("[TabPageElementWrapper] Change tab name", this.innerTabLabelElement, newName)
        this.innerTabLabelElement.textContent = newName;
    }

    hide = () => {
        toggleElementVisibility(this.tabContentElement, false);
    }

    show = () => {
        toggleElementVisibility(this.tabContentElement, true);
    }

    select = () => {
        this.tabLabelElement.classList.add("active");
        this.tabLabelElement.classList.remove("remind");
        this.show();
    }

    isSelected = () => {
        return this.tabLabelElement.classList.contains("active");
    }

    unselect = () => {
        this.tabLabelElement.classList.remove("active");
        this.hide();
    }

    destroy() {
        if (this.destroyed) {
            return false;
        }
        this.destroyed = true;
        this.containerTabElementWrapper.removeTab(this, false);
        // all other actions below this line
        return true;
    }
}


export class TabElementWrapper {
    constructor(containerElement, id, addTabButton=false, closeButton=false) {
        this.containerElement = containerElement;
        this.id = id;
        this.tabElement = document.createElement("div");
        this.tabElement.id = "tab-" + id;
        this.tabElement.classList.add("borderless-frame");
        this.tabHeadElement = document.createElement("div");
        this.tabHeadElement.classList.add("tab-head");
        this.tabBodyElement = document.createElement("div");
        this.tabBodyElement.classList.add("tab-body");
        this.tabElement.appendChild(this.tabHeadElement);
        this.tabElement.appendChild(this.tabBodyElement);
        this.containerElement.appendChild(this.tabElement);

        this.tabs = [];

        if (addTabButton) {
            this.addTabButton = document.createElement("div");
            this.addTabButton.classList.add("tab-add-button");
            this.addTabButton.innerHTML = "+";
            this.addTabButtonClickListener = () => {
                console.log("[TabElementWrapper] Add tab button clicked, creating tab with default", this.defaultNewTabConfig)
                this.createTab(this.defaultNewTabConfig);
            }
            this.addTabButton.addEventListener("click", this.addTabButtonClickListener);
            const board = document.createElement("div")
            board.classList.add("tab-label-cover");
            this.tabHeadElement.appendChild(board);
            this.board = board;

            board.appendChild(this.addTabButton);

        }

        this.closeButton = closeButton;

        this.tabHeadElement.addEventListener('wheel', (e) => {
            console.log("[Tab]", e);
            // Check if the user is scrolling horizontally
            if (e.deltaY === 0) {
                // Scroll horizontally (deltaX will provide the horizontal scroll amount)
                this.tabHeadElement.scrollLeft += e.deltaX;
            } else {
                // If not scrolling horizontally, listen to vertical scroll
                this.tabHeadElement.scrollLeft += e.deltaY;
            }
            e.preventDefault();
        });

        this.onSelectedTabCallbacks = [];
        this.onTabChangeCallbacks = [];
    }

    defaultNewTabConfig = {
        tabClass: TabPageElementWrapper,
        tabName: "New Tab",
        id: null,
        showTab: true,
        otherConfig: {},
    }

    getNewTabConfig(config) {
        const retVal = {};
        for (const key in this.defaultNewTabConfig) {
            retVal[key] = config[key] || this.defaultNewTabConfig[key];
            if (typeof config[key] === "object" && typeof this.defaultNewTabConfig[key] === "object") {
                retVal[key] = {...config[key]};
                for (const subKey in this.defaultNewTabConfig[key]) {
                    if (retVal[key][subKey] === undefined)
                        retVal[key][subKey] = this.defaultNewTabConfig[key][subKey];
                }
            }
            if (typeof retVal[key] === "function" && (retVal[key].prototype === undefined || retVal[key].prototype && retVal[key].prototype.constructor === Function)) {

                retVal[key] = retVal[key]();
            }
        }
        return retVal;
    }

    createTab = ({tabClass, tabName, id, showTab, otherConfig}=this.defaultNewTabConfig) => {
        console.log("[TabElementWrapper] Creating tab", tabName, id, showTab, otherConfig);
        ({tabClass, tabName, id, showTab, otherConfig} = this.getNewTabConfig({tabClass, tabName, id, showTab, otherConfig}));
        console.log("[TabElementWrapper] Creating tab", tabName, id, showTab, otherConfig);
        const tabContentElementWrapper = new tabClass(this, tabName, id, null, otherConfig);
        if (this.closeButton) {
            const closeButton = document.createElement("div");
            closeButton.classList.add("tab-close-button");
            closeButton.innerHTML = "&times;";
            closeButton.addEventListener("click", (event) => {
                tabContentElementWrapper.destroy();
                event.stopPropagation();  // prevent tab from being selected
            });
            tabContentElementWrapper.tabLabelElement.appendChild(closeButton);
        }
        this.pushTab(tabContentElementWrapper, showTab);
        return tabContentElementWrapper;
    }

    pushTab = (tab, showTab=true) => {
        console.log("[TabElementWrapper] Pushing tab", tab.id, showTab, this.tabs.map((tab) => tab.id));
        if (this.tabs.includes(tab)) {
            return;
        }
        if (tab.containerTabElementWrapper && tab.containerTabElementWrapper !== this) {
            throw new Error("Tab already has a container");
        }
        tab.containerTabElementWrapper = this;
        let separatorElement = null;
        if (this.tabs.length > 0)  // add separator (if not first tab)
        {
            separatorElement = document.createElement("div");
            separatorElement.classList.add("tab-separator");
            separatorElement.innerHTML = "|";
        }
        if (this.addTabButton) {
            if (separatorElement)
                this.tabHeadElement.insertBefore(separatorElement, this.board);
            this.tabHeadElement.insertBefore(tab.tabLabelElement, this.board);

            // animation
            tab.tabLabelElement.classList.add("no-width");
            setTimeout(() => {
                tab.tabLabelElement.classList.remove("no-width");
            }, 1);


        } else {
            if (separatorElement)
                this.tabHeadElement.appendChild(separatorElement);
            this.tabHeadElement.appendChild(tab.tabLabelElement);
        }

        this.tabBodyElement.appendChild(tab.tabContentElement);
        this.tabs.push(tab);

        this.onTabChangeCallbacks.forEach((callback) => {
            callback({type: "add", tab: tab});
        })

        if (showTab) {
            this.selectTab(tab);
        } else {
            tab.hide();
        }

    }

    selectTab = (tab) => {
        this.tabs.forEach((_tab) => {
            _tab.unselect();
            console.log("[TabElementWrapper] Unselecting tab", _tab.id)
        });

        tab.select();
        this.currentTab = tab;
        console.log("[TabElementWrapper] Selecting tab", tab.id, new Error().stack)
        this.onSelectedTabCallbacks.forEach((callback) => {
            callback(tab);
        });
    }

    onSelectedTab = (callback) => {
        this.onSelectedTabCallbacks.push(callback);
    }

    removeTab = (tab, destroy=true) => {
        if (!this.tabs.includes(tab)) {
            return;
        }

        let separatorElement = null;
        let nextElementSibling = tab.tabLabelElement.nextElementSibling;

        // if tab is first child
        if (this.tabs[0] === tab) {
            if (this.tabs.length > 1) {
                separatorElement = (tab.tabLabelElement.nextElementSibling);
                nextElementSibling = separatorElement.nextElementSibling;
            }
        } else {
            separatorElement = (tab.tabLabelElement.previousElementSibling);
        }

        if (tab.isSelected() && this.tabs.length > 1) {
            this.currentTab = null;
            const index = this.tabs.indexOf(tab);
            console.log("[TabElementWrapper] Removing selected tab: ", tab.id, "index", index)
            if (index === this.tabs.length - 1) {
                console.log("[TabElementWrapper] Removing selected tab: selecting previous tab", this.tabs[index - 1].id)
                this.selectTab(this.tabs[index - 1]);
            } else {
                console.log("[TabElementWrapper] Removing selected tab: selecting next tab", this.tabs[index + 1].id)
                this.selectTab(this.tabs[index + 1]);
            }
        }

        let moveLeft = 0;
        if (separatorElement) {
            moveLeft = separatorElement.offsetWidth;
        }
        moveLeft += tab.tabLabelElement.offsetWidth;
        let removed = false;
        // for (let element = nextElementSibling; element; element = element.nextElementSibling) {
        //     // element.style.transform = `translateX(-${moveLeft}px)`;
        //     // element.style.transition = 'transform 0.1s ease-in-out';
        //     element.addEventListener('transitionend', () => {
        //         element.style.transition = 'none';
        //         element.style.transform = 'translateX(0)';
        //         if (!removed) {
        //             removed = true;
        //             if (separatorElement) {
        //                 this.tabHeadElement.removeChild(separatorElement);
        //             }
        //             this.tabBodyElement.removeChild(tab.tabContentElement);
        //             this.tabHeadElement.removeChild(tab.tabLabelElement);
        //         }
        //
        //     });
        // }
        // prevent all events from being triggered in tabContentElement and tabLabelElement

        tab.tabLabelElement.addEventListener('transitionend', (event) => {

            console.log("[TabElementWrapper] Transition end", tab.id, event)
            if (event.propertyName !== "max-width") return;
            if (!removed) {
                removed = true;
                if (separatorElement) {
                    this.tabHeadElement.removeChild(separatorElement);
                }
                this.tabBodyElement.removeChild(tab.tabContentElement);
                this.tabHeadElement.removeChild(tab.tabLabelElement);
            }
        });
        // tab.tabLabelElement.style.transition = "";
        tab.tabLabelElement.classList.add("no-width");
        if (separatorElement) {
            separatorElement.classList.add("no-width");
        }



        // tab.tabContentElement.style.pointerEvents = 'none';
        // tab.tabLabelElement.style.pointerEvents = 'none';

        this.tabs = this.tabs.filter((_tab) => _tab !== tab);
        console.log("[TabElementWrapper] Removing tab: remaining", this.tabs.map((tab) => tab.id))

        this.onTabChangeCallbacks.forEach((callback) => {
            callback({type: "remove", tab: tab});
        });
        // console.log(new Error().stack)
        if (destroy) {
            tab.destroy();
        }
    }

    onTabChange = (callback) => {
        this.onTabChangeCallbacks.push(callback);
    }

}