import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { Uploader } from "@irys/upload";
import { BaseEth } from "@irys/upload-ethereum";
import { gql, GraphQLClient } from "graphql-request";
import dotenv from "dotenv";

dotenv.config();

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

export interface GraphQLTag {
    name: string;
    values: any[];
}

interface FetchDataFromTransactionResponse {
    success: boolean;
    data: any;
    error?: string;
}

interface IrysTimestamp {
    from?: number;
    to?: number;
}

interface UploadDataOnIrysResponse {
    success: boolean;
    url?: string;
    error?: string;
}

export enum IrysDataType {
    FILE = "FILE",
    IMAGE = "IMAGE",
    OTHER = "OTHER",
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

async function uploadDataOnIrys(data: any, tags: GraphQLTag[]): Promise<UploadDataOnIrysResponse> {
    const irysUploader = await getIrysUploader();
    
    // Transform tags to the correct format
    const formattedTags = tags.map(tag => ({
        name: tag.name,
        value: Array.isArray(tag.values) ? tag.values.join(',') : tag.values
    }));

    try {
        const dataToStore = {
            data: data,
        };
        const receipt = await irysUploader.upload(JSON.stringify(dataToStore), { tags: formattedTags });
        return { 
            success: true,
            url: `https://gateway.irys.xyz/${receipt.id}`
        };
    } catch (error) {
        return { 
            success: false,
            error: "Error uploading to Irys, " + error 
        };
    }
}

async function uploadFileOrImageOnIrys(data: string, tags: GraphQLTag[]): Promise<UploadDataOnIrysResponse> {
    const irysUploader = await getIrysUploader();
    
    // Transform tags to the correct format
    const formattedTags = tags.map(tag => ({
        name: tag.name,
        value: Array.isArray(tag.values) ? tag.values.join(',') : tag.values
    }));

    try {
        const receipt = await irysUploader.uploadFile(data, { tags: formattedTags });
        return { 
            success: true,
            url: `https://gateway.irys.xyz/${receipt.id}`
        };
    } catch (error) {
        return { 
            success: false,
            error: "Error uploading to Irys, " + error 
        };
    }
}

async function uploadOnIrys(data: any, dataType: IrysDataType, tags: GraphQLTag[]): Promise<UploadDataOnIrysResponse> {
    switch (dataType) {
        case IrysDataType.FILE:
            return uploadFileOrImageOnIrys(data, tags);
        case IrysDataType.IMAGE:
            return uploadFileOrImageOnIrys(data, tags);
        default:
            return uploadDataOnIrys(data, tags);
    }
}

async function getTransactionId(owners: string[] | null = null, tags: GraphQLTag[] | null = null, timestamp: IrysTimestamp | null = null): Promise<TransactionsIdAddress>{
    const graphQLClient = new GraphQLClient(endpointForTransactionId);
    const QUERY = gql`
        query($owners: [String!], $tags: [TagFilter!], $timestamp: TimestampFilter) {
            transactions(owners: $owners, tags: $tags, timestamp: $timestamp) {
                edges {
                    node {
                        id,
                        address
                    }
                }
            }
        }
    `;
    try {
        const variables = {
            owners: owners,
            tags: tags,
            timestamp: timestamp || null
        }
        const data: TransactionGQL = await graphQLClient.request(QUERY, variables);
        const listOfTransactions : NodeGQL[] = data.transactions.edges.map((edge: any) => edge.node);
        console.log("Transaction IDs retrieved")
        return { success: true, data: listOfTransactions };
    } catch (error) {
        console.error(`Error fetching transaction IDs: ${error}`);
        return { success: false, data: [], error: "Error fetching transaction IDs" };
    }
}

async function fetchDataFromTransactionId(transactionId: string, isMutable: boolean = false): Promise<FetchDataFromTransactionResponse> {
    try {
        console.log(`Fetching data for transaction ID: ${transactionId}`);
        const response = await fetch(`${endpointForData}${isMutable ? "/mutable" : ""}/${transactionId}`);
        
        if (!response.ok) {
            console.error(`Error fetching data for transaction ID ${transactionId}: ${response.status} ${response.statusText}`);
            return { 
                success: false, 
                data: null, 
                error: `Error fetching data from transaction ID: ${response.status} ${response.statusText}` 
            };
        }
        
        console.log(`Successfully fetched data for transaction ID: ${transactionId}`);
        return {
            success: true,
            data: response,
        };
    } catch (error) {
        console.error(`Exception while fetching data for transaction ID ${transactionId}: ${error}`);
        return { 
            success: false, 
            data: null, 
            error: `Exception while fetching data: ${error}` 
        };
    }
}

async function retrieveDataFromIrys(walletAddress: string[] | null = null, tags: GraphQLTag[] | null = null, timestamp: IrysTimestamp | null = null): Promise<FetchDataFromTransactionResponse> {
    try {
        console.log(walletAddress, tags, timestamp);
        const transactionIdsResponse = await getTransactionId(walletAddress, tags, timestamp);
        if (!transactionIdsResponse.success) return { success: false, data: null, error: transactionIdsResponse.error };
        
        // If no transactions were found, return empty array
        if (transactionIdsResponse.data.length === 0) {
            return { success: true, data: [] };
        }
        
        const transactionIdsAndResponse = transactionIdsResponse.data.map((transaction: NodeGQL) => transaction);
        const dataPromises: Promise<any>[] = transactionIdsAndResponse.map(async (node: NodeGQL) => {
            try {
                const fetchDataFromTransactionIdResponse = await fetchDataFromTransactionId(node.id);
                if (!fetchDataFromTransactionIdResponse.success) {
                    return {
                        data: null,
                        address: node.address,
                        error: fetchDataFromTransactionIdResponse.error
                    };
                }
                
                if (fetchDataFromTransactionIdResponse.data.headers && 
                    await fetchDataFromTransactionIdResponse.data.headers.get('content-type') === "application/octet-stream") {
                    try {
                        const responseText = await fetchDataFromTransactionIdResponse.data.text();
                        let data = null;
                        try {
                            data = JSON.parse(responseText);
                        } catch {
                            data = responseText;
                        }
                        return {
                            data: data,
                            address: node.address
                        };
                    } catch (error) {
                        console.error(`Error processing transaction ${node.id}: ${error}`);
                        return {
                            data: null,
                            address: node.address,
                            error: `Error processing transaction: ${error}`
                        };
                    }
                } else {
                    return {
                        data: fetchDataFromTransactionIdResponse.data.url,
                        address: node.address
                    };
                }
            } catch (error) {
                console.error(`Error processing transaction ${node.id}: ${error}`);
                return {
                    data: null,
                    address: node.address,
                    error: `Error processing transaction: ${error}`
                };
            }
        });
        
        const dataResponses = await Promise.all(dataPromises);
        return { success: true, data: dataResponses };
    } catch (error) {
        console.error(`Error fetching data from transaction IDs: ${error}`);
        return { success: false, data: null, error: `Error fetching data from transaction IDs: ${error}` };
    }
}

async function mutateDataOnIrys(data: any, rootTransactionId: string, alreadyUploaded: boolean = false){
    const irysUploader = await getIrysUploader();
    const tags = [{ name: "Root-TX", value: rootTransactionId }];
    try {
        if (alreadyUploaded) {
            const receipt = await irysUploader.upload(JSON.stringify(data), { tags: tags });
            console.log(`TX 2 uploaded https://gateway.irys.xyz/mutable/${receipt.id}`);
            return { success: true, url: `https://gateway.irys.xyz/${receipt.id}` };
        }
        else {
            const receipt = await irysUploader.upload(JSON.stringify(data));
            console.log(`TX 1 uploaded https://gateway.irys.xyz/mutable/${receipt.id}`);
            return { success: true, url: `https://gateway.irys.xyz/${receipt.id}` };
        }
    } catch (error) {
        return { success: false, error: "Error mutating data on Irys " + error };
    }
}

async function retrieveDataFromATransactionId(transactionId: string, isMutable: boolean = false): Promise<FetchDataFromTransactionResponse> {
    try {
        const fetchDataFromTransactionIdResponse = await fetchDataFromTransactionId(transactionId, isMutable);
        if (!fetchDataFromTransactionIdResponse.success) {
            return {
                success: false,
                data: null,
                error: fetchDataFromTransactionIdResponse.error
            };
        }
        
        if (fetchDataFromTransactionIdResponse.data.headers && 
            await fetchDataFromTransactionIdResponse.data.headers.get('content-type') === "application/octet-stream") {
            try {
                const responseText = await fetchDataFromTransactionIdResponse.data.text();
                let data = null;
                try {
                    data = JSON.parse(responseText);
                } catch {
                    data = responseText;
                }
                return {
                    success: true,
                    data: data,
                };
            } catch (error) {
                console.error(`Error processing transaction ${transactionId}: ${error}`);
                return {
                    success: false,
                    data: null,
                    error: `Error processing transaction: ${error}`
                };
            }
        } else {
            return {
                success: true,
                data: fetchDataFromTransactionIdResponse.data.url,
            };
        }
    } catch (error) {
        console.error(`Error processing transaction ${transactionId}: ${error}`);
        return {
            success: false,
            data: null,
            error: `Error processing transaction: ${error}`
        };
    }
}

server.tool(
    "uploadDataOnIrys",
    "Upload data to Irys",
    {
        state : z.object({
            data: z.any(),
            dataType: z.nativeEnum(IrysDataType),
            tags: z.array(z.object({
                name: z.string(),
                values: z.array(z.any())
            }))
        })
    },
    async ({state}) => {
        const uploadDataOnIrysResponse = await uploadOnIrys(state.data, state.dataType, state.tags);
        if (!uploadDataOnIrysResponse.success) {
            return {
                content: [
                    {
                        type: "text" as const,
                        text: "Error uploading data to Irys"
                    },
                    {
                        type: "text" as const,
                        text: uploadDataOnIrysResponse.error || "Unknown error"
                    }
                ]
            }
        }
        return {
            content: [
                {
                    type: "text" as const,
                    text: "Data uploaded to Irys"
                },
                {
                    type: "text" as const,
                    text: uploadDataOnIrysResponse.url || "URL not available"
                }
            ]
        }
    }
)

server.tool(
    "retrieveDataFromIrys",
    "Retrieve data from Irys",
    {
        state : z.object({
            walletAddress: z.array(z.string()),
            tags: z.array(z.object({
                name: z.string(),
                values: z.array(z.any())
            })).optional(),
            timestamp: z.object({
                from: z.number(),
                to: z.number()
            }).optional()
        })
    },
    async ({state}) => {
        const retrieveDataFromIrysResponse = await retrieveDataFromIrys(state.walletAddress, state.tags, state.timestamp);
        console.log("Response from retrieveDataFromIrys:", JSON.stringify(retrieveDataFromIrysResponse, null, 2));
        
        if (!retrieveDataFromIrysResponse.success) {
            return {
                content: [
                    {
                        type: "text" as const,
                        text: "Error retrieving data from Irys"
                    },
                    {
                        type: "text" as const,
                        text: retrieveDataFromIrysResponse.error || "Unknown error"
                    }
                ]
            };
        }
        
        // If no data was found
        if (!retrieveDataFromIrysResponse.data || retrieveDataFromIrysResponse.data.length === 0) {
            return {
                content: [
                    {
                        type: "text" as const,
                        text: "No data found for the given parameters"
                    }
                ]
            };
        }
        
        // Format the data for display
        const formattedData = JSON.stringify(retrieveDataFromIrysResponse.data, null, 2);
        
        return {
            content: [
                {
                    type: "text" as const,
                    text: "Data retrieved from Irys:"
                },
                {
                    type: "text" as const,
                    text: formattedData
                }
            ]
        };
    }
)

server.tool(
    "retrieveDataFromATransactionId",
    "Retrieve data from a transaction ID",
    {
        state : z.object({
            transactionId: z.string(),
            isMutable: z.boolean().optional()
        })
    },
    async ({state}) => {
        const retrieveDataFromATransactionIdResponse = await retrieveDataFromATransactionId(state.transactionId, state.isMutable);
        console.log("Response from retrieveDataFromATransactionId:", JSON.stringify(retrieveDataFromATransactionIdResponse, null, 2));
        
        if (!retrieveDataFromATransactionIdResponse.success) {
            return {
                content: [
                    {
                        type: "text" as const,
                        text: "Error retrieving data from a transaction ID"
                    },
                    {
                        type: "text" as const,
                        text: retrieveDataFromATransactionIdResponse.error || "Unknown error"
                    }
                ]
            };
        }
        
        // If no data was found
        if (!retrieveDataFromATransactionIdResponse.data || retrieveDataFromATransactionIdResponse.data.length === 0) {
            return {
                content: [
                    {
                        type: "text" as const,
                        text: "No data found for the given parameters"
                    }
                ]
            };
        }
        
        // Format the data for display
        const formattedData = JSON.stringify(retrieveDataFromATransactionIdResponse.data, null, 2);
        
        return {
            content: [
                {
                    type: "text" as const,
                    text: "Data retrieved from Irys:"
                },
                {
                    type: "text" as const,
                    text: formattedData
                }
            ]
        };
    }
)

server.tool(
    "mutateDataOnIrys",
    "Mutate data on Irys, data is the data to mutate, rootTransactionId is the transaction id of the data to mutate, alreadyUploaded is a boolean to check if the data has already been uploaded to Irys",
    {
        state : z.object({
            data: z.any(),
            rootTransactionId: z.string(),
            alreadyUploaded: z.boolean().optional()
        })
    },
    async ({state}) => {
        const mutateDataOnIrysResponse = await mutateDataOnIrys(state.data, state.rootTransactionId, state.alreadyUploaded);
        console.log(mutateDataOnIrysResponse);
        if (!mutateDataOnIrysResponse.success) {
            return {
                content: [
                    {
                        type: "text" as const,
                        text: "Error uploading data to Irys"
                    },
                    {
                        type: "text" as const,
                        text: mutateDataOnIrysResponse.error || "Unknown error"
                    }
                ]
            }
        }
        return {
            content: [
                {
                    type: "text" as const,
                    text: "Data uploaded to Irys"
                },
                {
                    type: "text" as const,
                    text: mutateDataOnIrysResponse.url || "URL not available"
                }
            ]
        }
    }
)


async function main(){
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.log("Server started");
}

main().catch(console.error);