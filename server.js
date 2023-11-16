const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const app = express();
const port = 3000;

// Use CORS
app.use(cors());

// Directory and file path
const dataDir = path.join(__dirname, 'data');
const dataFile = path.join(dataDir, 'generationsData.json');

// Ensure data directory exists
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
    console.log(`Created directory: ${dataDir}`);
}

// Ensure data file exists
if (!fs.existsSync(dataFile)) {
    fs.writeFileSync(dataFile, '{}');
    console.log(`Created file: ${dataFile}`);
}

// Middleware to parse JSON bodies
app.use(express.json());

// Read generations data from file
function readGenerationsData() {
    try {
        return JSON.parse(fs.readFileSync(dataFile, 'utf8'));
    } catch (error) {
        console.error('Error reading data file:', error);
        return {}; // Return empty object in case of error
    }
}

// POST endpoint to save generations data
app.post('/api/save', (req, res) => {
    try {
        const data = req.body;
        const id = data.id; // Assuming each data set has a unique ID

        // Check if ID is provided
        if (!id) {
            return res.status(400).json({ message: 'ID is required' });
        }

        let generationsData = readGenerationsData();
        generationsData[id] = data;

        fs.writeFileSync(dataFile, JSON.stringify(generationsData, null, 2));
        console.log(`Saved data for ID ${id}`);

        res.status(200).json({ message: 'Data saved successfully' });
    } catch (error) {
        console.error('Error saving data:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// GET endpoint to load generations data
app.get('/api/load/:id', (req, res) => {
    const id = req.params.id;

    if (generationsData[id]) {
        console.log(`Loaded data for ID ${id}`);
        res.status(200).json(generationsData[id]);
    } else {
        // No data found for the ID, so initialize new data
        console.log(`No data found for ID ${id}, initializing new data`);

        // Initialize new data (adjust the structure as needed)
        const newData = {
            id: id,
            cells: [], // Example property, adjust according to your needs
            // ... other properties
        };

        // Save the new data
        generationsData[id] = newData;
        fs.writeFileSync(dataFile, JSON.stringify(generationsData, null, 2));

        // Return the new data
        res.status(200).json(newData);
    }
});


// Start the server
app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});