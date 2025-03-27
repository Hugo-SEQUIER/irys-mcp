# Irys MCP

A Model Context Protocol (MCP) implementation for interacting with Irys, a decentralized data storage solution.

## Overview

This MCP enables AI agents to store, retrieve, and mutate data on the Irys network. It provides tools for:

- Uploading data, files, and images to Irys
- Retrieving data from transactions
- Querying transaction IDs by wallet address, tags, and timestamps
- Mutating data on the Irys network

## Prerequisites

- Node.js (v14+)
- Ethereum wallet private key

## Installation

```bash
# Clone the repository
git clone [repository-url]
cd irys-mcp

# Install dependencies
npm install
```

## Configuration

Create a `.env` file in the root directory with your Ethereum wallet private key:

```
PRIVATE_KEY=your_ethereum_private_key
```

## Usage

### Starting the MCP Server

```bash
npm start
```

### MCP Tools

This MCP implements the following tools:

#### 1. uploadDataOnIrys

Upload data, files, or images to Irys.

```javascript
{
  "data": <your-data>, // Can be a JSON object, text, etc.
  "dataType": "FILE" | "IMAGE" | "OTHER", // Type of data being uploaded
  "tags": [
    {
      "name": "string", // Tag name
      "values": ["string"] // Tag values
    }
  ]
}
```

#### 2. retrieveDataFromIrys

Retrieve data from Irys by querying with wallet addresses, tags, and timestamps.

```javascript
{
  "walletAddress": ["string"], // Array of wallet addresses
  "tags": [
    {
      "name": "string", // Tag name
      "values": ["string"] // Tag values
    }
  ],
  "timestamp": {
    "from": number, // Unix timestamp
    "to": number // Unix timestamp
  }
}
```

#### 3. retrieveDataFromATransactionId

Retrieve data from a specific transaction ID.

```javascript
{
  "transactionId": "string", // Transaction ID
  "isMutable": boolean // Optional flag for mutable data
}
```

#### 4. mutateDataOnIrys

Mutate data on the Irys network.

```javascript
{
  "data": <your-data>, // Data to mutate
  "rootTransactionId": "string", // Transaction ID of data to mutate
  "alreadyUploaded": boolean // Optional flag for already uploaded data
}
```

## Examples

### Upload Data

```javascript
// Example: Upload a JSON object
{
  "data": { "message": "Hello, Irys!" },
  "dataType": "OTHER",
  "tags": [
    {
      "name": "Content-Type",
      "values": ["application/json"]
    },
    {
      "name": "App-Name",
      "values": ["MyApp"]
    }
  ]
}
```

### Retrieve Data

```javascript
// Example: Retrieve data by wallet address
{
  "walletAddress": ["0x123...abc"]
}

// Example: Retrieve data with specific tags
{
  "walletAddress": ["0x123...abc"],
  "tags": [
    {
      "name": "App-Name",
      "values": ["MyApp"]
    }
  ]
}
```
