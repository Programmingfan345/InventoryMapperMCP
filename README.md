📦 Inventory Mapper MCP Server

Prototype MCP server for AI-powered store inventory mapping.
Implements tools that let staff quickly locate products and validate category placement.

✅ Features Implemented

This MCP server supports:

1. find_product

Search a product by name or SKU and return:

Product info

Front shelf location

Back shelf location

2. scan_barcode

Staff scan a barcode → system returns:

Product info

Suggested back-shelf restock location

Category validation status

3. validate_category_map

Checks whether a product was placed in the correct back-shelf zone.
Useful for preventing mis-categorized items (e.g., liquor placed in snacks).

4. Health Check

Used by the MCP runtime to verify the server is alive.

🏗 Folder Structure
InventoryMapperMCP/
│── server.js
│── package.json
│── Dockerfile
│── floorplan.json
│── README.md   <-- this file

🚀 How to Run (Option 1 — Local Node.js)
Install dependencies
npm install

Run the MCP server
npm start


The server will run on:

http://localhost:8081

🐳 How to Run (Option 2 — Docker)
Build the Docker image
docker build -t inventory-mapper-mcp .

Run the container
docker run -p 8081:8081 inventory-mapper-mcp

🧪 Example Tool Calls (cURL)
✔️ 1. Find a product
curl -X POST http://localhost:8081/tools/find_product ^
 -H "Content-Type: application/json" ^
 -d "{\"query\":\"Modelo\", \"by\":\"name\"}"

✔️ 2. Scan barcode
curl -X POST http://localhost:8081/tools/scan_barcode ^
 -H "Content-Type: application/json" ^
 -d "{\"barcode\":\"0004900001234\"}"

✔️ 3. Validate category placement
curl -X POST http://localhost:8081/tools/validate_category_map ^
 -H "Content-Type: application/json" ^
 -d "{\"sku\":\"SKU-0001\",\"candidate_back_location_code\":\"BACK:Snacks/Bay3/Shelf2/BinC\"}"

✔️ 4. Health check
curl http://localhost:8081/health


Expected response:

{"status": "ok"}
