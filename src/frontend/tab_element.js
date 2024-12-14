import {toggleElementVisibility} from "./element_utils";

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
        this.changeTabName(tabName);
        if (this.containerTabHeadElement.children.length > 0)  // add separator (if not first tab)
        {
            const separatorElement = document.createElement("div");
            separatorElement.classList.add("tab-separator");
            separatorElement.innerHTML = "&nbsp;|&nbsp;";
            this.containerTabHeadElement.appendChild(separatorElement);
        }
        this.containerTabHeadElement.appendChild(this.tabLabelElement);


        if (id === null) {
            id = this.id + "-tab-content-" + tabName
        }
        this.containerTabBodyElement = containerTabElementWrapper.tabBodyElement;
        this.id = id;
        this.tabContentElement = document.createElement("div");
        this.tabContentElement.id = "tab-content-" + id;
        this.tabContentElement.classList.add("tab");
        this.containerTabBodyElement.appendChild(this.tabContentElement);

        this.tabLabelElement.addEventListener("click", () => {
            this.containerTabElementWrapper.selectTab(this);
        });
        this.destroyed = false;

        if (creator !== this.containerTabElementWrapper) {
            this.containerTabElementWrapper.pushTab(this);
        }
    }

    changeTabName(newName) {
        this.tabLabelElement.textContent = newName;
    }

    hide() {
        toggleElementVisibility(this.tabContentElement, false);
    }

    show() {
        toggleElementVisibility(this.tabContentElement, true);
    }

    select() {
        this.tabLabelElement.classList.add("active");
        this.tabLabelElement.classList.remove("remind");
        this.show();
    }

    unselect() {
        this.tabLabelElement.classList.remove("active");
        this.hide();
    }

    destroy() {
        if (this.destroyed) {
            return false;
        }
        this.destroyed = true;
        this.containerTabBodyElement.removeChild(this.tabContentElement);
        if (this.tabLabelElement.previousSibling)  // remove separator (if exists
            this.containerTabHeadElement.removeChild(this.tabLabelElement.previousSibling);
        this.containerTabHeadElement.removeChild(this.tabLabelElement);
        this.containerTabElementWrapper.removeTab(this);
        return true;
    }
}


export class TabElementWrapper {
    constructor(containerElement, id) {
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
    }

    createTab(tabName, id=null) {
        const tabContentElementWrapper = new TabPageElementWrapper(this, tabName, id, this);
        this.pushTab(tabContentElementWrapper);
        return tabContentElementWrapper;
    }

    pushTab(tab) {
        if (this.tabs.includes(tab)) {
            return;
        }
        this.tabs.push(tab);
    }

    selectTab(tab) {
        this.tabs.forEach((tab) => {
            tab.unselect();
        });
        tab.select();
    }

    removeTabByIndex(tabIndex) {
        if (tabIndex < 0 || tabIndex >= this.tabs.length) {
            return;
        }
        this.tabs[tabIndex].destroy();
    }

    removeTab(tab) {
        tab.destroy();
        this.tabs = this.tabs.filter((tab) => tab !== tab);
    }

}