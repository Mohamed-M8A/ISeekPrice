window.Ranker = {
    invertedIndex: new Map(),
    db: null,
    weights: {},

    async init() {
        this.initDB();
        
        try {
            const weightRes = await fetch("/public/json/weights.json");
            this.weights = await weightRes.json();
        } catch (e) {
            console.warn("Could not load weights.json, using empty weights");
        }

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
            console.log("Ranker Engine: Memory Map Ready");
        } catch (e) {
            console.error("Ranker Binary Load Error", e);
        }
    },

    initDB() {
        const req = indexedDB.open("RankerLog", 1);
        req.onupgradeneeded = e => e.target.result.createObjectStore("v", { keyPath: "id", autoIncrement: true });
        req.onsuccess = e => this.db = e.target.result;
    },

    track(idx, price) {
        if (!this.db || !this.invertedIndex.has(idx)) return;

        const words = this.invertedIndex.get(idx);
        let maxW = 1;

        words.forEach(w => {
            if (this.weights[w]) {
                maxW = Math.max(maxW, this.weights[w]);
            }
        });

        const tx = this.db.transaction("v", "readwrite");
        tx.objectStore("v").add({ 
            idx: idx, 
            p: price, 
            i: price * maxW,
            t: Date.now() 
        });

        tx.oncomplete = () => this.analyze();
    },

    analyze() {
        this.db.transaction("v", "readonly").objectStore("v").getAll().onsuccess = (e) => {
            const data = e.target.result; 
            if (data.length < 3) return;

            const avg = data.reduce((s, i) => s + i.i, 0) / data.length;
            
            let tag = avg > 2000 ? "UXVhbGl0eUV4cGxvcmVy" : (avg > 700 ? "U3RhbmRhcmRTZWVrZXI=" : "VmFsdWVPcHRpbWl6ZXI=");
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
