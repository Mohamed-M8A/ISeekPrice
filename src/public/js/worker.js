const workerCode = `
// ================================================================================================
// [ SECTION 1: DATA STRUCTURE & BINARY PARSING LOGIC ]
// ================================================================================================

class BinaryParser {
    static parseSingleFeed(buffer, rowIndex) {
        const view = new DataView(buffer);
        const offset = rowIndex * 32;
        if (offset + 32 > buffer.byteLength) return null;
        const status = view.getUint8(offset + 31);
        return {
            id: view.getBigUint64(offset, true).toString(),
            storeId: view.getUint32(offset + 8, true),
            original: view.getUint32(offset + 12, true) / 100,
            price: view.getUint32(offset + 16, true) / 100,
            orders: view.getUint16(offset + 24, true),
            score: view.getUint8(offset + 28) / 10,
            delivery: { min: view.getUint8(offset + 29), max: view.getUint8(offset + 30) },
            status: { promo: (status >> 7) & 1, multiSku: (status >> 6) & 1, inStock: (status >> 5) & 1, sud: status & 0x1F }
        };
    }

    static parseCoreRecord(buffer, decoder) {
        const view = new DataView(buffer);
        return {
            id: view.getBigUint64(0, true).toString(),
            imgDateOffset: view.getUint32(8, true),
            urlDateOffset: view.getUint32(12, true),
            slug: decoder.decode(new Uint8Array(buffer, 16, 64)).replace(/\0/g, '').trim(),
            title: decoder.decode(new Uint8Array(buffer, 80, 200)).replace(/\0/g, '').trim()
        };
    }
}

// ================================================================================================
// [ SECTION 2: WORKER STATE & BINARY LEXICON CACHE ]
// ================================================================================================

let cachedLexicon = null;
let cachedSearchBuffer = null;
let idSize = 4;

async function buildLexicon(baseUrl, searchPath) {
    const res = await fetch(baseUrl + searchPath + "?v=" + Date.now());
    const buffer = await res.arrayBuffer();
    cachedSearchBuffer = buffer;
    const view = new DataView(buffer);
    const decoder = new TextDecoder("utf-8");

    const header_WordCount = view.getUint32(4, true);
    const header_MaxId = view.getUint32(12, true);
    
    idSize = header_MaxId <= 65535 ? 2 : 4;
    cachedLexicon = new Map();

    console.log("%c🔍 BINARY SYSTEM: Building Lexicon...", "color: #febd69; font-weight: bold;");
    
    let offset = 16;
    for (let i = 0; i < header_WordCount; i++) {
        if (offset + 1 > buffer.byteLength) break;
        const len = view.getUint8(offset);
        offset += 1;
        if (len > 0 && (offset + len) <= buffer.byteLength) {
            const wordBytes = new Uint8Array(buffer, offset, len);
            const word = decoder.decode(wordBytes).trim();
            offset += len;
            const count = view.getInt32(offset, true);
            const pos = offset + 4;
            if (word) cachedLexicon.set(word, { pos, count });
            offset += 4 + (count * idSize);
        } else {
            offset += 4;
        }
    }
    console.log("%c✅ LEXICON READY: " + cachedLexicon.size + " Keywords Loaded", "color: #2ecc71; font-weight: bold;");
}

// ================================================================================================
// [ SECTION 3: MAIN OPERATION HANDLER ]
// ================================================================================================

self.onmessage = async (e) => {
    const { searchId, baseUrl, corePath, searchPath, feedBuffer, tokens, filters, storeId } = e.data;
    const decoder = new TextDecoder();
    const CORE_SIZE = 280;
    const targetStore = storeId ? parseInt(storeId) : null;

    try {
        if (!feedBuffer) throw new Error("Feed buffer is required");

        let relevanceMap = new Map();
        let isFilteredSearch = false;

        if (tokens && tokens.length > 0) {
            isFilteredSearch = true;
            if (!cachedLexicon) await buildLexicon(baseUrl, searchPath);
            
            console.log("%c SEARCH STARTED: [" + tokens.join(", ") + "]", "color: #3498db; font-weight: bold;");
            
            const view = new DataView(cachedSearchBuffer);
            for (let t of tokens) {
                const entry = cachedLexicon.get(t);
                if (entry) {
                    console.log("%c命中 (Hit): [" + t + "] -> " + entry.count + " IDs", "color: #9b59b6;");
                    for (let j = 0; j < entry.count; j++) {
                        const ptr = entry.pos + (j * idSize);
                        if (ptr + idSize <= cachedSearchBuffer.byteLength) {
                            const id = idSize === 2 ? view.getUint16(ptr, true) : view.getUint32(ptr, true);
                            relevanceMap.set(id, (relevanceMap.get(id) || 0) + 1);
                        }
                    }
                }
            }
        }

        const coreRes = await fetch(baseUrl + corePath);
        const reader = coreRes.body.getReader();
        let leftover = new Uint8Array(0);
        let rowIndex = 0;
        let allMatchedRecords = [];

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            let combined = new Uint8Array(leftover.length + value.length);
            combined.set(leftover); combined.set(value, leftover.length);
            
            let offset = 0;
            let streamBatch = [];

            while (offset + CORE_SIZE <= combined.length) {
                const relevance = relevanceMap.get(rowIndex) || 0;
                const isMatched = !isFilteredSearch || relevance > 0;
                
                if (isMatched) {
                    const feedData = BinaryParser.parseSingleFeed(feedBuffer, rowIndex);
                    const requiresInStock = filters && filters.inStock !== undefined ? filters.inStock : true;
                    
                    if (feedData && (!requiresInStock || feedData.status.inStock !== 0)) {
                        let passesStore = targetStore ? (feedData.storeId === targetStore) : true;
                        if (passesStore) {
                            let passesFilters = true;
                            if (filters) {
                                if (filters.minPrice && feedData.price < filters.minPrice) passesFilters = false;
                                if (filters.maxPrice && feedData.price > filters.maxPrice) passesFilters = false;
                                if (filters.minRating && feedData.score < filters.minRating) passesFilters = false;
                                if (filters.hasPromo && feedData.status.promo === 0) passesFilters = false;
                            }

                            if (passesFilters) {
                                const recordBuf = combined.buffer.slice(combined.byteOffset + offset, combined.byteOffset + offset + CORE_SIZE);
                                const record = BinaryParser.parseCoreRecord(recordBuf, decoder);
                                record.feed = feedData;
                                record.relevance = relevance;
                                
                                if (isFilteredSearch || targetStore || (filters && filters.sortBy)) {
                                    allMatchedRecords.push(record);
                                } else {
                                    streamBatch.push(record);
                                }
                            }
                        }
                    }
                }
                offset += CORE_SIZE;
                rowIndex++;
            }
            leftover = combined.slice(offset);
            if (streamBatch.length > 0) self.postMessage({ searchId, type: 'BATCH', batch: streamBatch });
        }

        if (isFilteredSearch || targetStore || (filters && filters.sortBy)) {
            allMatchedRecords.sort((a, b) => {
                if (isFilteredSearch && a.relevance !== b.relevance) return b.relevance - a.relevance;
                const sortType = filters?.sortBy || 'relevance';
                if (sortType === 'price_asc') return a.feed.price - b.feed.price;
                if (sortType === 'price_desc') return b.feed.price - a.feed.price;
                if (sortType === 'orders_desc') return b.feed.orders - a.feed.orders;
                if (sortType === 'rating_desc') return b.feed.score - a.feed.score;
                return b.feed.orders - a.feed.orders;
            });

            console.log("%c📊 RESULTS: " + allMatchedRecords.length + " items found", "color: #e67e22; font-weight: bold;");

            const CHUNK_SIZE = 500;
            for (let i = 0; i < allMatchedRecords.length; i += CHUNK_SIZE) {
                self.postMessage({ searchId, type: 'BATCH', batch: allMatchedRecords.slice(i, i + CHUNK_SIZE) });
            }
        }
        
        self.postMessage({ 
            searchId,
            type: 'DONE', 
            core: allMatchedRecords, 
            feed: allMatchedRecords.reduce((acc, r) => { acc[r.id] = r.feed; return acc; }, {}) 
        });

    } catch (err) {
        self.postMessage({ searchId, type: 'ERROR', error: err.message });
    }
};
`
