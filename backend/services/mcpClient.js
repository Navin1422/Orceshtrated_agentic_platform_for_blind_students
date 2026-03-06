/* 
  EduVoice MCP Client - Connects the Backend LLM to the MCP Server
  Path: /Users/navins/Documents/EduVoice_GCT 2/backend/services/mcpClient.js
*/

const { Client } = require("@modelcontextprotocol/sdk/client/index.js");
const { StdioClientTransport } = require("@modelcontextprotocol/sdk/client/stdio.js");
const path = require("path");

class EduVoiceMCPClient {
  constructor() {
    this.client = null;
    this.transport = null;
  }

  async connect() {
    if (this.client) return this.client;

    this.transport = new StdioClientTransport({
      command: "node",
      args: [path.join(__dirname, "../../eduvoice-mcp/index.js")],
      env: process.env,
    });

    this.client = new Client({
      name: "eduvoice-backend-client",
      version: "1.0.0",
    }, {
      capabilities: {}
    });

    await this.client.connect(this.transport);
    console.log("✅ EduVoice Backend connected to MCP Server");
    return this.client;
  }

  async callTool(name, args) {
    const client = await this.connect();
    return await client.callTool({
      name,
      arguments: args,
    });
  }

  async listTools() {
    const client = await this.connect();
    return await client.listTools();
  }

  async disconnect() {
    if (this.transport) {
      this.transport.close();
      this.client = null;
      this.transport = null;
    }
  }
}

module.exports = new EduVoiceMCPClient();
