// src/ipfs.js — IPFS upload via Pinata REST API
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const PINATA_CONFIG = {
    apiKey: process.env.PINATA_API_KEY || '2ec3e1a4c23f4288fd1f',
    secretKey: process.env.PINATA_SECRET_KEY || '59526897e51d19e1f6b0e695e76b01b318eb035d54a6bd200f902d2320ab5fe9',
    gateway: process.env.PINATA_GATEWAY || 'https://amber-passive-swordtail-450.mypinata.cloud'
};

const isReady = !!(PINATA_CONFIG.apiKey && PINATA_CONFIG.secretKey);

if (isReady) {
    console.log('✅ IPFS (Pinata) configured');
} else {
    console.log('⚠️ IPFS not configured — set PINATA_API_KEY and PINATA_SECRET_KEY in .env');
}

/**
 * Upload a file to IPFS via Pinata
 * @param {string} filePath - Absolute path to the file on disk
 * @param {string} fileName - Original filename for metadata
 * @returns {Promise<{ipfsCid: string, pinSize: string, timestamp: string}>}
 */
async function uploadToIPFS(filePath, fileName) {
    if (!isReady) throw new Error('IPFS not configured');

    if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
    }

    const fileStream = fs.createReadStream(filePath);
    const formData = new FormData();
    formData.append('file', fileStream, {
        filename: fileName || path.basename(filePath),
        mimetype: 'application/pdf'
    });
    formData.append('pinataOptions', JSON.stringify({ cidVersion: 1 }));
    formData.append('pinataMetadata', JSON.stringify({
        name: `TALA-${fileName || 'document'}-${Date.now()}`
    }));

    const response = await axios.post(
        'https://api.pinata.cloud/pinning/pinFileToIPFS',
        formData,
        {
            maxBodyLength: Infinity,
            maxContentLength: Infinity,
            headers: {
                ...formData.getHeaders(),
                'pinata_api_key': PINATA_CONFIG.apiKey,
                'pinata_secret_api_key': PINATA_CONFIG.secretKey
            },
            timeout: 120000 // 2 minutes for large files
        }
    );

    if (!response.data || !response.data.IpfsHash) {
        throw new Error('Pinata did not return an IPFS hash');
    }

    return {
        ipfsCid: response.data.IpfsHash,
        pinSize: response.data.PinSize,
        timestamp: response.data.Timestamp
    };
}

/**
 * Get the gateway URL for an IPFS CID
 */
function getIPFSUrl(cid) {
    if (!cid) return null;
    return `${PINATA_CONFIG.gateway}/${cid}`;
}

module.exports = { uploadToIPFS, getIPFSUrl, isReady: () => isReady };