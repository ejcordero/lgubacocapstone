const express = require('express');
const router = express.Router();
const pool = require('../db');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const Block = require('../src/block');
const CryptoUtils = require('../src/crypto-utils');
const ipfsService = require('../src/ipfs');
const polygonService = require('../src/polygon');
const { BASE_URL } = require('./_shared');

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const dir = path.join(__dirname, '../downloads');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage: storage });

let pdfParse = null;
let ocrParse = null;

try {
    const PDFParserStatic = require('pdf2json');
    pdfParse = async function (filePath) {
        return new Promise((resolve, reject) => {
            const parser = new PDFParserStatic();
            parser.on('pdfParser_dataError', (errData) => {
                reject(new Error(errData.parserError || 'PDF parse error'));
            });
            parser.on('pdfParser_dataReady', (pdfData) => {
                let rawText = '';
                if (typeof pdfData.getRawTextContent === 'function') {
                    rawText = pdfData.getRawTextContent();
                } else if (typeof parser.getRawTextContent === 'function') {
                    rawText = parser.getRawTextContent();
                } else if (pdfData && Array.isArray(pdfData.Pages)) {
                    rawText = pdfData.Pages.map(page => {
                        if (!page.Texts) return '';
                        return page.Texts.map(textItem => {
                            if (!textItem.R) return '';
                            return textItem.R.map(run => {
                                try { return decodeURIComponent(run.T || ''); }
                                catch (e) { return run.T || ''; }
                            }).join('');
                        }).join(' ');
                    }).join('\n');
                }
                resolve({
                    text: rawText || '',
                    numpages: pdfData.Pages ? pdfData.Pages.length : 0
                });
            });
            parser.loadPDF(filePath);
        });
    };
    console.log('✅ PDF text extraction loaded (pdf2json)');
} catch (e) {
    console.error('❌ pdf2json missing:', e.message);
}

// --- Stage 2: OCR fallback for image-only PDFs ---
try {
    const { createWorker } = require('tesseract.js');
    let pdfToImg = null;
    try { pdfToImg = require('pdf-to-img'); } catch (e) {}

    const tessDataDir = path.join(__dirname, '../tesseract-data');
    const hasLocalData = fs.existsSync(path.join(tessDataDir, 'eng.traineddata'));

    if (!hasLocalData) {
        console.log('⚠️ OCR: No local language data found in tesseract-data/');
    } else if (!pdfToImg) {
        console.log('⚠️ OCR: pdf-to-img not installed — cannot convert PDF pages to images');
    } else {
        const ocrTmpDir = path.join(__dirname, '../ocr-temp');
        if (!fs.existsSync(ocrTmpDir)) fs.mkdirSync(ocrTmpDir, { recursive: true });

        const { randomUUID } = require('crypto');
        const OCR_TIMEOUT = 60000;

        function withTimeout(promise, ms, message) {
            return Promise.race([
                promise,
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error(message)), ms)
                )
            ]);
        }

        ocrParse = async function (filePath) {
            console.log('  🔍 OCR: Converting PDF pages to temporary image files...');
            const startTime = Date.now();
            const tempFiles = [];
            let worker = null;

            try {
                const pdfBuffer = fs.readFileSync(filePath);
                const { pdf } = pdfToImg;

                const rawResult = await withTimeout(
                    pdf(pdfBuffer, { scale: 2 }),
                    OCR_TIMEOUT,
                    'OCR timed out after 60 seconds while converting PDF to images'
                );

                const pages = [];
                if (rawResult && typeof rawResult[Symbol.asyncIterator] === 'function') {
                    for await (const page of rawResult) {
                        if (Buffer.isBuffer(page)) pages.push(page);
                    }
                } else if (rawResult && typeof rawResult === 'object') {
                    for (const val of Object.values(rawResult)) {
                        if (Buffer.isBuffer(val)) pages.push(val);
                    }
                }

                if (pages.length === 0) {
                    return { text: '', numpages: 0 };
                }

                for (let i = 0; i < pages.length; i++) {
                    const tmpPath = path.join(ocrTmpDir, `ocr_${randomUUID()}_${i}.png`);
                    fs.writeFileSync(tmpPath, pages[i]);
                    tempFiles.push(tmpPath);
                }

                const workerOptions = { langPath: tessDataDir };

                worker = await withTimeout(
                    createWorker('eng', 1, workerOptions),
                    OCR_TIMEOUT,
                    'OCR timed out after 60 seconds while initializing Tesseract worker'
                );

                let fullText = '';

                for (let i = 0; i < tempFiles.length; i++) {
                    try {
                        const remainingTime = OCR_TIMEOUT - (Date.now() - startTime);
                        if (remainingTime <= 0) break;

                        const { data } = await withTimeout(
                            worker.recognize(tempFiles[i]),
                            remainingTime,
                            `OCR timed out on page ${i + 1}`
                        );
                        fullText += (data.text || '') + '\n';
                    } catch (pageErr) {
                        if (pageErr.message.includes('timed out')) break;
                    }
                }

                await worker.terminate();
                worker = null;
                return { text: fullText.trim(), numpages: pages.length };

            } catch (err) {
                return { text: '', numpages: 0 };
            } finally {
                if (worker) {
                    try { await worker.terminate(); } catch (e) {}
                }
                for (const f of tempFiles) {
                    try { fs.unlinkSync(f); } catch (e) {}
                }
            }
        };
        console.log('✅ OCR module loaded (tesseract.js + pdf-to-img, offline mode)');
    }
} catch (e) {
    console.error('⚠️ tesseract.js not available — image-only PDFs cannot be read');
}

// --- Keyword rules ---
const GOVT_VALIDATION = {
    required: [
        { keyword: 'Municipality of Baco', weight: 35, label: 'Municipality Identifier' },
        { keyword: 'Oriental Mindoro',     weight: 20, label: 'Province' },
    ],
    secondary: [
        { keyword: 'Republic of the Philippines', weight: 10, label: 'Republic Reference' },
        { keyword: 'Local Government',            weight: 8,  label: 'LGU Reference' },
        { keyword: 'Sangguniang Bayan',           weight: 7,  label: 'Legislative Body' },
        { keyword: 'Mayor',                       weight: 5, label: 'Executive Reference' },
        { keyword: 'LGU',                         weight: 5, label: 'LGU Acronym' },
        { keyword: 'Baco',                        weight: 5, label: 'Municipality Name' },
        { keyword: 'Government',                  weight: 4, label: 'Government Reference' },
        { keyword: 'Oriental',                    weight: 3, label: 'Province Partial' },
        { keyword: 'Mindoro',                     weight: 3, label: 'Province Partial' },
        { keyword: 'Municipal',                   weight: 3, label: 'Municipal Reference' },
        { keyword: 'Office of the',               weight: 2, label: 'Office Reference' },
    ],
    threshold: 40
};
function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeOcrText(text) {
    let t = text.toLowerCase();
    t = t.replace(/[\x00-\x1F\x7F-\x9F\u200B-\u200D\uFEFF]/g, ' ');
    t = t.replace(/'/g, "'").replace(/"/g, '"').replace(/"/g, '"');
    t = t.replace(/\s+/g, ' ').trim();
    return t;
}

function fuzzyWordMatch(text, word) {
    if (word.length <= 5) {
        const regex = new RegExp('(?:^|[^a-z])' + escapeRegex(word) + '(?:$|[^a-z])');
        return regex.test(text);
    }

    const maxErrors = word.length <= 8 ? 1 : 2;

    for (let i = 0; i <= text.length - word.length; i++) {
        let errors = 0;
        for (let j = 0; j < word.length; j++) {
            if (text[i + j] !== word[j]) errors++;
            if (errors > maxErrors) break;
        }
        if (errors <= maxErrors) {
            const before = i > 0 ? text[i - 1] : ' ';
            const after = i + word.length < text.length ? text[i + word.length] : ' ';
            if (!/[a-z]/.test(before) && !/[a-z]/.test(after)) {
                return true;
            }
        }
    }
    return false;
}

function fuzzyMatch(text, keyword) {
    const kw = normalizeOcrText(keyword);
    if (text.includes(kw)) return true;

    const kwWords = kw.split(/\s+/).filter(w => w.length > 0);
    if (kwWords.length === 0) return false;

    if (kwWords.length === 1) {
        return fuzzyWordMatch(text, kwWords[0]);
    }

    return kwWords.every(word => fuzzyWordMatch(text, word));
}

// --- Main validation function ---
async function validateGovernmentPdf(filePath) {
    if (!pdfParse) {
        return {
            passed: false, score: 0, maxScore: 0, percentage: 0,
            keywords: [], pageCount: 0, textPreview: '',
            errors: ['PDF parsing module not installed. Run: npm install pdf2json']
        };
    }
    try {
        let pdf = await pdfParse(filePath);
        let usedOcr = false;
        const nativeLen = (pdf.text || '').trim().length;

        if (nativeLen < 50 && ocrParse) {
            console.log(`  📄 Native text: only ${nativeLen} chars — falling back to OCR...`);
            try {
                const ocrResult = await ocrParse(filePath);
                const ocrText = ocrResult.text.trim();
                const ocrLen = ocrText.length;

                if (ocrLen > 0) {
                    const spaceCount = (ocrText.match(/\s/g) || []).length;
                    const spaceRatio = spaceCount / ocrLen;
                    if (spaceRatio < 0.08) {
                        console.log(`  ⚠️ OCR: Text appears to be garbage (space ratio: ${(spaceRatio * 100).toFixed(1)}%) — ignoring`);
                    } else if (ocrLen > nativeLen) {
                        pdf.text = ocrResult.text;
                        pdf.numPages = Math.max(pdf.numpages, ocrResult.numpages);
                        usedOcr = true;
                    }
                }
            } catch (ocrErr) {
                console.error('  ❌ OCR failed:', ocrErr.message);
            }
        }

        const text = normalizeOcrText(pdf.text || '');
        let score = 0, maxScore = 0;
        const keywords = [];

        for (const kw of GOVT_VALIDATION.required) {
            maxScore += kw.weight;
            const found = fuzzyMatch(text, kw.keyword);
            if (found) score += kw.weight;
            keywords.push({ keyword: kw.keyword, label: kw.label, found, weight: kw.weight, required: true });
        }
        for (const kw of GOVT_VALIDATION.secondary) {
            maxScore += kw.weight;
            const found = fuzzyMatch(text, kw.keyword);
            if (found) score += kw.weight;
            keywords.push({ keyword: kw.keyword, label: kw.label, found, weight: kw.weight, required: false });
        }

        const allRequiredFound = GOVT_VALIDATION.required.every(k => fuzzyMatch(text, k.keyword));
        const percentage = Math.round((score / maxScore) * 100);
        const passed = allRequiredFound && score >= GOVT_VALIDATION.threshold;
        const errors = [];
        if (!allRequiredFound) errors.push('One or more required keywords were not found in the document.');

        return {
            passed, score, maxScore, percentage, keywords,
            pageCount: pdf.numpages,
            textPreview: text.substring(0, 500).replace(/\s+/g, ' ').trim(),
            errors,
            usedOcr
        };
    } catch (err) {
        return {
            passed: false, score: 0, maxScore: 0, percentage: 0,
            keywords: [], pageCount: 0, textPreview: '',
            errors: ['Failed to parse PDF: ' + err.message]
        };
    }
}

// ── TALA: Pre-validation endpoint ──
router.post('/tala/validate-pdf', upload.single('document'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No file provided' });
        if (!pdfParse) return res.status(500).json({ error: 'PDF parser not installed on server' });

        const result = await validateGovernmentPdf(req.file.path);
        try { fs.unlinkSync(req.file.path); } catch (e) {}
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: 'Validation failed', details: err.message });
    }
});

// ── TALA: GET all projects ──
router.get('/tala/projects', async (req, res) => {
    try {
        const { type } = req.query;
        let query = 'SELECT * FROM projects WHERE is_latest = 1';
        const params = [];

        if (type && type !== 'all') {
            query += ' AND document_type = ?';
            params.push(type);
        }

        query += ' ORDER BY created_at DESC';
        const [rows] = await pool.execute(query, params);

        const results = await Promise.all(rows.map(async (p) => {
            const [versionCount] = await pool.execute(
                'SELECT COUNT(*) as cnt FROM projects WHERE title = ? AND id != ?',
                [p.title, p.id]
            );
            return {
                ...p,
                formUrl: p.file_path ? BASE_URL + p.file_path : null,
                hasVersions: versionCount[0].cnt > 0
            };
        }));

        res.json(results);
    } catch (err) {
        console.error('Fetch projects error:', err);
        res.status(500).json({ error: 'Failed to fetch projects' });
    }
});

// ── TALA: GET project versions ──
router.get('/tala/projects/:id/versions', async (req, res) => {
    try {
        const projectId = req.params.id;
        const [targetProject] = await pool.execute('SELECT title FROM projects WHERE id = ?', [projectId]);
        if (targetProject.length === 0) {
            return res.status(404).json({ error: 'Project not found' });
        }

        const [versions] = await pool.execute(
            'SELECT * FROM projects WHERE title = ? ORDER BY version_number DESC, created_at DESC',
            [targetProject[0].title]
        );

        res.json(versions.map(v => ({
            id: v.id,
            title: v.title,
            description: v.description,
            date: v.date,
            document_type: v.document_type,
            version_number: v.version_number || 1,
            is_latest: !!v.is_latest,
            version_note: v.version_note || null,
            block_hash: v.block_hash,
            ipfs_cid: v.ipfs_cid || null,
            polygon_tx_hash: v.polygon_tx_hash || null,
            polygon_block_number: v.polygon_block_number || null,
            formUrl: v.file_path ? BASE_URL + v.file_path : null,
            created_at: v.created_at
        })));
    } catch (e) {
        console.error('Fetch versions error:', e);
        res.status(500).json({ error: 'Failed to fetch versions' });
    }
});

// ── TALA: POST projects (with IPFS + Polygon anchoring) ──
router.post('/tala/projects', upload.single('projectForm'), async (req, res) => {
    const { title, details, date, skipValidation, parentProjectId, versionNote, documentType } = req.body;
    const filePath = req.file ? '/downloads/' + req.file.filename : null;

    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    if (!title) return res.status(400).json({ error: 'Title is required' });

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        let finalTitle = title;
        let finalDetails = details || '';
        let finalDate = date;
        let finalDocType = documentType || 'Project Reports';
        let versionNumber = 1;
        let isLatest = 1;

        // ── VERSION MODE ──
        if (parentProjectId) {
            const [parentRows] = await conn.execute('SELECT * FROM projects WHERE id = ?', [parentProjectId]);
            if (parentRows.length === 0) {
                await conn.rollback();
                return res.status(404).json({ error: 'Parent project not found' });
            }
            const parent = parentRows[0];
            await conn.execute('UPDATE projects SET is_latest = 0 WHERE id = ?', [parentProjectId]);
            finalTitle = parent.title;
            finalDetails = details || parent.description;
            finalDocType = parent.document_type || finalDocType;
            finalDate = new Date().toISOString().split('T')[0];
            versionNumber = (parent.version_number || 1) + 1;
            isLatest = 1;
        } else {
            // ── NEW DOCUMENT: Check for title conflict ──
            const [existing] = await conn.execute(
                'SELECT id, version_number FROM projects WHERE title = ? AND is_latest = 1 LIMIT 1',
                [finalTitle]
            );
            if (existing.length > 0) {
                await conn.rollback();
                return res.status(409).json({
                    conflict: true,
                    message: 'A document with this title already exists.',
                    existingProject: { id: existing[0].id, currentVersion: existing[0].version_number || 1 }
                });
            }
            finalDate = finalDate || new Date().toISOString().split('T')[0];
        }

        // Server-side validation
        if (skipValidation !== 'true' && pdfParse) {
            const validation = await validateGovernmentPdf(req.file.path);
            if (!validation.passed) {
                await conn.rollback();
                try { fs.unlinkSync(req.file.path); } catch (e) {}
                return res.status(422).json({
                    error: 'Document validation failed',
                    validation,
                    message: 'This document does not meet the government document authenticity requirements.'
                });
            }
        }
        const [resIns] = await conn.execute(
            `INSERT INTO projects (date, title, description, file_path, document_type, version_number, is_latest, version_note) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [finalDate, finalTitle, finalDetails, filePath, finalDocType, versionNumber, isLatest, versionNote || null]
        );
        const pId = resIns.insertId;

        // Local Blockchain
        const [lastBlk] = await conn.execute('SELECT * FROM blockchain ORDER BY block_index DESC LIMIT 1');
        const prevHash = lastBlk.length ? lastBlk[0].hash : "0";
        const newBlk = new Block(Date.now(), { projectId: pId, title: finalTitle, details: finalDetails, versionNumber }, prevHash);
        newBlk.index = lastBlk.length ? lastBlk[0].block_index + 1 : 0;
        newBlk.mineBlock(2);

        await conn.execute(
            'INSERT INTO blockchain (block_index, timestamp, data, previous_hash, hash, nonce) VALUES (?, ?, ?, ?, ?, ?)',
            [newBlk.index, newBlk.timestamp, JSON.stringify(newBlk.data), newBlk.previousHash, newBlk.hash, newBlk.nonce]
        );
        await conn.execute('UPDATE projects SET block_hash = ? WHERE id = ?', [newBlk.hash, pId]);

        await conn.commit();

        // ══════════════════════════════════════════════════════════
        // IPFS + POLYGON ANCHORING (graceful fallback)
        // ══════════════════════════════════════════════════════════
        let ipfsCid = null;
        let polygonTxHash = null;
        let polygonBlockNumber = null;

        try {
            // Step 1: Upload PDF to IPFS via Pinata (non-blocking)
            if (req.file && req.file.path && ipfsService.isReady()) {
                try {
                    console.log(`  📤 Uploading to IPFS: ${req.file.originalname}`);
                    const ipfsResult = await ipfsService.uploadToIPFS(req.file.path, req.file.originalname);
                    ipfsCid = ipfsResult.ipfsCid;
                    console.log(`  ✅ IPFS CID: ${ipfsCid}`);
                    await pool.execute('UPDATE projects SET ipfs_cid = ? WHERE id = ?', [ipfsCid, pId]);
                } catch (ipfsErr) {
                    console.error('  ⚠️ IPFS upload failed (continuing with Polygon):', ipfsErr.message);
                }
            }

            // Step 2: Anchor on Polygon Amoy testnet
            if (polygonService.isReady()) {
                try {
                    console.log(`  📡 Anchoring on Polygon: ${newBlk.hash.substring(0, 16)}...`);
                    const anchorData = {
                        hash: newBlk.hash,
                        ipfsCid: ipfsCid || '',
                        title: finalTitle,
                        versionNumber: versionNumber,
                        timestamp: Date.now(),
                        projectId: pId
                    };
                    const polyResult = await polygonService.anchorOnPolygon(anchorData);
                    polygonTxHash = polyResult.txHash;
                    polygonBlockNumber = polyResult.blockNumber;
                    console.log(`  ✅ Polygon TX: ${polygonTxHash} (Block #${polygonBlockNumber})`);
                    await pool.execute(
                        'UPDATE projects SET polygon_tx_hash = ?, polygon_block_number = ?, polygon_status = ? WHERE id = ?',
                        [polygonTxHash, polygonBlockNumber, 'confirmed', pId]
                    );
                } catch (polyErr) {
                    console.error('  ⚠️ Polygon anchoring failed (document saved locally):', polyErr.message);
                }
            }
        } catch (anchorErr) {
            console.error('  ⚠️ IPFS/Polygon anchoring failed (document saved locally):', anchorErr.message);
        }

        res.status(201).json({
            message: parentProjectId ? 'New version added to blockchain!' : 'Document added to blockchain!',
            id: pId,
            hash: newBlk.hash,
            versionNumber: versionNumber,
            isVersion: !!parentProjectId,
            ipfsCid: ipfsCid || null,
            polygonTxHash: polygonTxHash || null,
            polygonBlockNumber: polygonBlockNumber || null
        });
    } catch (e) {
        await conn.rollback();
        console.error('Add project error:', e);
        try { if (req.file) fs.unlinkSync(req.file.path); } catch (err) {}
        res.status(500).json({ error: 'Failed to add project' });
    } finally {
        conn.release();
    }
});

// ── TALA: GET single project ──
router.get('/tala/projects/:id', async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT * FROM projects WHERE id = ?', [req.params.id]);
        if (!rows.length) return res.status(404).json({ error: 'Not found' });
        const p = rows[0];
        p.formUrl = p.file_path ? BASE_URL + p.file_path : null;
        res.json(p);
    } catch (e) { res.status(500).json({ error: 'Failed' }); }
});

// ── TALA: Enhanced Blockchain Validation (with Polygon verification) ──
router.get('/tala/validate/:projectId', async (req, res) => {
    try {
        const projectId = req.params.projectId;
        const [projects] = await pool.execute('SELECT * FROM projects WHERE id = ?', [projectId]);
        if (projects.length === 0) {
            return res.json({ valid: false, error: 'Document not found in records', checks: { hashIntegrity: false, chainLinkage: false, recordFound: false, polygonVerified: null } });
        }
        const project = projects[0];
        if (!project.block_hash) {
            return res.json({ valid: false, error: 'This document has not been anchored to the blockchain', checks: { hashIntegrity: false, chainLinkage: false, recordFound: false, polygonVerified: null } });
        }
        const [blocks] = await pool.execute('SELECT * FROM blockchain WHERE hash = ?', [project.block_hash]);
        if (blocks.length === 0) {
            return res.json({ valid: false, error: 'Blockchain block not found for this document', checks: { hashIntegrity: false, chainLinkage: false, recordFound: false, polygonVerified: null } });
        }
        const block = blocks[0];
        const SHA256 = require('crypto-js/sha256');
        const recalculatedHash = SHA256(block.previous_hash + block.timestamp + block.data + block.nonce).toString();
        const hashIntegrity = recalculatedHash === block.hash;
        let chainLinkage = true;
        if (block.block_index > 0) {
            const [prevBlocks] = await pool.execute('SELECT hash FROM blockchain WHERE block_index = ?', [block.block_index - 1]);
            if (prevBlocks.length === 0 || prevBlocks[0].hash !== block.previous_hash) chainLinkage = false;
        }
        let blockData = {};
        try { blockData = JSON.parse(block.data); } catch (e) {}

        // ── Polygon Verification ──
        let polygonResult = null;
        if (project.polygon_tx_hash && polygonService.isReady()) {
            try {
                polygonResult = await polygonService.verifyPolygonAnchor(project.polygon_tx_hash, project.block_hash);
            } catch (polyErr) {
                console.error('Polygon verify error:', polyErr.message);
                polygonResult = { verified: false, error: polyErr.message };
            }
        }

        const isValid = hashIntegrity && chainLinkage;
        const polygonOk = polygonResult ? polygonResult.verified : true;

        res.json({
            valid: isValid && polygonOk,
            error: !isValid ? (hashIntegrity ? 'Chain linkage broken' : 'Block hash mismatch') : (!polygonOk ? 'Polygon verification failed' : null),
            blockNumber: block.block_index, blockTimestamp: Number(block.timestamp), hash: block.hash, previousHash: block.previous_hash, nonce: block.nonce,
            checks: { hashIntegrity, chainLinkage, recordFound: true, polygonVerified: polygonResult ? polygonResult.verified : null },
            blockData, projectName: project.title,
            polygon: polygonResult ? {
                verified: polygonResult.verified,
                txHash: project.polygon_tx_hash,
                blockNumber: polygonResult.blockNumber,
                explorerUrl: polygonResult.explorerUrl,
                error: polygonResult.error
            } : null,
            ipfsCid: project.ipfs_cid || null,
            ipfsUrl: ipfsService.getIPFSUrl(project.ipfs_cid)
        });
    } catch (e) { res.status(500).json({ valid: false, error: 'Server error during validation', checks: { hashIntegrity: false, chainLinkage: false, recordFound: false, polygonVerified: null } }); }
});

// ── TALA: Validate entire chain ──
router.get('/tala/validate-chain', async (req, res) => {
    try {
        const [blocks] = await pool.execute('SELECT * FROM blockchain ORDER BY block_index ASC');
        if (blocks.length === 0) return res.json({ isValid: true, blockCount: 0 });
        const SHA256 = require('crypto-js/sha256');
        let isValid = true; let failedAt = null;
        for (let i = 0; i < blocks.length; i++) {
            const block = blocks[i];
            const recalculated = SHA256(block.previous_hash + block.timestamp + block.data + block.nonce).toString();
            if (recalculated !== block.hash) { isValid = false; failedAt = { blockIndex: block.block_index, reason: 'Hash mismatch' }; break; }
            if (i > 0 && block.previous_hash !== blocks[i - 1].hash) { isValid = false; failedAt = { blockIndex: block.block_index, reason: 'Chain linkage broken' }; break; }
        }
        res.json({ isValid, blockCount: blocks.length, failedAt });
    } catch (e) { res.status(500).json({ isValid: false, error: 'Chain validation failed' }); }
});

// ── TALA: Verify Chain with Detailed Process ──
router.get('/tala/verify-chain-process', async (req, res) => {
    try {
        const [blocks] = await pool.execute('SELECT * FROM blockchain ORDER BY block_index ASC');

        if (blocks.length === 0) {
            console.log('Blockchain validation: No blocks found.');
            return res.json({
                isValid: true,
                blockCount: 0,
                totalTime: 0,
                process: [{ step: 'info', message: 'No blocks in the blockchain yet.' }]
            });
        }

        const SHA256 = require('crypto-js/sha256');
        const processLog = [];
        let isValid = true;
        let failedAt = null;
        const startTime = Date.now();

        console.log(`Blockchain validation started | Total blocks: ${blocks.length}`);

        for (let i = 0; i < blocks.length; i++) {
            const block = blocks[i];
            const blockEntry = {
                blockIndex: block.block_index,
                hash: block.hash,
                previousHash: block.previous_hash,
                nonce: block.nonce,
                timestamp: Number(block.timestamp),
                minedAt: new Date(block.timestamp).toLocaleString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', second: '2-digit' }),
                checks: [],
                blockData: null,
                failed: false
            };

            // CHECK 1: Hash Integrity
            const hashStart = Date.now();
            const recalculatedHash = SHA256(block.previous_hash + block.timestamp + block.data + block.nonce).toString();
            const hashTime = Date.now() - hashStart;
            const hashMatch = recalculatedHash === block.hash;

            blockEntry.checks.push({
                type: 'hash',
                label: 'Hash Integrity',
                status: hashMatch ? 'pass' : 'fail',
                detail: hashMatch
                    ? `Computed hash matches stored hash`
                    : `MISMATCH — Computed: ${recalculatedHash.substring(0, 20)}... | Stored: ${block.hash.substring(0, 20)}...`,
                timeMs: hashTime
            });
            console.log(`Block #${block.block_index} — Hash Integrity: ${hashMatch ? 'PASS' : 'FAILED'}`);

            if (!hashMatch) {
                isValid = false;
                failedAt = { blockIndex: block.block_index, reason: 'Hash mismatch' };
                blockEntry.failed = true;
                processLog.push(blockEntry);
                console.log(`Chain broken at Block #${block.block_index}`);
                break;
            }

            // CHECK 2: Chain Linkage
            if (i > 0) {
                const linkMatch = block.previous_hash === blocks[i - 1].hash;
                blockEntry.checks.push({
                    type: 'linkage',
                    label: 'Chain Linkage',
                    status: linkMatch ? 'pass' : 'fail',
                    detail: linkMatch
                        ? `Previous hash correctly links to Block #${blocks[i - 1].block_index}`
                        : `BROKEN — Expected: ${blocks[i - 1].hash.substring(0, 20)}... | Got: ${block.previous_hash.substring(0, 20)}...`,
                    timeMs: 0
                });
                console.log(`Block #${block.block_index} — Chain Linkage to Block #${blocks[i - 1].block_index}: ${linkMatch ? 'PASS' : 'BROKEN'}`);

                if (!linkMatch) {
                    isValid = false;
                    failedAt = { blockIndex: block.block_index, reason: 'Chain linkage broken' };
                    blockEntry.failed = true;
                    processLog.push(blockEntry);
                    console.log(`Chain broken at Block #${block.block_index}`);
                    break;
                }
            } else {
                blockEntry.checks.push({
                    type: 'genesis',
                    label: 'Genesis Block',
                    status: 'pass',
                    detail: 'First block in chain — no previous linkage required',
                    timeMs: 0
                });
                console.log(`Block #${block.block_index} — Genesis Block (no parent)`);
            }

            // CHECK 3: Data Parse
            let blockData = {};
            try {
                blockData = JSON.parse(block.data);
                blockEntry.blockData = {
                    projectId: blockData.projectId,
                    title: blockData.title,
                    details: blockData.details,
                    versionNumber: blockData.versionNumber
                };
            } catch (e) {
                blockEntry.blockData = { raw: block.data };
            }
            console.log(`Block #${block.block_index} — Data: "${blockData.title || 'N/A'}" (Project #${blockData.projectId || 'N/A'}) | Nonce: ${block.nonce} | Hash: ${block.hash.substring(0, 16)}...`);

            processLog.push(blockEntry);
        }

        const totalTime = Date.now() - startTime;

        console.log(`RESULT: ${isValid ? 'CHAIN VALID' : 'CHAIN INVALID'}`);
        console.log(`Blocks Verified: ${isValid ? blocks.length : (failedAt?.blockIndex || 0)} / ${blocks.length}`);
        console.log(`Total Time: ${totalTime}ms`);
        if (failedAt) console.log(`Failed At: Block #${failedAt.blockIndex} — ${failedAt.reason}`);

        res.json({
            isValid,
            blockCount: blocks.length,
            failedAt,
            totalTime,
            process: processLog
        });
    } catch (e) {
        console.error('Chain validation process error:', e);
        res.status(500).json({ isValid: false, error: 'Chain validation failed', process: [] });
    }
});

router.get('/tala/blocks', async (req, res) => { try { const [r] = await pool.execute('SELECT * FROM blockchain ORDER BY block_index ASC'); res.json(r); } catch(e){res.status(500).json({error:'Failed'})}});
router.delete('/tala/projects/:id', async (req, res) => { try { await pool.execute('DELETE FROM projects WHERE id = ?', [req.params.id]); res.json({ message: 'Deleted' }); } catch (e) { res.status(500).json({ error: 'Failed' }); }});
router.post('/tala/register-user', async (req, res) => { const { username, fullName, email } = req.body; try { const [exist] = await pool.execute('SELECT id FROM users WHERE username = ? OR email = ?', [username, email]); if (exist.length) return res.status(400).json({ error: 'Exists' }); const [r] = await pool.execute('INSERT INTO users (username, full_name, email) VALUES (?, ?, ?)', [username, fullName, email]); res.status(201).json({ userId: r.insertId }); } catch (e) { res.status(500).json({ error: 'Server error' }); }});
router.post('/tala/generate-keys', async (req, res) => { const { userId } = req.body; try { const { publicKey, privateKey } = CryptoUtils.generateKeyPair(); const p = publicKey.replace(/-----BEGIN PUBLIC KEY-----\n|\n-----END PUBLIC KEY-----/g, ''); const pv = privateKey.replace(/-----BEGIN PRIVATE KEY-----\n|\n-----END PRIVATE KEY-----/g, ''); await pool.execute('INSERT INTO user_keys (user_id, public_key) VALUES (?, ?)', [userId, p]); res.json({ publicKey: p, privateKey: pv }); } catch (e) { res.status(500).json({ error: 'Key gen failed' }); }});
router.post('/tala/verify-public-key', async (req, res) => { const { publicKey } = req.body; try { const [r] = await pool.execute('SELECT user_id FROM user_keys WHERE public_key = ?', [publicKey]); if (r.length) res.json({ valid: true, userId: r[0].user_id }); else res.status(404).json({ valid: false }); } catch (e) { res.status(500).json({ error: 'Failed' }); }});

// ══════════════════════════════════════════════════════════
// POLYGON + IPFS ENDPOINTS
// ══════════════════════════════════════════════════════════

// Retry Polygon anchoring for a document that failed or wasn't anchored
router.post('/tala/projects/:id/anchor-polygon', async (req, res) => {
    try {
        const projectId = req.params.id;
        const [projects] = await pool.execute('SELECT * FROM projects WHERE id = ?', [projectId]);
        if (projects.length === 0) return res.status(404).json({ error: 'Project not found' });

        const project = projects[0];
        if (project.polygon_tx_hash) {
            return res.json({
                message: 'Already anchored on Polygon',
                txHash: project.polygon_tx_hash,
                explorerUrl: polygonService.getExplorerTxUrl(project.polygon_tx_hash)
            });
        }
        if (!project.block_hash) return res.status(400).json({ error: 'No local block hash found' });

        let ipfsCid = project.ipfs_cid;

        // Try IPFS upload if not done yet
        if (!ipfsCid && project.file_path) {
            try {
                const fullPath = path.join(__dirname, '..', project.file_path);
                if (fs.existsSync(fullPath)) {
                    const ipfsResult = await ipfsService.uploadToIPFS(fullPath, project.title + '.pdf');
                    ipfsCid = ipfsResult.ipfsCid;
                    await pool.execute('UPDATE projects SET ipfs_cid = ? WHERE id = ?', [ipfsCid, projectId]);
                }
            } catch (ipfsErr) {
                console.error('IPFS retry failed:', ipfsErr.message);
            }
        }

        // Anchor on Polygon
        const anchorData = {
            hash: project.block_hash,
            ipfsCid: ipfsCid || '',
            title: project.title,
            versionNumber: project.version_number || 1,
            timestamp: new Date(project.created_at).getTime(),
            projectId: projectId
        };

        const result = await polygonService.anchorOnPolygon(anchorData);
        await pool.execute(
            'UPDATE projects SET polygon_tx_hash = ?, polygon_block_number = ?, polygon_status = ? WHERE id = ?',
            [result.txHash, result.blockNumber, 'confirmed', projectId]
        );

        res.json({
            message: 'Document anchored on Polygon!',
            txHash: result.txHash,
            blockNumber: result.blockNumber,
            explorerUrl: polygonService.getExplorerTxUrl(result.txHash)
        });
    } catch (e) {
        console.error('Anchor retry error:', e);
        res.status(500).json({ error: 'Anchoring failed: ' + e.message });
    }
});

// Check Polygon TX status
router.get('/tala/polygon-status/:txHash', async (req, res) => {
    try {
        if (!polygonService.isReady()) return res.json({ confirmed: false, error: 'Polygon not configured' });
        const result = await polygonService.verifyPolygonAnchor(req.params.txHash, null);
        res.json(result);
    } catch (e) {
        res.json({ confirmed: false, error: e.message });
    }
});

// Get projects that need Polygon anchoring (admin tool)
router.get('/tala/pending-anchors', async (req, res) => {
    try {
        const [rows] = await pool.execute(
            "SELECT id, title, block_hash, created_at FROM projects WHERE block_hash IS NOT NULL AND (polygon_tx_hash IS NULL OR polygon_status = 'failed') ORDER BY created_at DESC"
        );
        res.json(rows);
    } catch (e) {
        res.status(500).json({ error: 'Failed' });
    }
});

module.exports = router;