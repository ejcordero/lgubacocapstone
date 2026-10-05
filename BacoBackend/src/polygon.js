// src/polygon.js — Polygon Amoy testnet anchoring
let ethers;

try {
    ethers = require('ethers');
} catch (err) {
    console.error('⚠️ ethers.js not installed — Polygon anchoring disabled. Run: npm install ethers');
}

const POLYGON_CONFIG = {
    privateKey: process.env.POLYGON_PRIVATE_KEY || '',
    publicKey: process.env.POLYGON_PUBLIC_KEY || '',
    rpcUrl: process.env.POLYGON_RPC_URL || 'https://polygon-amoy.g.alchemy.com/v2/alch_R7qn1EoLVKrQRoTgmQ_U0',
    explorerUrl: process.env.POLYGON_EXPLORER_URL || 'https://amoy.polygonscan.com',
    chainId: 80002 // Polygon Amoy
};

const isReady = !!(ethers && POLYGON_CONFIG.privateKey && POLYGON_CONFIG.rpcUrl);

if (isReady) {
    console.log(`✅ Polygon Amoy testnet configured (wallet: ${POLYGON_CONFIG.publicKey.substring(0, 10)}...)`);
} else {
    console.log('⚠️ Polygon not configured — set POLYGON_PRIVATE_KEY and POLYGON_RPC_URL in .env');
}

let provider = null;
let wallet = null;

function getWallet() {
    if (!isReady) throw new Error('Polygon not configured');
    if (!provider) {
        provider = new ethers.JsonRpcProvider(POLYGON_CONFIG.rpcUrl);
    }
    if (!wallet) {
        wallet = new ethers.Wallet(POLYGON_CONFIG.privateKey, provider);
    }
    return wallet;
}

/**
 * Anchor document data on Polygon Amoy testnet
 * Sends a transaction with the document hash + IPFS CID encoded in calldata
 * 
 * @param {Object} data
 * @param {string} data.hash - Local blockchain hash
 * @param {string} data.ipfsCid - IPFS CID (or empty string)
 * @param {string} data.title - Document title
 * @param {number} data.versionNumber - Version number
 * @param {number} data.timestamp - Unix timestamp
 * @param {number} data.projectId - Database project ID
 * @returns {Promise<{txHash: string, blockNumber: number, gasUsed: number}>}
 */
async function anchorOnPolygon(data) {
    const w = getWallet();

    // Compact payload to minimize gas
    const payload = JSON.stringify({
        h: data.hash,
        ipfs: data.ipfsCid || '',
        t: data.title,
        v: data.versionNumber,
        ts: data.timestamp,
        id: data.projectId
    });

    console.log(`  📡 Sending Polygon TX from ${w.address}...`);

    const tx = await w.sendTransaction({
        to: w.address,  // Self-anchoring (no external contract needed)
        value: 0,        // 0 MATIC
        data: ethers.toUtf8Bytes(payload)
    });

    console.log(`  📡 TX broadcast: ${tx.hash}`);

    // Wait for confirmation with 120s timeout
    const receipt = await Promise.race([
        tx.wait(),
        new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Polygon TX timed out after 120 seconds')), 120000)
        )
    ]);

    if (!receipt || receipt.status !== 1) {
        throw new Error(`Polygon TX failed (status: ${receipt?.status})`);
    }

    return {
        txHash: receipt.hash,
        blockNumber: Number(receipt.blockNumber),
        gasUsed: Number(receipt.gasUsed)
    };
}

/**
 * Verify a Polygon anchor by reading the transaction calldata
 * 
 * @param {string} txHash - Polygon transaction hash
 * @param {string} expectedHash - Expected local blockchain hash
 * @returns {Promise<{verified: boolean, blockNumber: number|null, from: string, data: Object|null, explorerUrl: string, error: string|null}>}
 */
async function verifyPolygonAnchor(txHash, expectedHash) {
    if (!isReady) {
        return { verified: false, error: 'Polygon not configured on server', explorerUrl: '' };
    }

    try {
        const w = getWallet();
        const tx = await w.provider.getTransaction(txHash);

        if (!tx) {
            return { verified: false, error: 'Transaction not found on Polygon', explorerUrl: `${POLYGON_CONFIG.explorerUrl}/tx/${txHash}` };
        }

        if (!tx.blockNumber && tx.blockNumber !== 0) {
            return { verified: false, error: 'Transaction still pending', pending: true, explorerUrl: `${POLYGON_CONFIG.explorerUrl}/tx/${txHash}` };
        }

        // Decode calldata and verify hash
        let parsedData = null;
        let hashMatch = false;

        try {
            const inputStr = ethers.toUtf8String(tx.data);
            parsedData = JSON.parse(inputStr);
            hashMatch = parsedData.h === expectedHash;
        } catch (decodeErr) {
            return { verified: false, error: 'Could not decode transaction data', explorerUrl: `${POLYGON_CONFIG.explorerUrl}/tx/${txHash}` };
        }

        return {
            verified: hashMatch,
            blockNumber: Number(tx.blockNumber),
            from: tx.from,
            data: parsedData,
            explorerUrl: `${POLYGON_CONFIG.explorerUrl}/tx/${txHash}`,
            error: null
        };
    } catch (err) {
        return { verified: false, error: err.message, explorerUrl: `${POLYGON_CONFIG.explorerUrl}/tx/${txHash}` };
    }
}

/**
 * Get the Polygonscan URL for a transaction
 */
function getExplorerTxUrl(txHash) {
    if (!txHash) return null;
    return `${POLYGON_CONFIG.explorerUrl}/tx/${txHash}`;
}

/**
 * Get the Polygonscan URL for a block
 */
function getExplorerBlockUrl(blockNumber) {
    if (!blockNumber) return null;
    return `${POLYGON_CONFIG.explorerUrl}/block/${blockNumber}`;
}

module.exports = { anchorOnPolygon, verifyPolygonAnchor, getExplorerTxUrl, getExplorerBlockUrl, isReady: () => isReady, getConfig: () => POLYGON_CONFIG };