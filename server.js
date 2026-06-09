require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
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
    regularConsecutiveCount: 0
};

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

// API Endpoint for Database Records Interface
app.get('/api/records', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('registrations')
            .select('*')
            .order('created_at', { ascending: false });
            
        if (error) throw error;
        res.json({ success: true, data: data });
    } catch (err) {
        console.error("Error fetching records:", err);
        res.status(500).json({ success: false, error: "Database fetch failed" });
    }
});

async function broadcastStaffUpdate() {
    const { data: waitingList } = await supabase
        .from('registrations')
        .select('*')
        .eq('status', 'Waiting')
        .order('created_at', { ascending: true });
        
    const formattedList = (waitingList || []).map(r => ({
        id: r.id,
        ccdNo: r.ccd_no,
        fullName: r.full_name,
        isPriority: r.is_priority
    }));

    io.emit('staff_update', {
        currentlyServing: state.currentlyServing,
        waitingList: formattedList,
        recentServed: state.recentServed,
        regularConsecutiveCount: state.regularConsecutiveCount
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
                    is_priority: isPriority,
                    status: 'Waiting'
                }
            ])
            .select();

        const { count } = await supabase
            .from('registrations')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'Waiting');

        const position = Math.max(0, (count || 1) - 1);

        if (callback) {
            if (error) {
                console.error("Insert Error:", error);
                callback({ success: false });
            } else {
                callback({ success: true, ccdNo: ccdNo, position: position });
            }
        }
        await broadcastStaffUpdate();
    });

    // Handle "Next" logic with 2:1 algorithm
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
            .eq('status', 'Waiting')
            .order('created_at', { ascending: true });

        if (!waiting || waiting.length === 0) {
            state.currentlyServing = null;
            await broadcastStaffUpdate();
            broadcastDisplayUpdate(false);
            return;
        }

        const regularsWaiting = waiting.filter(r => !r.is_priority);
        const prioritiesWaiting = waiting.filter(r => r.is_priority);

        let nextPerson = null;

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
            console.log(`Now serving: ${nextPerson.ccd_no}`);
        } else {
            state.currentlyServing = null;
        }

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
                .eq('status', 'Waiting')
                .order('created_at', { ascending: true });

            if (!waiting || waiting.length === 0) {
                await broadcastStaffUpdate();
                broadcastDisplayUpdate(false, `${skippedCcd} Skipped — Queue Empty`);
                return;
            }

            const regularsWaiting = waiting.filter(r => !r.is_priority);
            const prioritiesWaiting = waiting.filter(r => r.is_priority);

            let nextPerson = null;

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
                console.log(`Skipped to: ${nextPerson.ccd_no}`);
            }
            
            await broadcastStaffUpdate();
            broadcastDisplayUpdate(false, `${skippedCcd} Skipped — Now Serving ${state.currentlyServing ? state.currentlyServing.ccdNo : ''}`);
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
        state.regularConsecutiveCount = 0;
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
