function generateRule30CenterColumn(steps) {
    let currentGeneration = [1];
    let centerColumn = [1];

    for (let i = 0; i < steps; i++) {
        let newGeneration = [];
        let len = currentGeneration.length;

        // Generate the new generation
        for (let j = 0; j < len + 2; j++) {
            let left = currentGeneration[j - 1] || 0;
            let center = currentGeneration[j] || 0;
            let right = currentGeneration[j + 1] || 0;
            newGeneration.push(rule30(left, center, right));
        }

        // Update the center column
        centerColumn.push(newGeneration[Math.floor(newGeneration.length / 2)]);
        currentGeneration = newGeneration;
    }

    return centerColumn;
}

function rule30(left, center, right) {
    return (left ^ (center || right)) & 1;
}

const steps = 100; // Number of steps to generate
const centerColumn = generateRule30CenterColumn(steps);
console.log(centerColumn);
