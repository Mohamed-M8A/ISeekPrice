const fetch = require('node-fetch');

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

module.exports = async function() {
    const country = (process.env.COUNTRY || 'SA').toUpperCase();
    const baseUrl = 'https://data.iseekprice.com/';

    const fetchBufWithRetry = async (url, retries = 10, delayMs = 2000) => {
        if (!url) return Buffer.alloc(0);
        
        for (let i = 1; i <= retries; i++) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 15000);

                const response = await fetch(url, {
                    signal: controller.signal,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                        'Accept': 'application/json, application/octet-stream, */*',
                        'Accept-Language': 'en-US,en;q=0.9',
                        'Cache-Control': 'no-cache'
                    }
                });

                clearTimeout(timeoutId);

                if (response.ok) {
                    return Buffer.from(await response.arrayBuffer());
                } else {
                    console.log(`[Fetch Attempt ${i} - Bad Status]: ${response.status} for ${url}`);
                }
            } catch (err) {
                console.log(`[Fetch Attempt ${i} Failed]: ${url} - ${err.message}`);
            }
            if (i < retries) await delay(delayMs);
        }
        throw new Error(`Fetch failed after 10 retries: ${url}`);
    };

    try {
        const mapUrl = `${baseUrl}General/map.json?v=${Date.now()}`;
        let mapBuf;
        
        try {
            mapBuf = await fetchBufWithRetry(mapUrl);
        } catch (mapError) {
            console.error(`❌ خطأ في جلب ملف الخريطة الرئيسي: ${mapError.message}`);
            return []; 
        }
        
        const map = JSON.parse(mapBuf.toString('utf8'));
        const region = map.regions[country];

        const coreUrl = `${baseUrl}General/core_${map.core}.bin`;
        const feedUrl = region && region.feed ? `${baseUrl}${country}/feed_${region.feed}.bin` : null;
        const linksUrl = region && region.links ? `${baseUrl}${country}/links_${region.links}.bin` : null;
        const skuUrl = region && region.sku ? `${baseUrl}${country}/sku_${region.sku}.bin` : null;
        const promoUrl = region && region.promo ? `${baseUrl}${country}/promo_${region.promo}.bin` : null;
        const chartUrl = region && region.fluctuation ? `${baseUrl}${country}/fluctuation_${region.fluctuation}.bin` : null;

        const [coreBuf, feedBuf, linksBuf, skuBuf, promoBuf, chartBuf] = await Promise.all([
            fetchBufWithRetry(coreUrl),
            fetchBufWithRetry(feedUrl),
            fetchBufWithRetry(linksUrl),
            fetchBufWithRetry(skuUrl),
            fetchBufWithRetry(promoUrl),
            fetchBufWithRetry(chartUrl)
        ]);

        const products = new Map();

        for (let i = 0; i < coreBuf.length; i += 280) {
            const id = coreBuf.readBigUInt64LE(i).toString();
            const rawSlug = coreBuf.toString('utf8', i + 16, i + 80).replace(/\0/g, '').trim();
            const cleanSlug = rawSlug.toLowerCase(); 
            const productTitle = coreBuf.toString('utf8', i + 80, i + 280).replace(/\0/g, '').trim();
            const autoMetaDescription = `اكتشف سعر ومواصفات ${productTitle} وتتبع حركة الأسعار، الخصومات، والتقييمات المتوفرة في السوق حالياً لشراء ذكي بأفضل قيمة.`.substring(0, 155);

            products.set(id, {
                id: id,
                recordIndex: i / 280,
                slug: cleanSlug, 
                title: productTitle,
                metaDescription: autoMetaDescription,
                skus: [],
                promo: null,
                chart: []
            });
        }

        for (let i = 0; i < feedBuf.length; i += 32) {
            const id = feedBuf.readBigUInt64LE(i).toString();
            if (products.has(id)) {
                const item = products.get(id);
                const status = feedBuf.readUInt8(i + 31);
                Object.assign(item, {
                    storeId: feedBuf.readUInt32LE(i + 8),
                    priceOriginal: feedBuf.readUInt32LE(i + 12) / 100,
                    priceDiscounted: feedBuf.readUInt32LE(i + 16) / 100,
                    shippingFee: feedBuf.readUInt32LE(i + 20) / 100,
                    orders: feedBuf.readUInt16LE(i + 24),
                    reviews: feedBuf.readUInt16LE(i + 26),
                    score: feedBuf.readUInt8(i + 28) / 10,
                    minDelivery: feedBuf.readUInt8(i + 29),
                    maxDelivery: feedBuf.readUInt8(i + 30),
                    inStock: (status & 0x20) !== 0,
                    hasSku: (status & 0x40) !== 0,
                    hasPromo: (status & 0x80) !== 0
                });
            }
        }

        for (let i = 0; i < linksBuf.length; i += 100) {
            const id = linksBuf.readBigUInt64LE(i).toString();
            if (products.has(id)) {
                const item = products.get(id);
                item.productAffCode = linksBuf.toString('utf8', i + 16, i + 30).replace(/\0/g, '').trim();
                item.storeAffCode = linksBuf.toString('utf8', i + 30, i + 44).replace(/\0/g, '').trim();
                item.storeName = linksBuf.toString('utf8', i + 44, i + 100).replace(/\0/g, '').trim();
            }
        }

        for (let i = 0; i < skuBuf.length; i += 6428) {
            const id = skuBuf.readBigUInt64LE(i).toString();
            if (products.has(id)) {
                const item = products.get(id);
                for (let s = 0; s < 30; s++) {
                    const offset = i + 8 + (s * 214);
                    const pDisc = skuBuf.readUInt32LE(offset + 4) / 100;
                    if (pDisc === 0) continue;
                    
                    const imgSlug = skuBuf.toString('utf8', offset + 14, offset + 54).replace(/\0/g, '').trim();
                    const rawProps = skuBuf.toString('utf8', offset + 54, offset + 214).replace(/\0/g, '').trim();
                    const props = rawProps ? rawProps.replace(/\|/g, " - ").trim() : "_";
                    const image = "https://ae-pic-a1.aliexpress-media.com/kf/" + imgSlug + (imgSlug.includes('.') ? "" : ".jpg");

                    item.skus.push({
                        skuIdx: s,
                        priceOriginal: skuBuf.readUInt32LE(offset) / 100,
                        priceDiscounted: pDisc,
                        shippingFee: skuBuf.readUInt32LE(offset + 8) / 100,
                        minDelivery: skuBuf.readUInt8(offset + 12),
                        maxDelivery: skuBuf.readUInt8(offset + 13),
                        image: image,
                        props: props
                    });
                }
            }
        }

        for (let i = 0; i < promoBuf.length; i += 32) {
            const id = promoBuf.readBigUInt64LE(i).toString();
            if (products.has(id)) {
                const item = products.get(id);
                item.promo = {
                    expiry: promoBuf.readUInt32LE(i + 8),
                    quantity: promoBuf.readUInt16LE(i + 12),
                    code: promoBuf.toString('utf8', i + 14, i + 32).replace(/\0/g, '').trim()
                };
            }
        }

        for (let i = 0; i < chartBuf.length; i += 2932) {
            const id = chartBuf.readBigUInt64LE(i).toString();
            if (products.has(id)) {
                const item = products.get(id);
                const recordCount = chartBuf.readUInt32LE(i + 8);
                for (let c = 0; c < recordCount; c++) {
                    const offset = i + 12 + (c * 8);
                    if (offset + 8 > i + 2932) break;
                    const timeInMinutes = chartBuf.readUInt32LE(offset);
                    const priceRaw = chartBuf.readInt32LE(offset + 4);
                    if (timeInMinutes > 0 && priceRaw > 0) {
                        const pDate = new Date(Date.UTC(2025, 0, 1) + (timeInMinutes * 60 * 1000));
                        item.chart.push({
                            date: pDate.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }),
                            price: (priceRaw / 100).toFixed(2),
                            rawTime: timeInMinutes
                        });
                    }
                }
            }
        }

        return Array.from(products.values());

    } catch (e) {
        throw e; 
    }
};
