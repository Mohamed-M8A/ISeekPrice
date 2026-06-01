const fetch = require('node-fetch');

module.exports = async function() {
    const country = (process.env.COUNTRY || 'SA').toUpperCase();
    const baseUrl = 'https://data.iseekprice.com/';

    try {
        const mapRes = await fetch(`${baseUrl}General/map.json?v=${Date.now()}`);
        const map = await mapRes.json();

        const coreUrl = `${baseUrl}General/core_${map.core}.bin`;
        const feedUrl = `${baseUrl}${country}/feed_${map.regions[country].feed}.bin`;
        const linksUrl = `${baseUrl}General/links_${map.links}.bin`;

        const [coreBuf, feedBuf, linksBuf] = await Promise.all([
            fetch(coreUrl).then(r => r.arrayBuffer()).then(b => Buffer.from(b)),
            fetch(feedUrl).then(r => r.arrayBuffer()).then(b => Buffer.from(b)),
            fetch(linksUrl).then(r => r.arrayBuffer()).then(b => Buffer.from(b))
        ]);

        const products = new Map();

        for (let i = 0; i < coreBuf.length; i += 280) {
            const id = coreBuf.readBigUInt64LE(i).toString();
            products.set(id, {
                id: id,
                imgOffset: coreBuf.readUInt32LE(i + 8),
                urlOffset: coreBuf.readUInt32LE(i + 12),
                slug: coreBuf.toString('utf8', i + 16, i + 80).replace(/\0/g, '').trim(),
                title: coreBuf.toString('utf8', i + 80, i + 280).replace(/\0/g, '').trim()
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
                    price: feedBuf.readUInt32LE(i + 16) / 100,
                    shipping: feedBuf.readUInt32LE(i + 20) / 100,
                    orders: feedBuf.readUInt16LE(i + 24),
                    reviews: feedBuf.readUInt16LE(i + 26),
                    score: feedBuf.readUInt8(i + 28) / 10,
                    minDel: feedBuf.readUInt8(i + 29),
                    maxDel: feedBuf.readUInt8(i + 30),
                    inStock: (status & 0x20) !== 0,
                    hasPromo: (status & 0x80) !== 0,
                    hasSku: (status & 0x40) !== 0
                });
            }
        }

        for (let i = 0; i < linksBuf.length; i += 100) {
            const id = linksBuf.readBigUInt64LE(i).toString();
            if (products.has(id)) {
                const item = products.get(id);
                item.affCode = linksBuf.toString('utf8', i + 16, i + 30).replace(/\0/g, '').trim();
                item.storeAffCode = linksBuf.toString('utf8', i + 30, i + 44).replace(/\0/g, '').trim();
                item.storeName = linksBuf.toString('utf8', i + 44, i + 100).replace(/\0/g, '').trim();
            }
        }

        return Array.from(products.values());

    } catch (e) {
        return [];
    }
};
