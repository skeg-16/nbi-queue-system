const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const DATA_FILE = path.join(__dirname, 'data.json');

// Queue State
let currentQueueNumber = 0; // 0 means waiting to start
let recentNumbers = []; // Store the last 4 numbers served

// Load state from file if it exists
function loadState() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            const data = fs.readFileSync(DATA_FILE, 'utf8');
            const state = JSON.parse(data);
            currentQueueNumber = state.currentQueueNumber || 0;
            recentNumbers = state.recentNumbers || [];
            console.log('Loaded state from data.json:', state);
        }
    } catch (err) {
        console.error('Error loading state:', err);
    }
}

// Save state to file
function saveState() {
    try {
        const state = { currentQueueNumber, recentNumbers };
        fs.writeFileSync(DATA_FILE, JSON.stringify(state, null, 2));
    } catch (err) {
        console.error('Error saving state:', err);
    }
}

// Initialize state on startup
loadState();

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

app.get('/display', (req, res) => res.sendFile(path.join(__dirname, 'public', 'display.html')));
app.get('/staff', (req, res) => res.sendFile(path.join(__dirname, 'public', 'staff.html')));
app.get('/', (req, res) => res.redirect('/display'));

// Keep-alive endpoint to prevent Render from sleeping
app.get('/ping', (req, res) => res.status(200).send('pong'));

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // Send current state to newly connected client
    socket.emit('init', { number: currentQueueNumber, recentNumbers });

    socket.on('next', () => {
        if (currentQueueNumber > 0) {
            recentNumbers.unshift(currentQueueNumber);
            if (recentNumbers.length > 4) recentNumbers.pop();
        }
        currentQueueNumber++;
        saveState();
        
        io.emit('next', { number: currentQueueNumber, recentNumbers });
        console.log(`Queue advanced to: ${currentQueueNumber}`);
    });

    socket.on('skip', () => {
        const skippedNumber = currentQueueNumber > 0 ? currentQueueNumber : 1;
        // Do not add skipped number to recent numbers
        currentQueueNumber = skippedNumber + 1;
        saveState();
        
        io.emit('skip', { skippedNumber: skippedNumber, newNumber: currentQueueNumber, recentNumbers });
        console.log(`Queue skipped ${skippedNumber}, advanced to: ${currentQueueNumber}`);
    });

    socket.on('recall', () => {
        if (currentQueueNumber > 0) {
            io.emit('recall', { number: currentQueueNumber });
            console.log(`Recalled number: ${currentQueueNumber}`);
        }
    });

    socket.on('reset', () => {
        currentQueueNumber = 0;
        recentNumbers = [];
        saveState();
        
        io.emit('reset', { number: currentQueueNumber, recentNumbers });
        console.log('Queue reset to 0');
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    console.log(`Display: http://localhost:${PORT}/display`);
    console.log(`Staff Controller: http://localhost:${PORT}/staff`);
});
