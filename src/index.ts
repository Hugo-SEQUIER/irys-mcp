import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { Uploader } from "@irys/upload";
import { BaseEth } from "@irys/upload-ethereum";

const endpointForTransactionId: string = "https://uploader.irys.xyz/graphql";
const endpointForData: string = "https://gateway.irys.xyz";

interface NodeGQL {
    id: string;
    address: string;
}

interface TransactionGQL {
    transactions: {
        edges: Array<{ node: NodeGQL }>;
    };
}

interface TransactionsIdAddress {
    success: boolean;
    data: NodeGQL[];
    error?: string;
}

interface FetchDataFromTransactionResponse {
    success: boolean;
    data: any;
    error?: string;
}

interface IrysTimestamp {
    gt?: string;
    lt?: string;
}

const getIrysUploader = async () => {
    const irysUploader = await Uploader(BaseEth).withWallet(process.env.PRIVATE_KEY);
    return irysUploader;
};

const server = new McpServer({
    name: "irys-mcp",
    version: "1.0.0",
    capabilities: {
        resources: {},
        tools: {},
    },
});

async function main(){
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.log("Server started");
}

main().catch(console.error);