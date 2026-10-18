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
app.post('https://ai.vedanthimte.in/webhook/voters', (req, res) => {
    const incomingData = req.body;
// app.post('/api/store-vote', (req, res) => {
//     const incomingData = req.body;
    
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
app.get('/api/votes', (req, res) => {
    console.log("📤 Browser requested to view the data.");
    
    // Send the entire array of saved data back as JSON
    res.status(200).json(electionData);
});

// ---------------------------------------------------------
// START THE SERVER
// '0.0.0.0' is crucial - it allows external devices (ESP32) to connect
// ---------------------------------------------------------
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Simple API Server is running on port ${PORT}`);
    // console.log(`➡️  To view data, open a web browser and go to: http://localhost:${PORT}/api/votes`);
    console.log(`➡️  To view data, open a web browser and go to: https://ai.vedanthimte.in/webhook/voters`);
});