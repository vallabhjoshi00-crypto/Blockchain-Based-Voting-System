const express = require('express');
const app = express();

// Middleware to tell Express to accept and parse incoming JSON data
app.use(express.json());

const PORT = 5000;

// Temporary array to hold the data while the server is running
let electionData = []; 

// ---------------------------------------------------------
// ENDPOINT 1: Receive data from the ESP32 (POST)
// ---------------------------------------------------------
// Fix: Use the relative path, not the full domain URL
app.post('/webhook-test/voters', (req, res) => {
    const incomingData = req.body;
    
    // Print what the ESP32 sent to the terminal
    console.log("📥 New Data Received from ESP32:", incomingData);

    // Add a timestamp and save it to our array
    incomingData.timestamp = new Date().toLocaleString();
    electionData.push(incomingData);

    // Send a success message back to the ESP32
    res.status(200).json({ message: "Vote securely received by Node.js!" });
});

// ---------------------------------------------------------
// ENDPOINT 2: View the data in your browser (GET)
// ---------------------------------------------------------
// Fix: You can use the same path for GET to view the data



// app.get('/webhook/voters', (req, res) => {
//     console.log("📤 Browser requested to view the data.");
    
//     // Send the entire array of saved data back as JSON
//     res.status(200).json(electionData);
// });










// ---------------------------------------------------------
// START THE SERVER
// ---------------------------------------------------------
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Simple API Server is running on port ${PORT}`);
    console.log(`➡️  To view data locally, open: http://localhost:${PORT}/webhook/voters`);
});