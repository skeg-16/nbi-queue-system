const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const DATA_FILE = path.join(__dirname, 'data.json');

// Application State
let state = {
    dateStr: getTodayDateStr(),
    dailyCounter: 0,
    registrations: [],
    currentlyServing: null,
    recentServed: [],
    regularConsecutiveCount: 0
};

function getTodayDateStr() {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
}

// Load state from file if it exists
function loadState() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            const data = fs.readFileSync(DATA_FILE, 'utf8');
            const savedState = JSON.parse(data);
            
            // Check if day changed to reset counter
            const todayStr = getTodayDateStr();
            if (savedState.dateStr !== todayStr) {
                state.dateStr = todayStr;
                state.dailyCounter = 0;
                // Keep history or clear? Let's keep today's only for queue, or just keep all but we only queue "Waiting" ones
            } else {
                state.dateStr = savedState.dateStr;
                state.dailyCounter = savedState.dailyCounter || 0;
            }
            
            state.registrations = savedState.registrations || [];
            state.currentlyServing = savedState.currentlyServing || null;
            state.recentServed = savedState.recentServed || [];
            state.regularConsecutiveCount = savedState.regularConsecutiveCount || 0;
            
            console.log('Loaded state from data.json');
        }
    } catch (err) {
        console.error('Error loading state:', err);
    }
}

// Save state to file
function saveState() {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(state, null, 2));
    } catch (err) {
        console.error('Error saving state:', err);
    }
}

// Initialize state on startup
loadState();

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json()); // to parse JSON bodies if needed

app.get('/display', (req, res) => res.sendFile(path.join(__dirname, 'public', 'display.html')));
app.get('/staff', (req, res) => res.sendFile(path.join(__dirname, 'public', 'staff.html')));
app.get('/register', (req, res) => res.sendFile(path.join(__dirname, 'public', 'register.html')));
app.get('/', (req, res) => res.redirect('/register')); // Default to register for users

// Keep-alive endpoint to prevent Render from sleeping
app.get('/ping', (req, res) => res.status(200).send('pong'));

// Helper to broadcast full state to staff
function broadcastStaffUpdate() {
    const waitingList = state.registrations.filter(r => r.status === 'Waiting');
    io.emit('staff_update', {
        currentlyServing: state.currentlyServing,
        waitingList: waitingList,
        recentServed: state.recentServed,
        regularConsecutiveCount: state.regularConsecutiveCount
    });
}

// Helper to broadcast display update
function broadcastDisplayUpdate(triggerChime = false, skipMessage = null) {
    const data = {
        currentlyServing: state.currentlyServing ? state.currentlyServing.ccdNo : '---',
        isPriority: state.currentlyServing ? state.currentlyServing.isPriority : false,
        recentNumbers: state.recentServed.map(r => r.ccdNo),
        triggerChime: triggerChime,
        skipMessage: skipMessage
    };
    io.emit('display_update', data);
}

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // Initial load for clients
    socket.emit('staff_update', {
        currentlyServing: state.currentlyServing,
        waitingList: state.registrations.filter(r => r.status === 'Waiting'),
        recentServed: state.recentServed,
        regularConsecutiveCount: state.regularConsecutiveCount
    });
    
    socket.emit('display_update', {
        currentlyServing: state.currentlyServing ? state.currentlyServing.ccdNo : '---',
        isPriority: state.currentlyServing ? state.currentlyServing.isPriority : false,
        recentNumbers: state.recentServed.map(r => r.ccdNo),
        triggerChime: false,
        skipMessage: null
    });

    // Handle New Registration
    socket.on('submit_registration', (formData, callback) => {
        // Double check date
        const todayStr = getTodayDateStr();
        if (state.dateStr !== todayStr) {
            state.dateStr = todayStr;
            state.dailyCounter = 0;
        }

        state.dailyCounter++;
        const ccdNo = `CCD-${todayStr}-${String(state.dailyCounter).padStart(4, '0')}`;
        
        const newReg = {
            ccdNo: ccdNo,
            fullName: formData.fullName,
            contact: formData.contact,
            age: formData.age,
            email: formData.email,
            civilStatus: formData.civilStatus,
            gender: formData.gender,
            isPriority: formData.isPriority === true || formData.isPriority === 'true',
            status: 'Waiting',
            timestamp: Date.now()
        };

        state.registrations.push(newReg);
        saveState();

        // Calculate queue position
        const waitingList = state.registrations.filter(r => r.status === 'Waiting');
        const position = waitingList.length;

        // Callback to the registering client
        if (callback) {
            callback({ success: true, ccdNo: ccdNo, position: position });
        }

        // Broadcast to staff dashboard
        broadcastStaffUpdate();
    });

    // Handle "Next" logic with 2:1 algorithm
    socket.on('next', () => {
        if (state.currentlyServing) {
            // Mark previous as served
            state.currentlyServing.status = 'Served';
            state.recentServed.unshift({
                ccdNo: state.currentlyServing.ccdNo,
                isPriority: state.currentlyServing.isPriority
            });
            if (state.recentServed.length > 4) state.recentServed.pop();
        }

        const waiting = state.registrations.filter(r => r.status === 'Waiting');
        if (waiting.length === 0) {
            state.currentlyServing = null;
            saveState();
            broadcastStaffUpdate();
            broadcastDisplayUpdate(false);
            return;
        }

        const regularsWaiting = waiting.filter(r => !r.isPriority);
        const prioritiesWaiting = waiting.filter(r => r.isPriority);

        let nextPerson = null;

        // The 2:1 Rule Logic
        if (state.regularConsecutiveCount >= 2 && prioritiesWaiting.length > 0) {
            // Time for a priority
            nextPerson = prioritiesWaiting[0];
            state.regularConsecutiveCount = 0;
        } else if (regularsWaiting.length > 0) {
            // Normal flow, pull regular
            nextPerson = regularsWaiting[0];
            state.regularConsecutiveCount++;
        } else if (prioritiesWaiting.length > 0) {
            // No regulars waiting, but priorities exist
            nextPerson = prioritiesWaiting[0];
            state.regularConsecutiveCount = 0;
        }

        if (nextPerson) {
            nextPerson.status = 'Serving';
            state.currentlyServing = nextPerson;
            console.log(`Now serving: ${nextPerson.ccdNo}`);
        } else {
            state.currentlyServing = null;
        }

        saveState();
        broadcastStaffUpdate();
        broadcastDisplayUpdate(true); // true to play chime
    });

    socket.on('skip', () => {
        if (state.currentlyServing) {
            const skippedCcd = state.currentlyServing.ccdNo;
            state.currentlyServing.status = 'Skipped';
            state.currentlyServing = null;
            
            // Immediately pull next
            const waiting = state.registrations.filter(r => r.status === 'Waiting');
            if (waiting.length === 0) {
                saveState();
                broadcastStaffUpdate();
                broadcastDisplayUpdate(false, `${skippedCcd} Skipped — Queue Empty`);
                return;
            }

            const regularsWaiting = waiting.filter(r => !r.isPriority);
            const prioritiesWaiting = waiting.filter(r => r.isPriority);

            let nextPerson = null;

            // Apply same 2:1 rule for skip
            if (state.regularConsecutiveCount >= 2 && prioritiesWaiting.length > 0) {
                nextPerson = prioritiesWaiting[0];
                state.regularConsecutiveCount = 0;
            } else if (regularsWaiting.length > 0) {
                nextPerson = regularsWaiting[0];
                state.regularConsecutiveCount++;
            } else if (prioritiesWaiting.length > 0) {
                nextPerson = prioritiesWaiting[0];
                state.regularConsecutiveCount = 0;
            }

            if (nextPerson) {
                nextPerson.status = 'Serving';
                state.currentlyServing = nextPerson;
                console.log(`Skipped to: ${nextPerson.ccdNo}`);
            }
            
            saveState();
            broadcastStaffUpdate();
            broadcastDisplayUpdate(false, `${skippedCcd} Skipped — Now Serving ${state.currentlyServing ? state.currentlyServing.ccdNo : ''}`);
        }
    });

    socket.on('recall', () => {
        if (state.currentlyServing) {
            broadcastDisplayUpdate(true); // trigger chime again
        }
    });

    socket.on('reset', () => {
        // Mark all as skipped or just clear? We should keep data for reporting, just clear active queue?
        // Let's clear the queue for simplicity in this prototype.
        state.registrations = [];
        state.currentlyServing = null;
        state.recentServed = [];
        state.regularConsecutiveCount = 0;
        state.dailyCounter = 0;
        saveState();
        
        broadcastStaffUpdate();
        broadcastDisplayUpdate(false);
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
