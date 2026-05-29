// =================== ✅ Search ===================
const searchPageURL = "https://www.iseekprice.com/page/search/";
let searches = JSON.parse(localStorage.getItem('searches')) || [];

function generateLink(queryTerm, parentName = null) {
    let searchQuery = queryTerm;
    if (parentName) {
        searchQuery = `${parentName} ${queryTerm}`;
    }
    return `${searchPageURL}?query=${encodeURIComponent(searchQuery)}`;
}

function updateDropdown() {
    const historyDropdown = document.getElementById("searchHistoryDropdown");
    const input = document.getElementById("searchInput");
    if (!historyDropdown) return;
    historyDropdown.innerHTML = '';
    let toShow = searches.slice(0, 5);
    if (toShow.length === 0) {
        historyDropdown.style.display = 'none';
        return;
    }
    toShow.forEach(term => {
        let item = document.createElement('div');
        let text = document.createElement('span');
        text.textContent = term;
        text.onclick = () => { if(input) input.value = term; startSearch(term); };
        let del = document.createElement('span');
        del.textContent = '×';
        del.className = 'delete-btn';
        del.onclick = (e) => {
            e.stopPropagation();
            searches = searches.filter(t => t !== term);
            localStorage.setItem('searches', JSON.stringify(searches));
            updateDropdown();
        };
        item.append(text, del);
        historyDropdown.appendChild(item);
    });
    historyDropdown.style.display = 'block';
}

function startSearch(queryTerm) {
    if (queryTerm) {
        const cleanQuery = queryTerm.trim();
        
        const ownDomainPattern = /^(https?:\/\/)?((www|media)\.)?iseekprice\.com/i;
        
        const socialPatterns = [
            { regex: /^(https?:\/\/)?(www\.)?youtube\.com\/@ISeekPrice/i, fullUrl: "https://www.youtube.com/@ISeekPrice" },
            { regex: /^(https?:\/\/)?(www\.)?pinterest\.com\/ISeekPrice/i, fullUrl: "https://www.pinterest.com/ISeekPrice" },
            { regex: /^(https?:\/\/)?(www\.)?facebook\.com\/profile\.php\?id=61579522981793/i, fullUrl: "https://www.facebook.com/profile.php?id=61579522981793" },
            { regex: /^(https?:\/\/)?(www\.)?instagram\.com\/iseekprice/i, fullUrl: "https://www.instagram.com/iseekprice/" },
            { regex: /^(https?:\/\/)?(www\.)?x\.com\/ISeekPrice/i, fullUrl: "https://x.com/ISeekPrice" },
            { regex: /^(https?:\/\/)?(www\.)?t\.me\/\+bmBnY0FumOwxZDQ0/i, fullUrl: "https://t.me/+bmBnY0FumOwxZDQ0" }
        ];

        if (ownDomainPattern.test(cleanQuery)) {
            let targetUrl = cleanQuery;
            if (!/^https?:\/\//i.test(targetUrl)) {
                targetUrl = 'https://' + targetUrl;
            }
            window.location.href = targetUrl;
            return;
        }

        for (const social of socialPatterns) {
            if (social.regex.test(cleanQuery)) {
                window.location.href = social.fullUrl;
                return;
            }
        }

        searches = [cleanQuery, ...searches.filter(t => t !== cleanQuery)].slice(0, 10);
        localStorage.setItem('searches', JSON.stringify(searches));
        window.location.href = generateLink(cleanQuery);
    }
}

document.addEventListener('submit', (e) => {
    if (e.target && e.target.classList.contains('search-box-form')) {
        e.preventDefault();
        const input = document.getElementById("searchInput");
        if (input && input.value.trim()) {
            startSearch(input.value.trim());
        }
    }
});

document.addEventListener('focusin', (e) => {
    if (e.target && e.target.id === "searchInput") {
        updateDropdown();
    }
});

document.addEventListener('click', (e) => {
    const historyDropdown = document.getElementById("searchHistoryDropdown");
    if (historyDropdown && !e.target.closest('.search-container')) {
        document.getElementById("searchHistoryDropdown").style.display = 'none';
    }
});

// =================== ✅ Search Placeholders ===================
const placeholders = [
    "ماكينة قهوة ديلونجي","سماعات بلوتوث جالكسي بودز","مكنسة روبوت ذكية","شاحن مغناطيسي للآيفون","ستاند لابتوب قابل للطي",
    "مكواة بخار محمولة","عصارة فواكه كهربائية","كاميرا مراقبة واي فاي","ماوس لاسلكي لابتوب","منظف وجه كهربائي",
    "لوح مفاتيح ميكانيكية RGB","فرامة خضار يدوية","ميزان ذكي للحمية","سماعات رأس للألعاب","ساعة ذكية شاومي",
    "ترايبود كاميرا احترافي","كشاف LED قابل للشحن","دفاية كهربائية صغيرة","مروحة USB مكتبية","عطر عربي فاخر",
    "شاحن متنقل باور بانك","شنطة لابتوب ضد الماء","كرسي ألعاب مريح","سماعات نويس كانسل","خلاط يدوي متعدد الاستخدام",
    "مقص مطبخ ستانلس ستيل","مظلة أوتوماتيكية","فلاش ميموري سريع","مقلاة هوائية صحية","كاميرا فورية بولارويد",
    "ميزان مطبخ رقمي","مبخرة منزلية كهربائية","ترموس حافظ للحرارة","زجاجة ماء ذكية","مصباح مكتب LED",
    "مروحة محمولة باليد","شاحن جداري سريع","منظم أسلاك مكتب","صندوق تخزين بلاستيك","سماعة مكالمات بلوتوث",
    "منقي هواء صغير","سخان ماء كهربائي","دفتر ملاحظات ذكي","قفل بصمة ذكي","موزع صابون أوتوماتيكي",
    "منظم درج ملابس","مقعد أرضي مريح","كوب قهوة حراري","لوحة مفاتيح لاسلكية","مفرمة لحوم كهربائية",
    "أداة تقطيع بطاطس","صانعة فشار منزلية","طقم ملاعق قياس","جهاز قياس حرارة رقمي","منبه مكتبي كلاسيكي",
    "طابعة صور ملونة","لابتوب أسوس","جوال شاومي ريدمي","تابلت سامسونج جالكسي","حقيبة ظهر للطلاب",
    "قرص صلب خارجي","كابل شحن تايب سي","ماوس جيمينج","مكواة شعر سيراميك","عصا سيلفي بلوتوث",
    "آلة حاسبة علمية","سماعة رأس سلكية","دفاية زيت كهربائية","طقم مفكات متعدد","مقص أظافر ستانلس",
    "ابحث في ISeekPrice"
];
function rotatePlaceholder() {
    const dynamicInput = document.getElementById("searchInput");
    if (dynamicInput) {
        dynamicInput.setAttribute("placeholder", placeholders[Math.floor(Math.random() * placeholders.length)]);
    }
}
rotatePlaceholder();
setInterval(rotatePlaceholder, 25000);

// =================== ✅ Navigation & Categories ===================
const rawData = [
    // --- الهواتف والتابلت ---
    "جوال / آيفون * سامسونج * شاومي * ريلمي * أوبو * هواوي * فيفو * ون بلس * نوكيا * موتورولا * جوجل بكسل",
    "تابلت / آيباد * تاب سامسونج * تابلت هواوي * تابلت لينوفو * كيندل",
    "ساعة ذكية / أبل واتش * ساعة سامسونج * ساعة هواوي * ساعة شاومي * ساعة فيتبيت * ساعة جارمن",
        
    // --- الكمبيوتر والجيمنج ---
    "لابتوب / ماك بوك * لابتوب جيمينج * لابتوب دراسة * لابتوب عمل * لابتوب لمس",
    "كمبيوتر / كمبيوتر مكتبي * كمبيوتر تجميع * ميني بي سي",
    "شاشة / شاشة 4K * شاشة جيمنج * شاشة منحنية * شاشة OLED",
    "ألعاب / بلاي ستيشن * إكس بوكس * نينتندو سويتش * بي سي جيمنج",
    "ملحق كمبيوتر / كيبورد * ماوس * سماعة رأس * ميكروفون * كاميرا ويب * لوح رسومات * مسند لابتوب",
    "تخزين / هاردسك خارجي * فلاش ميموري * كرت ذاكرة * SSD * هاردسك داخلي",
        
    // --- الصوتيات والمرئيات ---
    "سماعة / سماعة بلوتوث * سماعة لاسلكية * ايربودز * سماعة رياضية * سماعة عازلة للضوضاء",
    "تلفزيون / شاشة ذكية * سينما منزلية * بروجيكتر * ريسيفر * تي في بوكس",
    "كاميرا / كاميرا احترافية * كاميرا فورية * كاميرا مراقبة * داش كام * طائرة درون * جيمبل",
        
    // --- المنزل والمطبخ ---
    "أدوات مطبخ / خلاط * قلاية هوائية * ماكينة قهوة * ميكروويف * غلاية * محصصة خبز * صانعة وافل * عجانة * مطحنة",
    "جهاز منزلي / ثلاجة * غسالة * غسالة صحون * مبرد ماء * بوتاجاز * فرن كهربائي",
    "تنظيف / مكنسة روبوت * مكنسة لاسلكية * مكواة بخار * منظف بخاري * منقي هواء",
        
    // --- الجمال والعناية الشخصية ---
    "عناية بالشعر / استشوار * مكواة شعر * ماكينة حلاقة * أداة تشذيب * جهاز ليزر منزلي",
    "صحة / ميزان ذكي * جهاز قياس ضغط * مساج قدم * فرشاة أسنان كهربائية",
    "عطر / عطر رجالي * عطر نسائي * عطر نيش * بخور",
        
    // --- الرياضة والسيارات ---
    "لياقة بدنية / مشاية كهربائية * دراجة ثابتة * شنطة رياضية * حصيرة يوغا",
    "سيارة / شاحن سيارة * منفاخ إطارات * مكنسة سيارة * مظلة سيارة",
        
    // --- أطفال وأدوات مكتبية ---
    "أطفال / عربة أطفال * كرسي سيارة * مراقبة طفل * ألعاب ذكاء",
    "مكتب / طابعة * ماسح ضوئي * حبر طابعة * آلة حاسبة * شنطة لابتوب",
        
    // --- أقسام عامة ---
    "عروض / تصفية * قسيمة شراء * وصل حديثاً"
];

function buildSmartTree(data) {
    let nodes = {};
    data.forEach(line => {
        if (line.includes('/')) {
            const [parent, children] = line.split('/');
            const pName = parent.trim();
            if (!nodes[pName]) nodes[pName] = { name: pName, parentName: null, children: [] };
            
            children.split('*').forEach(c => {
                const cName = c.trim();
                if (!nodes[cName]) nodes[cName] = { name: cName, parentName: pName, children: [] };
                else nodes[cName].parentName = pName;
                
                nodes[pName].children.push(nodes[cName]);
            });
        } else {
            const name = line.trim();
            if (!nodes[name]) nodes[name] = { name: name, parentName: null, children: [] };
        }
    });
    let roots = Object.keys(nodes);
    data.forEach(line => {
        if (line.includes('/')) {
            line.split('/')[1].split('*').forEach(c => {
                roots = roots.filter(r => r !== c.trim());
            });
        }
    });
    return roots.map(name => nodes[name]);
}

const categories = buildSmartTree(rawData);

const toggleBtn = document.getElementById('widget-toggle-btn');
const closeBtn = document.getElementById('widget-close-btn');
const sidebar = document.getElementById('widget-sidebar');
const overlay = document.getElementById('widget-overlay');
const sideList = document.getElementById('widget-side-list');
const desktopCats = document.getElementById('widget-desktop-cats');
const sidebarTitle = document.getElementById('widget-sidebar-title');

function createCategoryRow(cat) {
    const row = document.createElement('div');
    row.className = 'widget-category-row';
    const link = document.createElement('a');
    link.textContent = cat.name;
    link.href = generateLink(cat.name, cat.parentName);
    row.appendChild(link);
    if (cat.children && cat.children.length > 0) {
        const btn = document.createElement('span');
        btn.textContent = '❯';
        btn.className = 'widget-expand-btn-sidebar';
        btn.onclick = (e) => { e.preventDefault(); renderSubCategories(cat.name, cat.children); };
        row.appendChild(btn);
    }
    return row;
}

function renderMainCategories() {
    if (!sideList) return;
    sideList.innerHTML = "";
    if (sidebarTitle) sidebarTitle.textContent = 'التصنيفات';
    categories.forEach(cat => sideList.appendChild(createCategoryRow(cat)));
}

function renderSubCategories(title, children) {
    if (!sideList) return;
    sideList.innerHTML = "";
    if (sidebarTitle) sidebarTitle.textContent = title;
    const back = document.createElement('div');
    back.textContent = '← رجوع';
    back.className = 'widget-back-row';
    back.onclick = renderMainCategories;
    sideList.appendChild(back);
    children.forEach(sub => sideList.appendChild(createCategoryRow(sub)));
}

if (desktopCats) {
    categories.slice(0, 5).forEach(cat => {
        const wrap = document.createElement('div');
        wrap.className = 'widget-cat-wrapper';
        const link = document.createElement('a');
        link.textContent = cat.name;
        link.href = generateLink(cat.name, cat.parentName);
        link.className = 'widget-cat-link';
        wrap.appendChild(link);
        if (cat.children && cat.children.length > 0) {
            const btn = document.createElement('span');
            btn.textContent = '❯';
            btn.className = 'widget-expand-btn';
            btn.onclick = (e) => { e.preventDefault(); openSidebar(false); renderSubCategories(cat.name, cat.children); };
            wrap.appendChild(btn);
        }
        desktopCats.appendChild(wrap);
    });
}

function openSidebar(main = true) {
    if (sidebar) sidebar.style.right = '0';
    if (overlay) overlay.style.display = 'block';
    if (main) renderMainCategories();
}

function closeSidebar() {
    if (sidebar) sidebar.style.right = '-300px';
    if (overlay) overlay.style.display = 'none';
}

if (toggleBtn) toggleBtn.onclick = () => openSidebar(true);
if (closeBtn) closeBtn.onclick = closeSidebar;
if (overlay) overlay.onclick = closeSidebar;

function applyResponsive() {
    if (window.innerWidth > 768 && desktopCats) desktopCats.style.display = 'flex';
}
applyResponsive();
window.addEventListener('resize', applyResponsive);

// =================== ✅ Linguistic Engine ===================
document.addEventListener("DOMContentLoaded", async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const query = urlParams.get("query")?.trim() || "";
    const heading = document.getElementById("query-heading");

    if (heading) {
        if (query) {
            heading.innerHTML = `نتائج البحث عن: <span style="color:var(--accent)">"${query}"</span>`;
        } else {
            heading.innerText = "أحدث المنتجات";
        }
    }

    let synonymsDict = {};
    try {
        const response = await fetch('/public/json/key.json?v=' + Date.now());
        if (response.ok) {
            synonymsDict = await response.json();
        }
    } catch (e) {}

    const ArabicNormalizer = {
        normalize: function(text) {
            if (!text) return "";
            let n = text.toLowerCase().trim();
            n = n.replace(/[\u064B-\u0652ـ]/g, "");
            n = n.replace(/[أإآ]/g, "ا");
            n = n.replace(/ؤ/g, "و");
            n = n.replace(/[ئى]/g, "ي");
            n = n.replace(/ء/g, "");
            n = n.replace(/ه/g, "ة"); 
            if (n.length > 4) {
                if (n.startsWith("ال")) n = n.substring(2);
                else if (n.startsWith("وال")) n = n.substring(3);
                else if (n.startsWith("فال")) n = n.substring(3);
                else if (n.startsWith("بال")) n = n.substring(3);
                else if (n.startsWith("لل")) n = n.substring(2);
            }
            return n;
        }
    };

    window.SearchProcessor = {
        getCleanTokens: async function(rawQuery) {
            if (!rawQuery) return [];
            let words = rawQuery.split(/[\s\-،,]+/).filter(w => w.length > 1);
            let finalTokens = new Set();
            for (let word of words) {
                const normWord = ArabicNormalizer.normalize(word);
                finalTokens.add(normWord);

                if (normWord.includes("ة")) {
                    finalTokens.add(normWord.replace(/ة/g, "ه"));
                } else if (normWord.includes("ه")) {
                    finalTokens.add(normWord.replace(/ه/g, "ة"));
                }

                if (synonymsDict[word]) {
                    synonymsDict[word].forEach(s => finalTokens.add(ArabicNormalizer.normalize(s)));
                }
                if (synonymsDict[normWord]) {
                    synonymsDict[normWord].forEach(s => finalTokens.add(ArabicNormalizer.normalize(s)));
                }
                for (let key in synonymsDict) {
                    if (synonymsDict[key].includes(word) || synonymsDict[key].includes(normWord)) {
                        finalTokens.add(ArabicNormalizer.normalize(key));
                        synonymsDict[key].forEach(s => finalTokens.add(ArabicNormalizer.normalize(s)));
                    }
                }
            }
            return Array.from(finalTokens).filter(t => t.length >= 2);
        }
    };

    if (query) {
        window.searchVariants = await window.SearchProcessor.getCleanTokens(query);
    } else {
        window.searchVariants = [];
    }
    
    console.log("Search Tokens Ready:", window.searchVariants);
    window.dispatchEvent(new Event('SearchTokensReady'));
});

// =================== ✅ Sidebar Filters Logic ===================
document.addEventListener("DOMContentLoaded", () => {
    const trigger = document.getElementById('mobile-filter-trigger');
    const filterSidebar = document.getElementById('search-sidebar');
    const overlay = document.getElementById('widget-overlay');

    if (trigger && filterSidebar && overlay) {
        trigger.onclick = function() {
            filterSidebar.classList.add('active');
            overlay.style.display = 'block';
        };

        overlay.onclick = function() {
            filterSidebar.classList.remove('active');
            overlay.style.display = 'none';
        };
    }

    function gatherFiltersAndSearch() {
        const minPrice = document.getElementById('min-price')?.value;
        const maxPrice = document.getElementById('max-price')?.value;
        const sortSelect = document.getElementById('sort-select');
        const filterPromo = document.getElementById('filter-promo');
        const filterInstock = document.getElementById('filter-instock');
        const ratingRadio = document.querySelector('input[name="rating"]:checked');
               
        window.currentFilters = {
            sortBy: sortSelect ? sortSelect.value : 'relevance',
            minPrice: minPrice ? parseFloat(minPrice) : null,
            maxPrice: maxPrice ? parseFloat(maxPrice) : null,
            hasPromo: filterPromo ? filterPromo.checked : false,
            inStock: filterInstock ? filterInstock.checked : true,
            minRating: ratingRadio ? parseInt(ratingRadio.value) : 0
        };

        if (window.triggerWorkerSearch && typeof window.triggerWorkerSearch === 'function') {
            window.triggerWorkerSearch();
            if (window.innerWidth <= 992 && filterSidebar && overlay) {
                filterSidebar.classList.remove('active');
                overlay.style.display = 'none';
            }
        }
    }

    const sortSelect = document.getElementById('sort-select');
    if (sortSelect) sortSelect.addEventListener('change', gatherFiltersAndSearch);

    const applyPrice = document.getElementById('apply-price');
    if (applyPrice) applyPrice.addEventListener('click', gatherFiltersAndSearch);

    const filterPromo = document.getElementById('filter-promo');
    if (filterPromo) filterPromo.addEventListener('change', gatherFiltersAndSearch);

    const filterInstock = document.getElementById('filter-instock');
    if (filterInstock) filterInstock.addEventListener('change', gatherFiltersAndSearch);

    document.querySelectorAll('input[name="rating"]').forEach(radio => {
        radio.addEventListener('change', gatherFiltersAndSearch);
    });
});
