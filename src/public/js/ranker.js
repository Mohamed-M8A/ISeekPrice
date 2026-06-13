window.PersonaEngine = {
    invertedIndex: new Map(),
    db: null,
    weights: { "mobile": 10, "laptop": 12, "watch": 5, "toy": 1, "cable": 0.5 },

    async init() {
        await this.loadSearchToRAM();
        this.initDB();
    },

    async loadSearchToRAM() {
        try {
            const path = window.getCloudPath("search");
            const res = await fetch("https://data.iseekprice.com/" + path);
            const buffer = await res.arrayBuffer();
            const view = new DataView(buffer);
            const wordCount = view.getUint32(4, true);
            const idSize = view.getUint32(12, true) <= 65535 ? 2 : 4;
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
                    if (!this.invertedIndex.has(idx)) this.invertedIndex.set(idx, []);
                    this.invertedIndex.get(idx).push(word);
                    offset += idSize;
                }
            }
            console.log("Memory Lexicon Ready");
        } catch (e) { console.error("Persona Load Fail", e); }
    },

    initDB() {
        const req = indexedDB.open("UserInsights", 1);
        req.onupgradeneeded = e => e.target.result.createObjectStore("logs", { keyPath: "id", autoIncrement: true });
        req.onsuccess = e => this.db = e.target.result;
    },

    trackVisit(idx, price) {
        if (!this.db || !this.invertedIndex.has(idx)) return;
        const words = this.invertedIndex.get(idx);
        let maxW = 1;
        words.forEach(w => { if(this.weights[w]) maxW = Math.max(maxW, this.weights[w]); });

        const tx = this.db.transaction("logs", "readwrite");
        tx.objectStore("logs").add({ 
            idx, words, price, weight: maxW, impact: price * maxW, time: Date.now() 
        });
        tx.oncomplete = () => this.calculatePersona();
    },

    calculatePersona() {
        this.db.transaction("logs", "readonly").objectStore("logs").getAll().onsuccess = (e) => {
            const data = e.target.result;
            if (data.length < 3) return;
            const avg = data.reduce((s, i) => s + i.impact, 0) / data.length;
            let tag = avg > 2000 ? "UXVhbGl0eUV4cGxvcmVy" : (avg > 700 ? "U3RhbmRhcmRTZWVrZXI=" : "VmFsdWVPcHRpbWl6ZXI=");
            localStorage.setItem("_p_tag", tag);
        };
    }
};
