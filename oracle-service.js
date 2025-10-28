require('dotenv').config();
const { PushChain } = require('@pushchain/core');
const { ethers } = require('ethers');
const { OpenAI } = require('openai');
const express = require('express');
const cors = require('cors');
const path = require('path');
const fetch = require('cross-fetch'); // Still needed for the frontend static files, although not used for chainlist now

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
const PORT = 3000;

// -- State object now includes fields for raw data and prompt
let oracleState = {
    isUpdating: false,
    currentStep: 'Idle',
    chainsQueried: null,
    rawEventsData: null,
    aiSystemPrompt: null,
    aiUserPrompt: null,
    aiRawResponse: null,
    aiScore: null,
    transactionHash: null,
    finalMessage: "Ready to start. Select chains and run analysis.",
};

// --- 1. CONFIGURE BLOCKCHAIN CONNECTIONS ---
// Define supported testnets directly
const SUPPORTED_CHAINS = [
    {
        name: "Ethereum Sepolia",
        chainId: 11155111,
        rpcUrl: process.env.SEPOLIA_RPC_URL, // Must be defined in .env
        tokenAddress: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238", // USDC
        tokenDecimals: 6
    },
    {
        name: "Base Sepolia",
        chainId: 84532,
        rpcUrl: process.env.BASE_SEPOLIA_RPC_URL, // Must be defined in .env
        tokenAddress: "0x036CbD53842c5426634e7929541eC2318f3dCF7e", // USDC
        tokenDecimals: 6
    },
    {
        name: "Monad Testnet",
        chainId: 10143,
        rpcUrl: process.env.MONAD_TESTNET_RPC_URL, // Must be defined in .env
        tokenAddress: process.env.MONAD_TEST_TOKEN_ADDRESS, // e.g., a test token, must be defined in .env
        tokenDecimals: 18 // Adjust if different
    }
];

// Create contract instances for supported chains
const contractInstances = {};
SUPPORTED_CHAINS.forEach(chain => {
    const provider = new ethers.JsonRpcProvider(chain.rpcUrl);
    const contract = new ethers.Contract(chain.tokenAddress, ["event Transfer(address indexed from, address indexed to, uint256 value)"], provider);
    contractInstances[chain.chainId] = { contract, provider, decimals: chain.tokenDecimals };
});

const pushProvider = new ethers.JsonRpcProvider(process.env.PUSH_CHAIN_RPC_URL);
const oracleContract = new ethers.Contract(process.env.ORACLE_CONTRACT_ADDRESS, ["function getOracleData() view returns (int256, string, uint256)"], pushProvider);

// --- 2. FETCH DATA FROM SELECTED CHAINS ---
async function getRecentTransferData(chainsToQuery) {
    console.log(`Fetching data from ${chainsToQuery.length} chains...`);
    
    const promises = chainsToQuery.map(async (chain) => {
        const chainConfig = SUPPORTED_CHAINS.find(c => c.chainId === chain.chainId);
        if (!chainConfig) {
            console.error(`Chain ${chain.chainId} not supported.`);
            return { chain: chain.name, events: [] }; // Return empty on error
        }

        try {
            const { contract, provider, decimals } = contractInstances[chainConfig.chainId];
            const blockNumber = await provider.getBlockNumber();
            const events = await contract.queryFilter(contract.filters.Transfer(null, null), blockNumber - 100, blockNumber);
            return { chain: chain.name, events, decimals };
        } catch (error) {
            console.error(`Failed to fetch from ${chain.name}: ${error.message}`);
            return { chain: chain.name, events: [], decimals: 0 }; // Return empty on error
        }
    });

    const results = await Promise.all(promises);
    
    let allEvents = [];
    results.forEach(result => allEvents.push(...result.events));

    if (allEvents.length === 0) {
        return { summary: "No recent transfer activity observed on selected chains.", rawEvents: [] };
    }

    let totalValue = 0n;
    const rawEventData = allEvents.map((event, i) => {
        const result = results.find(r => r.events.includes(event));
        const chainConfig = SUPPORTED_CHAINS.find(c => c.name === result.chain);
        totalValue += event.args.value;
        return {
            chain: result.chain,
            value: ethers.formatUnits(event.args.value, chainConfig.tokenDecimals || 6)
        };
    });

    const summary = `Found ${allEvents.length} total transfers across selected chains. Total value: ${ethers.formatUnits(totalValue, 6)} (aggregated across different tokens/chains).`; // Note: Aggregation across different tokens is complex, simplified here
    return { summary, rawEvents: rawEventData };
}

// --- 3. ANALYZE WITH GAIA AI ---
async function getSentimentFromAI(systemPrompt, userPrompt) {
    console.log("Asking Gaia AI...");
    try {
        const response = await new OpenAI({ apiKey: process.env.GAIA_API_KEY, baseURL: process.env.GAIA_ENDPOINT }).chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
            max_tokens: 50,
            temperature: 0.1
        });
        const rawResponse = response.choices[0].message.content.trim();
        const scoreMatch = rawResponse.match(/-?\d+/);
        if (!scoreMatch) return { score: 0, rawResponse: `Could not parse score. AI said: "${rawResponse}"` };
        
        const score = parseInt(scoreMatch[0], 10);
        // Clamp the score to the new range of -10 to 10
        return { score: Math.max(-10, Math.min(10, score)), rawResponse };
    } catch (error) {
        console.error("AI analysis error:", error);
        throw new Error("AI analysis failed.");
    }
}

// --- 4. UPDATE ORACLE CONTRACT ON PUSH CHAIN ---
async function updateOracleContract(score, dataSummary) {
    try {
        const wallet = new ethers.Wallet(process.env.PRIVATE_KEY);
        const provider = new ethers.JsonRpcProvider(process.env.PUSH_CHAIN_RPC_URL);
        const signer = wallet.connect(provider);
        const universalSigner = await PushChain.utils.signer.toUniversal(signer);
        const pushChainClient = await PushChain.initialize(universalSigner, { network: PushChain.CONSTANTS.PUSH_NETWORK.TESTNET });
        const contractInterface = new ethers.Interface(["function updateSentiment(int256, string)"]);
        const encodedData = contractInterface.encodeFunctionData("updateSentiment", [BigInt(score), dataSummary]);
        const txResponse = await pushChainClient.universal.sendTransaction({ to: process.env.ORACLE_CONTRACT_ADDRESS, data: encodedData, value: BigInt(0) });
        await txResponse.wait(); // Wait for confirmation before returning hash
        return txResponse.hash;
    } catch (error) {
        console.error("PushChain update error:", error);
        throw new Error("Failed to write to PushChain.");
    }
}

// --- 5. MAIN ORCHESTRATION ---
async function runOracleUpdate(chainsToQuery) {
    if (oracleState.isUpdating) return;
    oracleState = { isUpdating: true, currentStep: 'Starting...', chainsQueried: chainsToQuery.map(c => c.name), rawEventsData: null, aiSystemPrompt: null, aiUserPrompt: null, aiRawResponse: null, aiScore: null, transactionHash: null, finalMessage: null };
    try {
        oracleState.currentStep = `1/3: Fetching data from ${chainsToQuery.length} chain(s)...`;
        const { summary, rawEvents } = await getRecentTransferData(chainsToQuery);
        oracleState.fetchedDataSummary = summary;
        oracleState.rawEventsData = rawEvents;

        oracleState.currentStep = '2/3: Analyzing sentiment with Gaia AI...';
        const systemPrompt = `You are a blockchain sentiment analyst. Your task is to analyze a summary of token transfers across multiple chains and provide a single sentiment score from -10 (very bearish) to 10 (very bullish). High volume could be bullish or bearish. Respond ONLY with the numerical score.`;
        const userPrompt = `Data: "${summary}"`;
        oracleState.aiSystemPrompt = systemPrompt;
        oracleState.aiUserPrompt = userPrompt;
        const { score, rawResponse } = await getSentimentFromAI(systemPrompt, userPrompt);
        oracleState.aiScore = score;
        oracleState.aiRawResponse = rawResponse;

        oracleState.currentStep = '3/3: Broadcasting score to PushChain...';
        const txHash = await updateOracleContract(score, summary);
        oracleState.transactionHash = txHash;

        oracleState.finalMessage = `Cycle Complete! New sentiment score is ${score}.`;
        oracleState.currentStep = 'Idle';
    } catch (error) {
        oracleState.finalMessage = `Error: ${error.message}.`;
        oracleState.currentStep = 'Idle';
    } finally {
        oracleState.isUpdating = false;
    }
}

// --- 6. API ENDPOINTS ---
app.get('/get-chains', (req, res) => {
    // Return only the hardcoded supported chains
    res.json(SUPPORTED_CHAINS.map(chain => ({
        name: chain.name,
        chainId: chain.chainId,
        // Optionally include token info if frontend needs it
        // tokenAddress: chain.tokenAddress,
        // tokenDecimals: chain.tokenDecimals
    })));
});

app.get('/get-current-score', async (req, res) => {
    try {
        const [score, summary, timestamp] = await oracleContract.getOracleData();
        res.json({ score: Number(score), summary, timestamp: Number(timestamp) });
    } catch (error) {
        console.error("Error fetching from PushChain contract:", error);
        res.status(500).json({ error: "Failed to fetch data from PushChain contract." });
    }
});

app.post('/trigger-oracle-update', (req, res) => {
    const { chains } = req.body; // Now receives the array of chain objects selected by the frontend

    if (!chains || chains.length === 0 || chains.length > 5) {
        return res.status(400).json({ message: "Invalid selection. Please select between 1 and 5 chains." });
    }

    // Validate that received chains are in our SUPPORTED_CHAINS list
    const isValid = chains.every(selectedChain => 
        SUPPORTED_CHAINS.some(supportedChain => supportedChain.chainId === selectedChain.chainId)
    );

    if (!isValid) {
        return res.status(400).json({ message: "One or more selected chains are not supported." });
    }

    if (oracleState.isUpdating) return res.status(429).json({ message: "Update already in progress." });
    
    res.status(202).json({ message: "Oracle update triggered!" });
    runOracleUpdate(chains); // Pass the validated chain objects
});

app.get('/status', (req, res) => res.json(oracleState));

// --- 7. START SERVER ---
app.listen(PORT, () => {
    console.log(`OmniMood Oracle App is live at http://localhost:${PORT}`);
    console.log(`Supported Chains: ${SUPPORTED_CHAINS.map(c => c.name).join(", ")}`);
});