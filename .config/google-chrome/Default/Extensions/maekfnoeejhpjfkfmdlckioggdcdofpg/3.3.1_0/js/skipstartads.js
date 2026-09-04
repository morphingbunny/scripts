new class {

    #player;
    #observer;
    #antiAdblockObserver;

    constructor() {
        this.#init();
    }

    async #init() {
        this.#player = await this.#getEl(".html5-video-player");

        this.#checkAd();

        this.#observer = new MutationObserver(() => this.#checkAd());
        this.#observer.observe(document.body, {
            subtree: true,
            childList: true,
            attributeFilter: ["src"]
        });

        this.#antiAdblockObserver = new MutationObserver(() => this.#checkAntiAdblock());
        this.#antiAdblockObserver.observe(document.body, {
            subtree: true,
            childList: true,
        });
    }

    #checkAntiAdblock() {
        const el = document.querySelector("ytd-enforcement-message-view-model");
        if (!el) { return; }

        el.closest("ytd-popup-container")?.remove();
    }

    #checkAd() {
        const renderer = document.querySelector("ytd-display-ad-renderer");
        if (renderer) {
            renderer.closest("ytd-rich-item-renderer").style.setProperty("display", "none", "important");
        }

        const player = this.#player;
        if (!player.classList.contains("ad-showing")) { return; }

        const video = player.querySelector("video");
        if (!video) { return; }

        const btn = player.querySelector(".ytp-ad-skip-button");
        if (btn) {
            btn.click();
        } else {
            video.currentTime = isNaN(video.duration) ? 0 : video.duration
        }
    }

    async #getEl(selector) {
        while (true) {
            const el = document.querySelector(selector);
            if (el) { return el; }

            await new Promise(r => setTimeout(r, 10));
        }
    }

}();