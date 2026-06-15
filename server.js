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
    priorityServedCount: 0,
    voiceSettings: {
        lang: 'en',
        rate: 0.85,
        voiceURI: ''
    },
    availableVoices: []
};

// Agent Remarks Storage
const agentRemarksFile = path.join(__dirname, 'agent_remarks.json');
function loadAgentRemarks() {
    if (fs.existsSync(agentRemarksFile)) {
        try { return JSON.parse(fs.readFileSync(agentRemarksFile, 'utf8')); } catch (e) { return {}; }
    }
    return {};
}
function saveAgentRemarks(remarksObj) {
    fs.writeFileSync(agentRemarksFile, JSON.stringify(remarksObj, null, 2));
}

function getSortedList(waitingList) {
    let priorityQueue = [];
    let regularQueue = [];

    const sortedByTime = [...waitingList].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

    sortedByTime.forEach(r => {
        if (r.is_priority) priorityQueue.push(r);
        else regularQueue.push(r);
    });

    return [...priorityQueue, ...regularQueue];
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
app.get('/feedback/en', (req, res) => res.sendFile(path.join(__dirname, 'public', 'feedback.html')));
app.get('/feedback/tl', (req, res) => res.sendFile(path.join(__dirname, 'public', 'feedback-tl.html')));
app.get('/', (req, res) => res.redirect('/register'));

// API Endpoint for Feedback Submission
app.post('/api/feedback', async (req, res) => {
    try {
        const payload = req.body;
        // payload should contain: language, rating, service_quality, staff_behavior, wait_time, recommendation, suggestions, complaints, follow_up, contact_for_followup
        const { data, error } = await supabase
            .from('feedback')
            .insert([payload]);

        if (error) {
            console.error("Supabase Feedback Insert Error:", error);
            throw error;
        }

        res.json({ success: true });
    } catch (err) {
        console.error("Error submitting feedback:", err);
        res.status(500).json({ success: false, error: "Failed to save feedback" });
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

        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        res.json({ success: true, data: data });
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
        } catch (e) { }
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

// === Agent Remarks API ===

app.get('/api/records/:id/remarks', (req, res) => {
    try {
        const remarks = loadAgentRemarks();
        const recordRemarks = remarks[req.params.id] || { text: '', last_modified: null };
        res.json({ success: true, data: recordRemarks });
    } catch (err) {
        res.status(500).json({ success: false, error: "Failed to load remarks" });
    }
});

app.post('/api/records/:id/remarks', (req, res) => {
    try {
        const id = req.params.id;
        const { text } = req.body;
        let remarks = loadAgentRemarks();
        remarks[id] = { text: text || '', last_modified: new Date().toISOString() };
        saveAgentRemarks(remarks);
        auditLog('Agent Remarks', `Updated remarks for ID ${id}`);
        res.json({ success: true, data: remarks[id] });
    } catch (err) {
        res.status(500).json({ success: false, error: "Failed to save remarks" });
    }
});

app.delete('/api/records/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { data, error, count } = await supabase.from('registrations').delete({ count: 'exact' }).eq('id', id);
        
        if (error) {
            console.error("Supabase DELETE Error Details:", JSON.stringify(error, null, 2));
            throw error;
        }
        
        // Supabase succeeds without error if it deletes 0 rows (e.g. if RLS blocks it or ID missing)
        if (count === 0) {
            console.error("Supabase DELETE warning: 0 rows deleted. RLS may be blocking this, or ID is invalid. ID:", id);
            return res.status(403).json({ success: false, error: "Row not deleted. Permission denied by Supabase RLS, or row does not exist." });
        }

        auditLog('Delete Record', `Deleted record ID ${id}`);
        res.json({ success: true });
        broadcastStaffUpdate();
    } catch (err) {
        console.error("Server exception in DELETE /api/records/:id:", err);
        res.status(500).json({ success: false, error: err.message || "Unknown server error" });
    }
});

app.put('/api/records/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;
        // MUST append .select() to get the row back to check ccd_no for the display!
        const { data, error, count } = await supabase.from('registrations').update(updates, { count: 'exact' }).eq('id', id).select();
        
        if (error) {
            console.error("Supabase PUT Error Details:", JSON.stringify(error, null, 2));
            throw error;
        }

        if (count === 0) {
            console.warn("Supabase PUT warning: 0 rows updated. Possible RLS block or invalid ID:", id);
            return res.status(403).json({ success: false, error: "Row not updated. Permission denied by Supabase RLS, or row does not exist." });
        }

        // Feature: Trigger TV Display when spreadsheet user manually forces a status update
        if (updates.status === 'Serving' && data && data.length > 0) {
            const person = data[0];
            state.currentlyServing = {
                id: person.id,
                ccdNo: person.ccd_no,
                fullName: person.full_name,
                isPriority: person.is_priority,
                status: 'Serving'
            };
            broadcastDisplayUpdate(true);
        } else if (updates.status === 'Skipped' && state.currentlyServing && state.currentlyServing.id === id && data && data.length > 0) {
            state.currentlyServing = null;
            broadcastDisplayUpdate(false, `${data[0].ccd_no} Skipped`);
        }

        auditLog('Edit Record', `Edited record ID ${id}`);
        res.json({ success: true });
        broadcastStaffUpdate();
    } catch (err) {
        console.error("Server exception in PUT /api/records/:id:", err);
        res.status(500).json({ success: false, error: err.message || "Unknown server error" });
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

app.post('/api/import', async (req, res) => {
    try {
        const records = req.body.records;
        if (!records || !Array.isArray(records)) {
            return res.status(400).json({ success: false, error: "Invalid data format" });
        }

        const { data, error } = await supabase
            .from('registrations')
            .insert(records);
            
        if (error) throw error;
        
        auditLog('Bulk Import', `Imported ${records.length} records`);
        broadcastStaffUpdate();
        res.json({ success: true, count: records.length });
    } catch (err) {
        console.error("Import Error:", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Deployment Verification Endpoint
app.get('/api/ping', (req, res) => {
    res.json({ 
        message: "Server is running!", 
        status: "ok",
        last_updated: new Date().toISOString()
    });
});


async function broadcastStaffUpdate() {
    const todayStr = getTodayDateStr();
    const { data: allRegistrations } = await supabase
        .from('registrations')
        .select('status, is_priority, id, ccd_no, full_name, created_at')
        .like('ccd_no', `CCD-${todayStr}-%`);

    const waitingList = (allRegistrations || []).filter(r => r.status === 'Waiting');
    const stats = {
        total: allRegistrations ? allRegistrations.length : 0,
        waiting: waitingList.length,
        served: (allRegistrations || []).filter(r => r.status === 'Served').length,
        skipped: (allRegistrations || []).filter(r => r.status === 'Skipped').length
    };

    const sortedList = getSortedList(waitingList);

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
        currentlyServingName: state.currentlyServing ? state.currentlyServing.fullName : '',
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
    
    // Sync voice state
    socket.emit('voice_settings_update', state.voiceSettings);
    socket.emit('available_voices_update', state.availableVoices);

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

        const sortedList = getSortedList(waitingList || []);

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
        try {
            if (state.currentlyServing) {
                const { error: updateErr } = await supabase
                    .from('registrations')
                    .update({ status: 'Served' })
                    .eq('id', state.currentlyServing.id);
                if (updateErr) throw updateErr;

                state.recentServed.unshift({
                    ccdNo: state.currentlyServing.ccdNo,
                    isPriority: state.currentlyServing.isPriority
                });
                if (state.recentServed.length > 4) state.recentServed.pop();
            }

            const { data: waiting, error: fetchErr } = await supabase
                .from('registrations')
                .select('*')
                .eq('status', 'Waiting');
            if (fetchErr) throw fetchErr;

            if (!waiting || waiting.length === 0) {
                state.currentlyServing = null;
                await broadcastStaffUpdate();
                broadcastDisplayUpdate(false);
                return;
            }

            const sortedWaiting = getSortedList(waiting);
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

            const { error: updateErr2 } = await supabase
                .from('registrations')
                .update({ status: 'Serving' })
                .eq('id', nextPerson.id);
            if (updateErr2) throw updateErr2;

            state.currentlyServing = {
                id: nextPerson.id,
                ccdNo: nextPerson.ccd_no,
                fullName: nextPerson.full_name,
                isPriority: nextPerson.is_priority,
                status: 'Serving'
            };

            await broadcastStaffUpdate();
            broadcastDisplayUpdate(true);
        } catch (err) {
            console.error("Error in 'next':", err);
            socket.emit('action_error', { message: "Failed to call next person. The database update was blocked or failed." });
        }
    });

    socket.on('skip', async () => {
        try {
            if (state.currentlyServing) {
                const skippedCcd = state.currentlyServing.ccdNo;
                const { error: updateErr1 } = await supabase
                    .from('registrations')
                    .update({ status: 'Skipped' })
                    .eq('id', state.currentlyServing.id);
                if (updateErr1) throw updateErr1;

                state.currentlyServing = null;

                const { data: waiting, error: fetchErr } = await supabase
                    .from('registrations')
                    .select('*')
                    .eq('status', 'Waiting');
                if (fetchErr) throw fetchErr;

                if (!waiting || waiting.length === 0) {
                    await broadcastStaffUpdate();
                    broadcastDisplayUpdate(false, `${skippedCcd} Skipped — Queue Empty`);
                    return;
                }

                const sortedWaiting = getSortedList(waiting);
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

                const { error: updateErr2 } = await supabase
                    .from('registrations')
                    .update({ status: 'Serving' })
                    .eq('id', nextPerson.id);
                if (updateErr2) throw updateErr2;

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
        } catch (err) {
            console.error("Error in 'skip':", err);
            socket.emit('action_error', { message: "Failed to skip person. The database update was blocked or failed." });
        }
    });

    socket.on('serve_specific', async (id) => {
        try {
            if (state.currentlyServing) {
                const { error: updateErr1 } = await supabase
                    .from('registrations')
                    .update({ status: 'Served' })
                    .eq('id', state.currentlyServing.id);
                if (updateErr1) throw updateErr1;

                state.recentServed.unshift({
                    ccdNo: state.currentlyServing.ccdNo,
                    isPriority: state.currentlyServing.isPriority
                });
                if (state.recentServed.length > 4) state.recentServed.pop();
            }

            const { data, error: fetchErr } = await supabase
                .from('registrations')
                .select('*')
                .eq('id', id)
                .single();
            if (fetchErr) throw fetchErr;

            if (data) {
                const { error: updateErr2 } = await supabase
                    .from('registrations')
                    .update({ status: 'Serving' })
                    .eq('id', data.id);
                if (updateErr2) throw updateErr2;

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
        } catch (err) {
            console.error("Error in 'serve_specific':", err);
            socket.emit('action_error', { message: "Failed to serve specific person. The database update was blocked or failed." });
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

    socket.on('repeat_announcement', () => {
        io.emit('trigger_repeat');
    });

    socket.on('register_display_voices', (voicesList) => {
        state.availableVoices = voicesList;
        io.emit('available_voices_update', state.availableVoices);
    });

    socket.on('update_voice_settings', (settings) => {
        if (settings.lang !== undefined) state.voiceSettings.lang = settings.lang;
        if (settings.rate !== undefined) state.voiceSettings.rate = settings.rate;
        if (settings.voiceURI !== undefined) state.voiceSettings.voiceURI = settings.voiceURI;
        
        io.emit('voice_settings_update', state.voiceSettings);
    });

    socket.on('trigger_test_voice', () => {
        io.emit('trigger_test_voice_display');
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
