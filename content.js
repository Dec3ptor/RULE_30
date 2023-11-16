// npx tailwindcss -i ./input.css -o ./output.css --watch
// node server.js
const generations = 50;  // Number of generations to simulate
const cellSize = 5;  // Size of each cell in pixels
const size = 2 * generations + 1;  // Size of the grid based on generations

const canvas = document.getElementById('rule30Canvas');
const ctx = canvas.getContext('2d');
var flip = false;
canvas.width = size * cellSize;
canvas.height = generations * cellSize;

let cells = Array(size).fill(0);
cells[Math.floor(size / 2)] = 1;

async function saveGenerations(generationsData) {
    try {
        console.log("Saving generations data:", generationsData);
        const response = await fetch('http://localhost:3000/api/save', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(generationsData),
        });

        if (response.ok) {
            console.log("Generations data saved successfully.");
        } else {
            console.error("Failed to save generations data. Response status:", response.status);
        }
    } catch (error) {
        console.error("Error saving generations data:", error);
    }
}

async function loadGenerations(identifier, genCount) {
    try {
        const url = `http://localhost:3000/api/load/${identifier}?genCount=${genCount}`;
        const response = await fetch(url);

        if (response.ok) {
            const generationsData = await response.json();
            console.log("Generations data loaded successfully for:", identifier);
            return generationsData;
        } else {
            console.error("Failed to load generations data for:", identifier, "Response status:", response.status);
            return null;
        }
    } catch (error) {
        console.error("Error loading generations data for:", identifier, error);
        return null;
    }
}





for (let gen = 0; gen < generations - 1; gen++) {
    drawGeneration(cells, gen, cellSize);  // Pass cellSize as an argument
    cells = generateNext(cells, 30);  // Pass a default rule number, e.g., 30 for Rule 30
}

// Modify the drawGeneration and generateNext functions to use custom cell size
function drawGeneration(cells, gen, cellSize, canvasWidth, flip=false) {
        // Center the cells on the canvas
        let offset = Math.floor((canvasWidth - cells.length * cellSize) / 2);

    if (flip === true) { // Use triple equals for strict comparison
        cells = cells.slice().reverse(); // Reverse the cells array for flipping
    }
    cells.forEach((cell, index) => {
        ctx.fillStyle = cell === 1 ? 'black' : 'white';
        ctx.fillRect(offset + index * cellSize, gen * cellSize, cellSize, cellSize);
    });
}


function generateNext(cells, binaryRule) {
    let newCells = new Array(cells.length).fill(0);
    for (let i = 1; i < cells.length - 1; i++) {
        newCells[i] = applyRule(binaryRule, cells[i - 1], cells[i], cells[i + 1]);
    }
    return newCells;
}


function applyRule(binaryRule, left, center, right) {
    if (left !== undefined && center !== undefined && right !== undefined && binaryRule.length === 8) {
        const ruleIndex = parseInt([left, center, right].join(''), 2);
        return parseInt(binaryRule[7 - ruleIndex], 10);
    } else {
        return 0; // Default value for invalid inputs
    }
}

function rule30(left, center, right) {
    return left ^ (center || right);
}

document.getElementById('exportBtn').addEventListener('click', function() {
    const canvas = document.getElementById('rule30Canvas');
    const image = canvas.toDataURL("image/png").replace("image/png", "image/octet-stream");
    let link = document.createElement('a');
    link.download = 'rule30.png';
    link.href = image;
    link.click();
});
// document.getElementById('frequencyAnalysisBtn').addEventListener('click', function() {
//     let result = frequencyAnalysis(cells);
//     alert("On cells: " + result.onCount + "\nOff cells: " + result.offCount);
// });

// function frequencyAnalysis(cells) {
//     let onCount = cells.reduce((count, cell) => count + cell, 0);
//     let offCount = cells.length - onCount;
//     return { onCount, offCount };
// }

function getBinaryRule(ruleInput) {
    if (/^[01]{8}$/.test(ruleInput)) { // If input is an 8-bit binary
        return ruleInput;
    } else if (/^\d+$/.test(ruleInput)) { // If input is a number
        let ruleNumber = parseInt(ruleInput, 10);
        if (ruleNumber >= 0 && ruleNumber <= 255) {
            return ruleNumber.toString(2).padStart(8, '0');
        }
    }
    //alert("Invalid input. Please enter a binary string or a number between 0 and 255.");
    return null;
}
document.getElementById('ruleInput').addEventListener('change', function() {
    applySelectedRule();
});
document.getElementById('customGenerations').addEventListener('change', function() {
    applySelectedRule();
});
document.getElementById('customCellSize').addEventListener('change', function() {
    applySelectedRule();
});

async function applySelectedRule() {
    const ruleInput = document.getElementById('ruleInput').value;
    const binaryRule = getBinaryRule(ruleInput);

    if (binaryRule) {
        const ruleNumber = parseInt(binaryRule, 2);
        console.log("Applying rule:", binaryRule);

        // Fetch DOM elements and parse input values
        const customGenerationsInput = document.getElementById('customGenerations');
        const customCellSizeInput = document.getElementById('customCellSize');
        const ruleDescriptionElement = document.getElementById('ruleDescription');
        const customGenerations = parseInt(customGenerationsInput.value, 10);
        const customCellSize = parseInt(customCellSizeInput.value, 10);
        const size = 2 * customGenerations + 5;

        // Setup canvas
        canvas.width = size * customCellSize;
        canvas.height = (customGenerations + 1) * customCellSize;

        // Construct the identifier for loading
        let loadIdentifier = `${ruleNumber}`;

        // Attempt to load saved generations
        // let savedData = await loadGenerations(loadIdentifier, customGenerations);

        let generations = []; // Array to store all generations
        // let shouldSave = false; // Flag to determine if we need to save after generation

        // if (savedData && savedData.rule === binaryRule) {
        //     generations = savedData.generations; // Use saved generations
        //     console.log("Using saved rule from server: " + ruleNumber);
        // } else {
            let cells = new Array(size).fill(0);
            cells[Math.floor(size / 2)] = 1;
            generations.push(cells); // Add the initial generation

            for (let gen = 1; gen <= customGenerations; gen++) {
                cells = generateNext(cells, binaryRule);
                generations.push(cells); // Accumulate each generation
            }
            // shouldSave = true; // New data generated, so save is needed
        // }

        // Draw all generations
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        generations.forEach((genCells, gen) => {
            drawGeneration(genCells, gen, customCellSize, canvas.width);
        });

        // if (shouldSave) {
        //     // Determine the generation count for naming the file appropriately
        //     const genCount = generations.length;
        
        //     // Prepare data to be saved
        //     const dataToSave = {
        //         id: ruleNumber,
        //         rule: binaryRule,
        //         generations: generations,
        //         genCount: genCount // Include the generation count
        //     };
        
        //     // Save the generations data
        //     await saveGenerations(dataToSave);
        //     console.log("Saved Rule to server: " + ruleNumber);
        // }
        

        ruleDescriptionElement.innerText = getRuleDescription(ruleNumber);
        console.log("Applied Rule " + ruleNumber);
    } else {
        console.error("Invalid rule input:", ruleInput);
        alert("Invalid input. Please enter a valid rule number or binary.");
    }
}


function getRuleDescription(ruleNumber) {
    const descriptions = {
        30: "Rule 30: Famous for its chaotic, complex behavior and triangle patterns.",
        54: "Rule 54: Known for producing a mixture of order and randomness, with some periodic structures.",
        90: "Rule 90: Generates a Sierpinski triangle, known for its fractal properties.",
        110: "Rule 110: Known for its Turing completeness and complex structures, capable of universal computation.",
        184: "Rule 184: This rule models traffic flow and has been studied in the context of particle physics.",
        // Add more descriptions for other rules as needed
    };
    return descriptions[ruleNumber] || "No description available for this rule.";
}


document.getElementById('applyRuleBtn').addEventListener('click', function() {
    applySelectedRule() 
});

document.getElementById('compareRulesBtn').addEventListener('click', function() {
    let rule1Binary = getBinaryRule(document.getElementById('ruleInput1').value);
    let rule2Binary = getBinaryRule(document.getElementById('ruleInput2').value);

    if (!rule1Binary || !rule2Binary) {
        alert("Please enter valid rule numbers or binary strings in both inputs.");
        return;
    }

    // Now, perform the comparison
    drawAndCompareRules(rule1Binary, rule2Binary);
});

function drawAndCompareRules(rule1Binary, rule2Binary) {
    const flip = parseInt(document.getElementById('flipRule').value, 10);

    // Draw and compare the rules
    drawRule(rule1Binary, flip === 1);
    let imageData1 = ctx.getImageData(0, 0, canvas.width, canvas.height);

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    drawRule(rule2Binary, flip === 2);
    let imageData2 = ctx.getImageData(0, 0, canvas.width, canvas.height);

    // Compare and highlight differences
    for (let i = 0; i < imageData1.data.length; i += 4) {
        if (imageData1.data[i] !== imageData2.data[i] || 
            imageData1.data[i + 1] !== imageData2.data[i + 1] || 
            imageData1.data[i + 2] !== imageData2.data[i + 2]) {
            // Pixels are different, highlight in red
            imageData1.data[i] = 255;     // red
            imageData1.data[i + 1] = 0;   // green
            imageData1.data[i + 2] = 0;   // blue
        } else {
            // Pixels are the same, highlight in green
            imageData1.data[i] = 0;       // red
            imageData1.data[i + 1] = 255; // green
            imageData1.data[i + 2] = 0;   // blue
        }
    }

    // Update the canvas with the highlighted image
    ctx.putImageData(imageData1, 0, 0);


}

function drawRule(binaryRule, flip) {
    // Reset or initialize the canvas and cells
        const customGenerations = parseInt(document.getElementById('customGenerations').value, 10);
        const customCellSize = parseInt(document.getElementById('customCellSize').value, 10);
        const size = 2 * customGenerations + 5;

        canvas.width = size * customCellSize;
        canvas.height = (customGenerations + 1) * customCellSize;

        let cells = Array(size).fill(0);
        cells[Math.floor(size / 2)] = 1;

        // Clear the canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Generate and draw the pattern based on the new rule
        for (let gen = 0; gen < generations + 1; gen++) {
            drawGeneration(cells, gen, customCellSize, flip);  // Pass the flip argument
            cells = generateNext(cells, binaryRule);
        }
    }

