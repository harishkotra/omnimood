# OmniMood: A Cross-Chain AI Sentiment Oracle

[![Node.js](https://img.shields.io/badge/Node.js-18.x-green.svg)](https://nodejs.org/) [![Ethers.js](https://img.shields.io/badge/Ethers.js-v6-blue.svg)](https://ethers.org/) [![Express.js](https://img.shields.io/badge/Express.js-4.x-lightgrey.svg)](https://expressjs.com/) [![PushChain](https://img.shields.io/badge/Powered_by-PushChain-purple.svg)](https://push.org/)

OmniMood transforms raw, fragmented, multi-chain data into a single, trusted sentiment score and broadcasts it on the PushChain blockchain, making it a universally accessible piece of on-chain intelligence.

[Deployed Contract](https://donut.push.network/address/0x5834AB6091b0cD0dd4619AEE30E41cE6426De0eA?tab=index)

[Sentiment Transactions Minted On-Chain](https://donut.push.network/address/0x5834AB6091b0cD0dd4619AEE30E41cE6426De0eA?tab=txs)

[Pitch Video](https://youtu.be/esHhuLmv1cE)

<img width="1737" height="1854" alt="screencapture-localhost-3000-2025-10-28-23_20_51" src="https://github.com/user-attachments/assets/a67a1f51-6be6-441b-abb7-1e2e3202678e" />
<img width="1424" height="1864" alt="screencapture-localhost-3000-2025-10-28-20_55_14" src="https://github.com/user-attachments/assets/01c7f514-8310-42f2-b44e-05b83a0adf78" />
<img width="623" height="1163" alt="screencapture-localhost-5173-2025-10-28-23_21_24" src="https://github.com/user-attachments/assets/3619f483-7d7d-4f15-9e4b-f584dc94c268" />


This project serves as a full-stack dApp demonstrating how to:
1.  Aggregate on-chain data from multiple blockchains (e.g., Sepolia & Base Sepolia).
2.  Use a Large Language Model (via a Gaia AI node) to perform sentiment analysis on that data.
3.  Use the **PushChain SDK** to send a universal transaction to write the result to a smart contract on the PushChain testnet.
4.  Serve an interactive frontend that allows users to trigger the oracle process and view the results in real-time.

---

## 🏛️ Architecture Overview

OmniMood operates through a simple but powerful architecture:

1.  **User Trigger:** A user initiates the process from a simple web interface.
2.  **Backend API:** A Node.js/Express server receives the request.
3.  **Data Aggregation:** The server queries multiple blockchains (Sepolia, Base Sepolia) for recent `USDC` transfer events.
4.  **AI Analysis:** The aggregated data is summarized and sent to a Gaia AI node, which returns a sentiment score between -10 (Very Bearish) and 10 (Very Bullish).
5.  **On-Chain Settlement:** The backend uses the PushChain SDK to send a transaction, updating the `SentimentOracle` smart contract on the PushChain Donut testnet with the new score.
6.  **Data Display:** The frontend reads the latest score directly from the smart contract and displays it on the public dashboard.

---

## ✨ Key Features

*   **Multi-Chain Data Source:** Fetches data from multiple EVM chains concurrently.
*   **AI-Powered Sentiment Analysis:** Leverages a custom Gaia AI node to provide nuanced sentiment scores.
*   **Decentralized Publishing:** Publishes the final score on the PushChain blockchain, making it a tamper-proof public good.
*   **Interactive Frontend:** A simple, clean UI allows any user to trigger an update and see a live log of the entire cross-chain process.
*   **Unified Full-Stack App:** The backend server handles all blockchain and AI interactions and serves the frontend, creating a single, easy-to-run application.

---

## 🛠️ Tech Stack

*   **Smart Contract:** Solidity `0.8.17` (deployed via Remix)
*   **Backend:** Node.js, Express.js, Ethers.js, OpenAI SDK, **PushChain SDK (`@pushchain/core`)**
*   **Frontend:** Plain HTML, CSS, and JavaScript (no frameworks)
*   **AI:** Gaia Node (OpenAI-compatible endpoint)

---

## 🚀 Getting Started

### Prerequisites

*   Node.js (v18 or later)
*   An EVM-compatible wallet (like MetaMask) and its **private key for a development account**.
*   Testnet tokens for the **PushChain Donut Testnet** (get from the [Push Faucet](https://faucet.push.org/)).
*   An API Key and endpoint URL for a **Gaia AI Node**.
*   RPC URLs for the chains you want to monitor (e.g., Sepolia, Base Sepolia).

### Setup & Installation

1.  **Clone the Repository (or create the project structure):**
    ```bash
    git clone https://github.com/harishkotra/omnimood.git
    cd omnimood
    ```

2.  **Install Dependencies:**
    ```bash
    npm install
    ```

3.  **Create and Configure the Environment File:**
    Create a `.env` file in the root directory and populate it with your credentials. Use the `.env.example` as a template:
    ```env
    # .env.example

    # Your development wallet's private key. DO NOT USE A MAINNET KEY.
    PRIVATE_KEY="0xYOUR_DEVELOPMENT_WALLET_PRIVATE_KEY"

    # Your Gaia AI Node API key and endpoint URL
    GAIA_API_KEY="YOUR_GAIA_API_KEY"
    GAIA_ENDPOINT="https://YOUR_GAIA_NODE_ENDPOINT/v1"

    # RPC URLs for all chains
    PUSH_CHAIN_RPC_URL="https://evm.rpc-testnet-donut-node1.push.org/"
    SEPOLIA_RPC_URL="https://ethereum-sepolia.publicnode.com"
    BASE_SEPOLIA_RPC_URL="https://sepolia.base.org"

    # Will be filled in after deployment
    ORACLE_CONTRACT_ADDRESS=""
    ```

4.  **Deploy the Smart Contract:**
    *   Go to [remix.ethereum.org](https://remix.ethereum.org).
    *   Create `SentimentOracle.sol` and paste the contract code.
    *   In the "Solidity Compiler" tab, select compiler version **`0.8.17`**.
    *   In the "Deploy & Run" tab, set the "Environment" to "Injected Provider - MetaMask" and ensure MetaMask is connected to the **Push Donut Testnet**.
    *   Click **Deploy**.
    *   Copy the newly deployed contract address.

5.  **Update Configuration:**
    *   Paste the new contract address into `ORACLE_CONTRACT_ADDRESS` in your `.env` file.
    *   Paste the new contract address into the `ORACLE_CONTRACT_ADDRESS` constant in `public/index.html`.

### Running the Application

1.  **Start the Backend Server:**
    ```bash
    node oracle-service.js
    ```

2.  **Open the Frontend:**
    Navigate to **`http://localhost:3000`** in your web browser.

3.  **Interact:**
    *   The page will load the initial (or last known) score from the smart contract.
    *   Click the **"Run New Analysis"** button to trigger a live update. Watch the log to see the cross-chain data fetching, AI analysis, and final PushChain transaction in real-time.

---

## 🔮 Next Steps & Future Vision

OmniMood is a powerful proof-of-concept. Here’s how it can evolve into a full-fledged, decentralized intelligence protocol:

### Short-Term Improvements (The next sprints)

1.  **Expand Data Sources:**
    *   **More Chains:** Add support for more EVM and non-EVM testnets to make the sentiment score truly "omni."
    *   **More Data Points:** Instead of just `Transfer` events, analyze `Mint`, `Burn`, `Swap`, and contract interaction events for a more nuanced sentiment score. This would involve integrating ABIs of popular protocols like Uniswap or Aave.

2.  **Automate the Oracle Trigger:**
    While user-triggered updates are great for demos, a true oracle needs to be automated. Re-introduce a server-side timer (`setInterval` or a cron job) to run the `runOracleUpdate` function periodically (e.g., every 15 minutes). The frontend button can remain as a manual override.

3.  **Enhance the UI/UX:**
    *   **Historical Data Chart:** Store past scores (either on-chain in an array or off-chain in a database) and display a historical chart on the frontend to show sentiment trends over time.
    *   **More Granular Logs:** In the live log, provide links to the block explorers of Sepolia and Base Sepolia for the specific block ranges being queried.

### Mid-Term Goals (The next quarter)

1.  **Protocol-Level Integration (Become a True Oracle):**
    *   Add a new read-only function to the `SentimentOracle.sol` contract, like `getSentimentScore()`, that is optimized for other smart contracts to call. This allows other DeFi dApps on PushChain to programmatically access your sentiment score and build logic around it (e.g., "disable borrowing if USDC sentiment drops below -8").

2.  **Decentralize the Backend:**
    The current Node.js server is a single point of failure. The next logical step is to move the oracle logic to a decentralized network.
    *   **Research Decentralized Oracle Networks (DONs):** Explore how the backend logic could be adapted to run on a network like Chainlink, ensuring no single entity controls the update process.

### Long-Term Vision (The North Star)

1.  **Create a Generalized Sentiment Protocol:**
    Expand beyond just USDC. Create a factory contract on PushChain that allows anyone to deploy a new sentiment oracle for *any token on any chain*. Users could pay a small fee to the protocol to spin up a new monitoring service.

2.  **Introduce a Token Model:**
    A native token could be used for staking by oracle operators (to ensure honesty), paying for new oracle creation, and governing the protocol's future development.

3.  **Become the "Mood Layer" for Web3:**
    The ultimate vision is for OmniMood to be the go-to protocol for on-chain, AI-driven sentiment analysis. Any dApp, trader, or DAO looking for a quick, reliable pulse on cross-chain asset sentiment would query an OmniMood oracle.
