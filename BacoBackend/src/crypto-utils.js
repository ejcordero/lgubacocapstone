const crypto = require('crypto');

class CryptoUtils {
    static generateKeyPair() {
        const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
            modulusLength: 2048,
            publicKeyEncoding: { type: 'spki', format: 'pem' },
            privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
        });
        return { publicKey, privateKey };
    }

    static generateKeyFingerprint(publicKey) {
        return crypto.createHash('sha256').update(publicKey).digest('hex');
    }

    static sign(message, privateKey) {
        const signer = crypto.createSign('RSA-SHA256');
        signer.update(message);
        return signer.sign(privateKey, 'hex');
    }

    static verify(message, signature, publicKey) {
        try {
            const verifier = crypto.createVerify('RSA-SHA256');
            verifier.update(message);
            return verifier.verify(publicKey, signature, 'hex');
        } catch (e) {
            return false;
        }
    }
}

module.exports = CryptoUtils;