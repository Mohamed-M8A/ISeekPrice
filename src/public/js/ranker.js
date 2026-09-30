/*
 * FILE: ranker.js
 * PURPOSE: Lightweight client-side personalization. Builds an inverted
 *          search index (word -> product IDs) from a binary feed file,
 *          logs which products the visitor clicks on into IndexedDB, then
 *          classifies the visitor into a spending-tendency "tag" used to
 *          reorder search results (cheapest-first / priciest-first).
 *
 * NOTE: This is a heuristic/experimental module — intentionally basic.
 * The site's core (search + product page) should be solid before this
 * gets more attention.
 *
 * DEPENDS ON: window.getCloudPath (defined in controller.js) must exist
 * before init() is called.
 *
 * SECTIONS:
 *   1) init — loads keyword weights + builds the inverted index
 *   2) initDB — opens the IndexedDB click-log store
 *   3) track — logs a click, weighted by matched keyword importance
 *   4) analyze — computes a rolling "spending tendency" tag from recent clicks
 *   5) applyBoost — reorders a result set based on the stored tag
 */
window.Ranker = {
    invertedIndex: new Map(),
    db: null,
    weights: {},

    async init() {
        this.initDB();
        
        try {
            const weightRes = await fetch("/public/json/weights.json");
            const data = await weightRes.json();
            this.weights = data.keywords ? data.keywords : data;
        } catch (e) {}

        const path = window.getCloudPath("search");
        if (!path) return;

        try {
            const res = await fetch("https://data.iseekprice.com/" + path);
            const buffer = await res.arrayBuffer();
            const view = new DataView(buffer);
            const wordCount = view.getUint32(4, true);
            const maxId = view.getUint32(12, true);
            const idSize = maxId <= 65535 ? 2 : 4;
            const decoder = new TextDecoder("utf-8");

            let offset = 16;
            for (let i = 0; i < wordCount; i++) {
                const len = view.getUint8(offset++);
                const word = decoder.decode(new Uint8Array(buffer, offset, len)).trim();
                offset += len;
                const count = view.getUint32(offset, true); 
                offset += 4;

                for (let j = 0; j < count; j++) {
                    const idx = idSize === 2 ? view.getUint16(offset, true) : view.getUint32(offset, true);
                    if (!this.invertedIndex.has(idx)) {
                        this.invertedIndex.set(idx, []);
                    }
                    this.invertedIndex.get(idx).push(word);
                    offset += idSize;
                }
            }
        } catch (e) {}
    },

    initDB() {
        const req = indexedDB.open("RankerLog", 1);
        req.onupgradeneeded = e => {
            const store = e.target.result.createObjectStore("v", { keyPath: "id", autoIncrement: true });
            store.createIndex("by_time", "t");
        };
        req.onsuccess = e => this.db = e.target.result;
    },

    track(idx, price) {
        if (!this.db || !this.invertedIndex.has(idx)) return;

        const words = this.invertedIndex.get(idx);
        let maxW = 1;
        let matchedKeywords = [];

        words.forEach(w => {
            if (this.weights[w]) {
                matchedKeywords.push(w);
                if (this.weights[w] > maxW) {
                    maxW = this.weights[w];
                }
            }
        });

        const tx = this.db.transaction("v", "readwrite");
        tx.objectStore("v").add({ 
            idx: idx, 
            p: price, 
            i: price * maxW, 
            w: maxW, 
            kw: matchedKeywords, 
            t: Date.now() 
        });

        tx.oncomplete = () => this.analyze();
    },

    analyze() {
        const store = this.db.transaction("v", "readonly").objectStore("v");
        store.getAll().onsuccess = (e) => {
            const data = e.target.result; 
            if (data.length < 3) return;

            const recentData = data.slice(-10);
            const avg = recentData.reduce((sum, item) => sum + item.i, 0) / recentData.length;
            
            let tag = avg > 3000 ? "UXVhbGl0eUV4cGxvcmVy" : (avg > 900 ? "U3RhbmRhcmRTZWVrZXI=" : "VmFsdWVPcHRpbWl6ZXI=");
            localStorage.setItem("_r_tag", tag);
        };
    },

    applyBoost(products) {
        const tag = localStorage.getItem("_r_tag");
        if (!tag) return products;

        return [...products].sort((a, b) => {
            if (tag === "UXVhbGl0eUV4cGxvcmVy") {
                return b.feed.price - a.feed.price;
            }
            if (tag === "VmFsdWVPcHRpbWl6ZXI=") {
                return a.feed.price - b.feed.price;
            }
            return 0;
        });
    }
};
