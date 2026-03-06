/* 
  MCP Verification Tool - Tests if the MCP Server is responding
  Path: /Users/navins/Documents/EduVoice_GCT 2/eduvoice-mcp/test-mcp.js
*/

const { Client } = require("@modelcontextprotocol/sdk/client/index.js");
const { StdioClientTransport } = require("@modelcontextprotocol/sdk/client/stdio.js");
const path = require("path");
require("dotenv").config();

async function testMCP() {
  console.log("🔍 Testing EduVoice MCP Server connection...");

  const transport = new StdioClientTransport({
    command: "node",
    args: [path.join(__dirname, "index.js")],
    env: process.env,
  });

  const client = new Client({
    name: "test-client",
    version: "1.0.0",
  }, {
    capabilities: {}
  });

  try {
    await client.connect(transport);
    console.log("✅ Successfully connected to MCP Server!");

    console.log("\n📦 Listing available tools:");
    const tools = await client.listTools();
    tools.tools.forEach(tool => {
      console.log(` - [TOOL] ${tool.name}: ${tool.description}`);
    });

    console.log("\n💬 Attempting to call 'get_student_profile' tool...");
    // We try a random ID to see if it queries the database
    const result = await client.callTool({
      name: "get_student_profile",
      arguments: { studentId: "STU_TEST_999" }
    });
    
    console.log("🛠️ Tool Result:", result.content[0].text);
    console.log("\n✅ MCP Implementation Verified!");

  } catch (error) {
    console.error("❌ MCP Test Failed:", error);
  } finally {
    process.exit();
  }
}

testMCP();
