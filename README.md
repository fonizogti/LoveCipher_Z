# LoveCipher: Private Dating Preference Matching

LoveCipher is a privacy-preserving application that revolutionizes the dating experience by utilizing Zama's Fully Homomorphic Encryption (FHE) technology. This innovative platform allows users to match their dating preferences without compromising their confidential information, ensuring that privacy remains paramount while facilitating meaningful connections.

## The Problem

In today’s digital landscape, dating apps often require users to disclose sensitive personal information, ranging from preferences to intimate details. This reliance on cleartext data exposes users to significant privacy risks, including data breaches and unwanted profiling. As users engage with these platforms, their private lives may become vulnerable, leading to misuse of their information by malicious actors.

LoveCipher fills this critical gap by allowing individuals to express their dating preferences securely, without revealing any personal information until a match is confirmed. By doing so, users can engage with the dating ecosystem in a safer, more secure way.

## The Zama FHE Solution

The potential of Fully Homomorphic Encryption (FHE) unfolds through its ability to perform computations on encrypted data. LoveCipher leverages Zama's cutting-edge FHE libraries to securely calculate matches without ever exposing users' preferences in cleartext. Using fhevm, we process encrypted inputs to generate compatibility scores, ensuring that sensitive data remains confidential throughout the matching process.

By incorporating FHE technology, LoveCipher not only enhances privacy but also builds trust among users, reassuring them that their information is safeguarded against prying eyes.

## Key Features

- 🔒 **Privacy-First Matching**: Users submit encrypted preferences, ensuring that no personal data is exposed until a match is confirmed.
- 💖 **Compatibility Scoring**: The system employs advanced algorithms to compute matching scores based on encrypted data.
- 🚀 **User-Friendly Interface**: A sleek, intuitive design that makes it easy for users to express preferences and view matches.
- 🔄 **Dynamic Matching Radar**: An engaging feature that visualizes potential compatibility levels, allowing users to explore various matches.
- 💌 **Secure Communication**: Once a high match score is achieved, users can unlock profiles and initiate secure conversations without fear of data exposure.

## Technical Architecture & Stack

LoveCipher utilizes a robust technology stack centered around Zama's FHE capabilities:

- **Core Privacy Engine**: Zama's FHE technology (fhevm)
- **Backend Framework**: Node.js
- **Frontend Framework**: React
- **Database**: Encrypted MongoDB
- **Encryption Protocol**: TFHE-rs for enhanced security

## Smart Contract / Core Logic

Here’s a simplified snippet demonstrating how we might leverage Zama's libraries for computing a compatibility score:

```solidity
pragma solidity ^0.8.0;

// Example of a simple compatibility scoring contract using TFHE

contract LoveCipherMatch {
    function calculateMatchScore(uint64 encryptedPreferenceA, uint64 encryptedPreferenceB) public view returns (uint64) {
        // Using TFHE to add encrypted preferences and return the match score
        return TFHE.add(encryptedPreferenceA, encryptedPreferenceB);
    }

    function decryptScore(uint64 encryptedScore) public view returns (uint64) {
        return TFHE.decrypt(encryptedScore);
    }
}
```

## Directory Structure

Below is the structure of the LoveCipher project:

```
LoveCipher/
├── .env
├── client/
│   ├── src/
│   │   ├── components/
│   │   ├── App.js
│   │   └── index.js
│   └── package.json
├── server/
│   ├── contracts/
│   │   └── LoveCipherMatch.sol
│   ├── src/
│   │   └── index.js
│   ├── package.json
└── README.md
```

## Installation & Setup

To get started with LoveCipher, please follow these steps:

### Prerequisites

- Node.js (version 14 or higher)
- npm package manager
- Docker (optional, for local database setup)

### Installing Dependencies

1. Navigate to the server directory and install the required dependencies:

   ```bash
   npm install
   ```

2. Next, move to the client directory and install the necessary frontend dependencies:

   ```bash
   npm install
   ```

3. Install the Zama library for FHE capabilities in the server:

   ```bash
   npm install fhevm
   ```

## Build & Run

To run the LoveCipher application, use the commands below:

1. For the server:

   ```bash
   npm run start
   ```

2. For the client:

   ```bash
   npm run start
   ```

This should launch the application, allowing you to interact with the dating matching service securely.

## Acknowledgements

We would like to express our profound gratitude to Zama for providing the open-source Fully Homomorphic Encryption primitives that make LoveCipher possible. Their pioneering technology enables us to create a secure, privacy-centric platform where users can engage in meaningful connections without the fear of data exposure.


