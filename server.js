require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("FATAL ERROR: SUPABASE_URL and SUPABASE_KEY must be set in .env");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Application State (in-memory caching for speed)
let state = {
    dateStr: getTodayDateStr(),
    dailyCounter: 0,
    currentlyServing: null,
    recentServed: [],
    priorityServedCount: 0
};

function getCycleSortedList(waitingList, initialPriorityCount) {
    let priorityQueue = [];
    let regularQueue = [];
    
    const sortedByTime = [...waitingList].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    
    sortedByTime.forEach(r => {
        if (r.is_priority) priorityQueue.push(r);
        else regularQueue.push(r);
    });

    let result = [];
    let currentPriorityCount = initialPriorityCount;
    
    while (priorityQueue.length > 0 || regularQueue.length > 0) {
        if (currentPriorityCount < 2 && priorityQueue.length > 0) {
            result.push(priorityQueue.shift());
            currentPriorityCount++;
        } else if (currentPriorityCount === 2 && regularQueue.length > 0) {
            result.push(regularQueue.shift());
            currentPriorityCount = 0;
        } else if (currentPriorityCount === 2 && regularQueue.length === 0) {
            result.push(priorityQueue.shift());
            currentPriorityCount = 1; 
        } else if (currentPriorityCount < 2 && priorityQueue.length === 0) {
            result.push(regularQueue.shift());
            currentPriorityCount = 0; 
        }
    }
    
    return result;
}

function getTodayDateStr() {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
}

// Initialize server state from Supabase
async function initServer() {
    try {
        const todayStr = getTodayDateStr();
        const { data, error } = await supabase
            .from('registrations')
            .select('ccd_no')
            .like('ccd_no', `CCD-${todayStr}-%`)
            .order('created_at', { ascending: false })
            .limit(1);
        
        if (data && data.length > 0) {
            const lastCcd = data[0].ccd_no; 
            const parts = lastCcd.split('-');
            const num = parseInt(parts[parts.length - 1], 10);
            state.dailyCounter = isNaN(num) ? 0 : num;
        }
        
        const { data: servedData } = await supabase
            .from('registrations')
            .select('*')
            .eq('status', 'Served')
            .order('created_at', { ascending: false })
            .limit(4);
        
        if (servedData) {
            state.recentServed = servedData.map(r => ({
                ccdNo: r.ccd_no,
                isPriority: r.is_priority
            }));
        }
        
        const { data: servingData } = await supabase
            .from('registrations')
            .select('*')
            .eq('status', 'Serving')
            .limit(1);
        
        if (servingData && servingData.length > 0) {
            const r = servingData[0];
            state.currentlyServing = {
                id: r.id,
                ccdNo: r.ccd_no,
                fullName: r.full_name,
                isPriority: r.is_priority,
                status: r.status
            };
        }
        console.log(`Server initialized. Daily Counter: ${state.dailyCounter}`);
    } catch (err) {
        console.error("Failed to initialize server from Supabase:", err);
    }
}
initServer();

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

app.get('/display', (req, res) => res.sendFile(path.join(__dirname, 'public', 'display.html')));
app.get('/staff', (req, res) => res.sendFile(path.join(__dirname, 'public', 'staff.html')));
app.get('/register', (req, res) => res.sendFile(path.join(__dirname, 'public', 'register.html')));
app.get('/records', (req, res) => res.sendFile(path.join(__dirname, 'public', 'records.html')));
app.get('/', (req, res) => res.redirect('/register'));

app.get('/ping', (req, res) => res.status(200).send('pong'));

// Case Management Storage
const casesFile = path.join(__dirname, 'cases.json');

function loadCases() {
    if (fs.existsSync(casesFile)) {
        try {
            return JSON.parse(fs.readFileSync(casesFile, 'utf8'));
        } catch(e) { return {}; }
    }
    return {};
}

function saveCases(data) {
    fs.writeFileSync(casesFile, JSON.stringify(data, null, 2));
}

app.get('/api/cases/:id', (req, res) => {
    const cases = loadCases();
    res.json({ success: true, data: cases[req.params.id] || null });
});

app.post('/api/cases/:id', (req, res) => {
    try {
        const cases = loadCases();
        cases[req.params.id] = req.body;
        saveCases(cases);
        auditLog('Manage Case', `Updated case file for ID ${req.params.id}`);
        res.json({ success: true });
    } catch(err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// API Endpoint for Database Records Interface
app.get('/api/records', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('registrations')
            .select('*')
            .order('created_at', { ascending: false });
            
        if (error) throw error;
        
        const cases = loadCases();
        const recordsWithCases = data.map(record => {
            const caseData = cases[record.id];
            let caseStatus = 'NO ACTION YET';
            if (caseData) {
                if (caseData.tab === 'details') caseStatus = 'CASE FILED';
                else if (caseData.tab === 'remarks') caseStatus = 'REMARKS ADDED';
            }
            return { ...record, case_status: caseStatus };
        });
        
        res.json({ success: true, data: recordsWithCases });
    } catch (err) {
        console.error("Error fetching records:", err);
        res.status(500).json({ success: false, error: "Database fetch failed" });
    }
});

// Advanced API Endpoints for Enhanced Records Page
function auditLog(action, details) {
    const logFile = path.join(__dirname, 'audit_log.json');
    const entry = {
        timestamp: new Date().toISOString(),
        action: action,
        details: details
    };
    let logs = [];
    if (fs.existsSync(logFile)) {
        try {
            logs = JSON.parse(fs.readFileSync(logFile, 'utf8'));
        } catch(e) {}
    }
    logs.unshift(entry);
    if (logs.length > 500) logs.pop();
    fs.writeFileSync(logFile, JSON.stringify(logs, null, 2));
}

app.get('/api/audit', (req, res) => {
    const logFile = path.join(__dirname, 'audit_log.json');
    if (fs.existsSync(logFile)) {
        res.json({ success: true, data: JSON.parse(fs.readFileSync(logFile, 'utf8')) });
    } else {
        res.json({ success: true, data: [] });
    }
});

app.put('/api/records/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;
        const { error } = await supabase.from('registrations').update(updates).eq('id', id);
        if (error) throw error;
        auditLog('Edit Record', `Edited record ID ${id}`);
        res.json({ success: true });
        broadcastStaffUpdate();
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.put('/api/records/:id/status', async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        const { error } = await supabase.from('registrations').update({ status }).eq('id', id);
        if (error) throw error;
        auditLog('Change Status', `Changed status to ${status} for ID ${id}`);
        res.json({ success: true });
        broadcastStaffUpdate();
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.delete('/api/records/today', async (req, res) => {
    try {
        const todayStr = getTodayDateStr();
        const { error } = await supabase.from('registrations').delete().like('ccd_no', `%${todayStr}%`);
        if (error) throw error;
        
        state.currentlyServing = null;
        state.recentServed = [];
        state.priorityServedCount = 0;
        state.dailyCounter = 0;
        
        auditLog('Clear Today', `Cleared all records for ${todayStr}`);
        res.json({ success: true });
        
        await broadcastStaffUpdate();
        broadcastDisplayUpdate(false);
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.delete('/api/records/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { error } = await supabase.from('registrations').delete().eq('id', id);
        if (error) throw error;
        auditLog('Delete Record', `Deleted record ID ${id}`);
        res.json({ success: true });
        broadcastStaffUpdate();
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

async function broadcastStaffUpdate() {
    const { data: allRegistrations } = await supabase
        .from('registrations')
        .select('status, is_priority, id, ccd_no, full_name, created_at');
        
    const waitingList = (allRegistrations || []).filter(r => r.status === 'Waiting');
    const stats = {
        total: allRegistrations ? allRegistrations.length : 0,
        waiting: waitingList.length,
        served: (allRegistrations || []).filter(r => r.status === 'Served').length,
        skipped: (allRegistrations || []).filter(r => r.status === 'Skipped').length
    };

    const sortedList = getCycleSortedList(waitingList, state.priorityServedCount);
        
    const formattedList = sortedList.map(r => ({
        id: r.id,
        ccdNo: r.ccd_no,
        fullName: r.full_name,
        isPriority: r.is_priority
    }));

    let cycleLabel = "Next: Regular";
    if (waitingList.length === 0) {
        cycleLabel = "Queue Empty";
    } else {
        const nextPerson = sortedList[0];
        if (nextPerson.is_priority) {
            let slot = state.priorityServedCount === 2 ? 1 : state.priorityServedCount + 1;
            cycleLabel = `Next: Priority (${slot}/2)`;
        } else {
            cycleLabel = `Next: Regular`;
        }
    }

    io.emit('staff_update', {
        currentlyServing: state.currentlyServing,
        waitingList: formattedList,
        recentServed: state.recentServed,
        stats: stats,
        cycleLabel: cycleLabel
    });
}

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

io.on('connection', async (socket) => {
    console.log('A user connected:', socket.id);

    // Initial load for connecting client
    await broadcastStaffUpdate();
    broadcastDisplayUpdate(false);

    // Handle New Registration
    socket.on('submit_registration', async (formData, callback) => {
        const todayStr = getTodayDateStr();
        if (state.dateStr !== todayStr) {
            state.dateStr = todayStr;
            state.dailyCounter = 0;
        }

        state.dailyCounter++;
        const ccdNo = `CCD-${todayStr}-${String(state.dailyCounter).padStart(4, '0')}`;
        const isPriority = formData.isPriority === true || formData.isPriority === 'true';
        
        const { data, error } = await supabase
            .from('registrations')
            .insert([
                {
                    ccd_no: ccdNo,
                    full_name: formData.fullName,
                    contact: formData.contact,
                    age: parseInt(formData.age, 10),
                    email: formData.email || null,
                    civil_status: formData.civilStatus,
                    gender: formData.gender,
                    address: formData.address || 'N/A',
                    purpose: formData.purpose || 'File a Complaint',
                    referred_by: formData.referredBy || null,
                    is_priority: isPriority,
                    status: 'Waiting'
                }
            ])
            .select();

        const { data: waitingList } = await supabase
            .from('registrations')
            .select('*')
            .eq('status', 'Waiting');
            
        const sortedList = getCycleSortedList(waitingList || [], state.priorityServedCount);
        
        let position = sortedList.findIndex(r => r.id === data[0].id);
        if (position === -1) position = sortedList.length - 1;

        if (callback) {
            if (error) {
                console.error("Insert Error:", error);
                callback({ success: false });
            } else {
                callback({ success: true, ccdNo: ccdNo, position: position, isPriority: isPriority });
            }
        }
        await broadcastStaffUpdate();
    });

    // Handle "Next" logic with strict absolute priority algorithm
    socket.on('next', async () => {
        if (state.currentlyServing) {
            await supabase
                .from('registrations')
                .update({ status: 'Served' })
                .eq('id', state.currentlyServing.id);
                
            state.recentServed.unshift({
                ccdNo: state.currentlyServing.ccdNo,
                isPriority: state.currentlyServing.isPriority
            });
            if (state.recentServed.length > 4) state.recentServed.pop();
        }

        const { data: waiting } = await supabase
            .from('registrations')
            .select('*')
            .eq('status', 'Waiting');

        if (!waiting || waiting.length === 0) {
            state.currentlyServing = null;
            await broadcastStaffUpdate();
            broadcastDisplayUpdate(false);
            return;
        }

        const sortedWaiting = getCycleSortedList(waiting, state.priorityServedCount);
        const nextPerson = sortedWaiting[0];

        if (nextPerson.is_priority) {
            if (state.priorityServedCount === 2) {
                state.priorityServedCount = 1;
            } else {
                state.priorityServedCount++;
            }
        } else {
            state.priorityServedCount = 0;
        }

        await supabase
            .from('registrations')
            .update({ status: 'Serving' })
            .eq('id', nextPerson.id);
            
        state.currentlyServing = {
            id: nextPerson.id,
            ccdNo: nextPerson.ccd_no,
            fullName: nextPerson.full_name,
            isPriority: nextPerson.is_priority,
            status: 'Serving'
        };
        
        await broadcastStaffUpdate();
        broadcastDisplayUpdate(true);
    });

    socket.on('skip', async () => {
        if (state.currentlyServing) {
            const skippedCcd = state.currentlyServing.ccdNo;
            await supabase
                .from('registrations')
                .update({ status: 'Skipped' })
                .eq('id', state.currentlyServing.id);
                
            state.currentlyServing = null;
            
            const { data: waiting } = await supabase
                .from('registrations')
                .select('*')
                .eq('status', 'Waiting');

            if (!waiting || waiting.length === 0) {
                await broadcastStaffUpdate();
                broadcastDisplayUpdate(false, `${skippedCcd} Skipped — Queue Empty`);
                return;
            }

            const sortedWaiting = getCycleSortedList(waiting, state.priorityServedCount);
            const nextPerson = sortedWaiting[0];

            if (nextPerson.is_priority) {
                if (state.priorityServedCount === 2) {
                    state.priorityServedCount = 1;
                } else {
                    state.priorityServedCount++;
                }
            } else {
                state.priorityServedCount = 0;
            }

            await supabase
                .from('registrations')
                .update({ status: 'Serving' })
                .eq('id', nextPerson.id);
                
            state.currentlyServing = {
                id: nextPerson.id,
                ccdNo: nextPerson.ccd_no,
                fullName: nextPerson.full_name,
                isPriority: nextPerson.is_priority,
                status: 'Serving'
            };
            
            await broadcastStaffUpdate();
            broadcastDisplayUpdate(false, `${skippedCcd} Skipped — Now Serving ${state.currentlyServing.ccdNo}`);
        }
    });

    socket.on('serve_specific', async (id) => {
        if (state.currentlyServing) {
            await supabase
                .from('registrations')
                .update({ status: 'Served' })
                .eq('id', state.currentlyServing.id);
                
            state.recentServed.unshift({
                ccdNo: state.currentlyServing.ccdNo,
                isPriority: state.currentlyServing.isPriority
            });
            if (state.recentServed.length > 4) state.recentServed.pop();
        }

        const { data } = await supabase
            .from('registrations')
            .select('*')
            .eq('id', id)
            .single();

        if (data) {
            await supabase
                .from('registrations')
                .update({ status: 'Serving' })
                .eq('id', data.id);
                
            state.currentlyServing = {
                id: data.id,
                ccdNo: data.ccd_no,
                fullName: data.full_name,
                isPriority: data.is_priority,
                status: 'Serving'
            };
            
            await broadcastStaffUpdate();
            broadcastDisplayUpdate(true);
        }
    });

    socket.on('recall', () => {
        if (state.currentlyServing) {
            broadcastDisplayUpdate(true);
        }
    });

    socket.on('reset', async () => {
        await supabase
            .from('registrations')
            .update({ status: 'Skipped' })
            .in('status', ['Waiting', 'Serving']);
            
        state.currentlyServing = null;
        state.recentServed = [];
        state.priorityServedCount = 0;
        state.dailyCounter = 0;
        
        await broadcastStaffUpdate();
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
