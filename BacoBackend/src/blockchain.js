const Block = require('./block');
const SHA256 = require('crypto-js/sha256');

class Blockchain {
    constructor() {
        this.chain = [this.createGenesisBlock()];
        this.difficulty = 2;
    }

    createGenesisBlock() {
        const genesisBlock = new Block(Date.now(), "Genesis Block for TALA", "0");
        genesisBlock.index = 0;
        return genesisBlock;
    }

    getLastBlock() {
        return this.chain[this.chain.length - 1];
    }

    addProjectRecord(data) {
        const newBlock = new Block(Date.now(), data, this.getLastBlock().hash);
        newBlock.index = this.chain.length; 
        newBlock.mineBlock(this.difficulty);
        this.chain.push(newBlock);
        return newBlock;
    }

    isChainValid(chainToCheck = this.chain) {
        for (let i = 1; i < chainToCheck.length; i++) {
            const currentBlock = chainToCheck[i];
            const previousBlock = chainToCheck[i - 1];
            const recalculatedHash = SHA256(previousBlock.hash + currentBlock.timestamp + JSON.stringify(currentBlock.data) + currentBlock.nonce).toString();
            
            if (currentBlock.hash !== recalculatedHash) return false;
            if (currentBlock.previousHash !== previousBlock.hash) return false;
        }
        return true;
    }
}

module.exports = Blockchain;