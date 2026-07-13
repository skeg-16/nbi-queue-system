require('dotenv').config();
// Trigger restart
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const cron = require('node-cron');
const nodemailer = require('nodemailer');
const { runBackupAndCleanup } = require('./backupJob');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// Server-side cache for /api/records to limit Supabase API rate usage
let cachedRecords = null;
let lastRecordsFetch = 0;
const CACHE_DURATION = 5000; // 5 seconds cache

function invalidateRecordsCache() {
    cachedRecords = null;
}

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
    regularServedCount: 0,
    lastAction: null,
    voiceSettings: {
        lang: 'en',
        rate: 0.85,
        voiceURI: ''
    },
    availableVoices: []
};


function getSortedList(waitingList, currentRegularCount = 0) {
    let priorityQueue = [];
    let regularQueue = [];

    const sortedByTime = [...waitingList].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

    sortedByTime.forEach(r => {
        if (r.is_priority) priorityQueue.push(r);
        else regularQueue.push(r);
    });

    let interleaved = [];
    let rCount = currentRegularCount;
    let pIdx = 0;
    let rIdx = 0;

    while (pIdx < priorityQueue.length || rIdx < regularQueue.length) {
        if (rCount >= 3 && pIdx < priorityQueue.length) {
            interleaved.push(priorityQueue[pIdx]);
            pIdx++;
            rCount = 0;
        } else if (rIdx < regularQueue.length) {
            interleaved.push(regularQueue[rIdx]);
            rIdx++;
            rCount++;
        } else if (pIdx < priorityQueue.length) {
            interleaved.push(priorityQueue[pIdx]);
            pIdx++;
            rCount = 0;
        }
    }

    return interleaved;
}

// Retries transient network failures (Render <-> Supabase connection drops)
async function withRetry(fn, retries = 3, delayMs = 400) {
    for (let i = 0; i < retries; i++) {
        try {
            return await fn();
        } catch (err) {
            const msg = String(err && err.message || err);
            const isTransient = msg.includes('terminated') || msg.includes('ECONNRESET') || msg.includes('timeout') || msg.includes('fetch failed');
            if (i === retries - 1 || !isTransient) throw err;
            console.warn(`[Retry] Transient error, attempt ${i + 1}/${retries}:`, msg);
            await new Promise(r => setTimeout(r, delayMs * (i + 1)));
        }
    }
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
            .order('ccd_no', { ascending: false })
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
            .like('ccd_no', `CCD-${todayStr}-%`)
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
            .like('ccd_no', `CCD-${todayStr}-%`)
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

// Function to mark all today's unserved registrations as served
async function markTodayAsServed() {
    try {
        const todayStr = getTodayDateStr();
        console.log(`[${new Date().toLocaleTimeString()}] Marking all registrations as served for ${todayStr}...`);

        const { data: updated, error } = await supabase
            .from('registrations')
            .update({ status: 'Served' })
            .like('ccd_no', `CCD-${todayStr}-%`)
            .neq('status', 'Served');

        if (error) {
            console.error("Error marking registrations as served:", error);
            return false;
        } else {
            console.log(`✓ Successfully marked all remaining registrations as served for ${todayStr}`);
            return true;
        }
    } catch (err) {
        console.error("Error in markTodayAsServed:", err);
        return false;
    }
}

// Email Configuration
const emailTransporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// Function to send queue confirmation email
async function sendQueueEmail(toEmail, displayName, shortNo) {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        console.warn('[Email] EMAIL_USER/EMAIL_PASS not set — skipping email send');
        return { success: false, error: 'Email not configured' };
    }
    if (!toEmail) {
        return { success: false, error: 'No email provided' };
    }

    try {
        const info = await emailTransporter.sendMail({
            from: `"NBI Cybercrime Division" <${process.env.EMAIL_USER}>`,
            to: toEmail,
            subject: `NBI Cybercrime Division — Your Queue Number: ${shortNo}`,
            text:
                `Hello, ${displayName}!

Thank you for registering with the NBI Cybercrime Division.

YOUR QUEUE NUMBER: ${shortNo}

IMPORTANT REMINDERS:
- Please keep the printed/issued queue slip with you at all times while waiting.
- Listen carefully for the speaker announcement calling your queue number. Numbers are called only once per turn, so please stay within hearing distance of the waiting area.
- If you miss your number when called, please proceed to the counter immediately to check if you may still be accommodated, or coordinate with staff for reassignment.
- Keep this email and your queue slip until your transaction is fully completed, as it may be requested for verification.

We appreciate your patience and cooperation.

NBI Cybercrime Division
This is an automated message. Please do not reply to this email.`,
            html: `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>NBI Cybercrime Division — Queue Confirmation</title>
</head>
<body style="margin:0; padding:0; background-color:#eef0f3; font-family: Georgia, 'Times New Roman', serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#eef0f3; padding: 24px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff; border-radius: 8px; overflow:hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.08); max-width:600px; width:100%;">

          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #0b1f4d 0%, #142d6e 100%); padding: 28px 32px; border-bottom: 4px solid #f0a500;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="vertical-align:middle;">
                    <p style="margin:0; color:#f0a500; font-size:11px; letter-spacing: 2px; font-family: Arial, sans-serif; font-weight:bold; text-transform:uppercase;">
                      Republic of the Philippines
                    </p>
                    <p style="margin:4px 0 0 0; color:#ffffff; font-size:20px; font-weight:bold; font-family: Arial, sans-serif;">
                      National Bureau of Investigation
                    </p>
                    <p style="margin:2px 0 0 0; color:#c9d4ec; font-size:13px; font-family: Arial, sans-serif; letter-spacing: 1px;">
                      Cybercrime Division
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 36px 32px 12px 32px; font-family: Arial, sans-serif; color:#1a1a1a;">
              <p style="font-size:16px; margin:0 0 16px 0;">Hello, <strong>${displayName}</strong>,</p>
              <p style="font-size:14.5px; line-height:1.6; margin:0 0 24px 0; color:#333333;">
                Thank you for registering with the <strong>NBI Cybercrime Division</strong>. Your queue number has been successfully generated and is provided below.
              </p>
            </td>
          </tr>

          <!-- Queue Number Card -->
          <tr>
            <td style="padding: 0 32px 28px 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0b1f4d; border-radius:8px; border: 2px solid #f0a500;">
                <tr>
                  <td align="center" style="padding: 22px 20px;">
                    <p style="margin:0; color:#c9d4ec; font-size:11px; letter-spacing:2px; text-transform:uppercase; font-family: Arial, sans-serif;">
                      Your Queue Number
                    </p>
                    <p style="margin:8px 0 0 0; color:#f0a500; font-size:42px; font-weight:bold; font-family: Arial, sans-serif; letter-spacing: 2px;">
                      ${shortNo}
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Reminders -->
          <tr>
            <td style="padding: 0 32px 8px 32px; font-family: Arial, sans-serif;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#fdf6e8; border-left: 4px solid #f0a500; border-radius: 4px;">
                <tr>
                  <td style="padding: 16px 20px;">
                    <p style="margin:0 0 10px 0; color:#8a1f1f; font-size:13px; font-weight:bold; letter-spacing:0.5px;">
                      ⚠ IMPORTANT REMINDERS
                    </p>
                    <ul style="margin:0; padding-left:18px; color:#333333; font-size:13.5px; line-height:1.8;">
                      <li><strong>Keep your queue slip safe.</strong> Please hold on to the printed/issued queue slip at all times while waiting.</li>
                      <li><strong>Listen for the announcement.</strong> Our speaker system calls queue numbers aloud — please stay within hearing distance of the waiting area and pay close attention when numbers are called.</li>
                      <li><strong>If you miss your call,</strong> proceed to the counter immediately so staff can assist you or reassign your slot.</li>
                      <li><strong>Retain this email</strong> until your transaction is complete, as it may be requested for verification purposes.</li>
                    </ul>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding: 20px 32px 32px 32px; font-family: Arial, sans-serif;">
              <p style="font-size:13.5px; line-height:1.6; color:#333333; margin:0;">
                We appreciate your patience and cooperation. Should you have any concerns while waiting, please approach our staff on duty for assistance.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#0b1f4d; padding: 20px 32px; border-top: 4px solid #8a1f1f;">
              <p style="margin:0; color:#ffffff; font-size:13px; font-family: Arial, sans-serif; font-weight:bold;">
                NBI Cybercrime Division
              </p>
              <p style="margin:6px 0 0 0; color:#c9d4ec; font-size:11.5px; font-family: Arial, sans-serif;">
                This is an automated message. Please do not reply to this email.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`
        });

        console.log('[Email] ✓ Sent to', toEmail, '- message_id:', info.messageId);
        return { success: true, info };
    } catch (err) {
        console.error('[Email] Exception:', err.message);
        return { success: false, error: err.message };
    }
}

// Scheduled Task will run below at 6:00 PM

// Serve static files
app.use(express.static(path.join(__dirname, 'public'), {
    setHeaders: (res, path) => {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
    }
}));
app.use(express.json());

app.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    next();
});

//app.get('/display', (req, res) => res.sendFile(...));
//app.get('/staff', (req, res) => res.sendFile(...));
//app.get('/register', (req, res) => res.sendFile(...));
//app.get('/records', (req, res) => res.sendFile(...));
//app.get('/feedback/en', (req, res) => res.sendFile(...));
//app.get('/feedback/tl', (req, res) => res.sendFile(...));
//app.get('/', (req, res) => res.redirect('/register'));

app.use(express.static(path.join(__dirname, '../client/dist')));
app.get(/^(?!\/api).*/, (req, res) => {
    res.sendFile(path.join(__dirname, '../client/dist/index.html'));
});

// API Endpoint for Manual Queue Reset (for staff)
app.post('/api/reset-queue', async (req, res) => {
    try {
        const success = await markTodayAsServed();
        if (success) {
            res.json({ success: true, message: "Queue reset successfully" });
        } else {
            res.status(500).json({ success: false, error: "Failed to reset queue" });
        }
    } catch (err) {
        console.error("Error resetting queue:", err);
        res.status(500).json({ success: false, error: "Failed to reset queue" });
    }
});

// API Endpoint for Database Records Interface
app.get('/api/records', async (req, res) => {
    try {
        const now = Date.now();
        if (cachedRecords && (now - lastRecordsFetch < CACHE_DURATION)) {
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
            return res.json({ success: true, data: cachedRecords });
        }

        const { data, error } = await withRetry(() => supabase
            .from('registrations')
            .select('*')
            .order('created_at', { ascending: false }));

        if (error) throw error;

        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');

        // Append Agent Assessment data to each record
        const { data: remarksRows, error: remarksErr } = await withRetry(() => supabase
            .from('agent_remarks')
            .select('record_id, is_actionable, case_type, subject'));

        if (remarksErr) console.error("Error fetching agent_remarks:", remarksErr);

        const remarksMap = {};
        (remarksRows || []).forEach(r => { remarksMap[r.record_id] = r; });

        const recordsWithRemarks = data.map(r => ({
            ...r,
            isActionable: remarksMap[r.id] ? (remarksMap[r.id].is_actionable || 'no') : 'no',
            caseType: remarksMap[r.id] ? (remarksMap[r.id].case_type || '') : '',
            subject: remarksMap[r.id] ? (remarksMap[r.id].subject || '') : ''
        }));

        // Update cache
        cachedRecords = recordsWithRemarks;
        lastRecordsFetch = now;

        res.json({ success: true, data: recordsWithRemarks });
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

app.get('/api/records/:id/remarks', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('agent_remarks')
            .select('*')
            .eq('record_id', req.params.id)
            .maybeSingle();

        if (error) throw error;

        const recordRemarks = data
            ? { interviewer: data.interviewer || '', text: data.text || '', isActionable: data.is_actionable || 'no', caseType: data.case_type || '', subject: data.subject || '', last_modified: data.last_modified }
            : { interviewer: '', text: '', isActionable: 'no', caseType: '', subject: '', last_modified: null };

        res.json({ success: true, data: recordRemarks });
    } catch (err) {
        console.error("Error loading remarks:", err);
        res.status(500).json({ success: false, error: "Failed to load remarks" });
    }
});

app.post('/api/records/:id/remarks', async (req, res) => {
    try {
        const id = req.params.id;
        const { interviewer, text, isActionable, caseType, subject } = req.body;

        const payload = {
            record_id: id,
            interviewer: interviewer || '',
            text: text || '',
            is_actionable: isActionable || 'no',
            case_type: caseType || '',
            subject: subject || '',
            last_modified: new Date().toISOString()
        };

        const { data, error } = await supabase
            .from('agent_remarks')
            .upsert(payload, { onConflict: 'record_id' })
            .select()
            .single();

        if (error) throw error;

        auditLog('Agent Remarks', `Updated remarks for ID ${id}`);
        invalidateRecordsCache();
        res.json({
            success: true,
            data: { interviewer: data.interviewer, text: data.text, isActionable: data.is_actionable, caseType: data.case_type, subject: data.subject, last_modified: data.last_modified }
        });
    } catch (err) {
        console.error("Error saving remarks:", err);
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

        // Handle automatic timestamps for status changes
        if (updates.status === 'Serving') {
            updates.serving_start_timestamp = new Date().toISOString();
        } else if (updates.status === 'Served' && updates.serving_duration === undefined) {
            // Only calculate if the user isn't manually overriding the duration
            const { data: record, error: fetchErr } = await supabase.from('registrations').select('serving_start_timestamp').eq('id', id).single();
            if (!fetchErr && record && record.serving_start_timestamp) {
                const diffMs = Math.max(0, new Date() - new Date(record.serving_start_timestamp));
                const mins = Math.floor(diffMs / 60000).toString().padStart(2, '0');
                const secs = Math.floor((diffMs % 60000) / 1000).toString().padStart(2, '0');
                updates.serving_duration = `${mins}:${secs}`;
            }
        }

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
                status: 'Serving',
                startTimestamp: person.serving_start_timestamp || new Date().toISOString()
            };
            broadcastDisplayUpdate(true);
        } else if (updates.status === 'Skipped' && state.currentlyServing && state.currentlyServing.id === id && data && data.length > 0) {
            state.currentlyServing = null;
            broadcastDisplayUpdate(false, `${data[0].ccd_no} Skipped`);
        }

        auditLog('Edit Record', `Edited record ID ${id}`);
        res.json({ success: true, data: data[0] });
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

        let updateData = { status };

        if (status === 'Serving') {
            updateData.serving_start_timestamp = new Date().toISOString();
        } else if (status === 'Served') {
            // calculate duration
            const { data: record, error: fetchErr } = await supabase.from('registrations').select('serving_start_timestamp').eq('id', id).single();
            if (!fetchErr && record && record.serving_start_timestamp) {
                const diffMs = Math.max(0, new Date() - new Date(record.serving_start_timestamp));
                const mins = Math.floor(diffMs / 60000).toString().padStart(2, '0');
                const secs = Math.floor((diffMs % 60000) / 1000).toString().padStart(2, '0');
                updateData.serving_duration = `${mins}:${secs}`;
            }
        }

        const { error } = await supabase.from('registrations').update(updateData).eq('id', id);
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

// Feedback Endpoints
app.post('/api/feedback', async (req, res) => {
    try {
        const payload = req.body;
        if (!payload.language) payload.language = 'en';
        if (payload.age) payload.age = parseInt(payload.age, 10);

        // Strip any fields that might not exist in the table
        const cleanPayload = {
            language: payload.language || null,
            client_type: payload.client_type || null,
            date: payload.date || null,
            sex: payload.sex || null,
            age: payload.age || null,
            region: payload.region || null,
            service_availed: payload.service_availed || null,
            cc1: payload.cc1 || null,
            cc2: payload.cc2 || null,
            cc3: payload.cc3 || null,
            sqd0: payload.sqd0 || null,
            sqd1: payload.sqd1 || null,
            sqd2: payload.sqd2 || null,
            sqd3: payload.sqd3 || null,
            sqd4: payload.sqd4 || null,
            sqd5: payload.sqd5 || null,
            sqd6: payload.sqd6 || null,
            sqd7: payload.sqd7 || null,
            sqd8: payload.sqd8 || null,
            suggestions: payload.suggestions || null,
            email: payload.email || null
        };

        console.log('[Feedback] Inserting:', JSON.stringify(cleanPayload));

        const { data, error } = await supabase.from('feedbacks').insert([cleanPayload]).select();

        if (error) {
            console.error('[Feedback] Supabase error:', JSON.stringify(error));
            return res.status(500).json({
                success: false,
                error: error.message,
                details: error.details,
                hint: error.hint,
                code: error.code
            });
        }

        // RLS can silently block inserts (data comes back empty)
        if (!data || data.length === 0) {
            console.error('[Feedback] Insert returned no data - likely RLS blocking');
            return res.status(500).json({
                success: false,
                error: 'Insert was blocked. Please disable RLS on the feedbacks table or add an insert policy.',
                hint: 'Run in Supabase SQL: ALTER TABLE feedbacks DISABLE ROW LEVEL SECURITY;'
            });
        }

        console.log('[Feedback] Success, inserted ID:', data[0].id);
        auditLog('Feedback Submit', `Received ${cleanPayload.language} feedback`);
        res.json({ success: true, id: data[0].id });
    } catch (err) {
        console.error('[Feedback] Exception:', err);
        res.status(500).json({
            success: false,
            error: String(err.message || err),
            stack: String(err.stack || '').split('\n').slice(0, 3)
        });
    }
});

app.get('/api/feedbacks', async (req, res) => {
    try {
        const language = req.query.language;
        let query = supabase.from('feedbacks').select('*').order('created_at', { ascending: false });
        if (language) query = query.eq('language', language);

        const { data, error } = await query;
        if (error) throw error;

        res.json(data);
    } catch (err) {
        console.error("Feedback Fetch Error:", err);
        res.status(500).json({ error: err.message });
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

// Google TTS Proxy Endpoint
app.get('/api/tts', async (req, res) => {
    try {
        let text = req.query.text;
        const lang = req.query.lang || 'tl'; // Default to Filipino/Tagalog
        if (!text) return res.status(400).send('Text is required');

        // FOOLPROOF HACK: Forcefully replace 'counter 1' with 'interview room' on the server side
        // This ensures the voice says 'interview room' even if the user's browser is using a stubbornly cached old version of display.html
        text = text.replace(/counter 1/gi, 'interview room');
        text = text.replace(/counter one/gi, 'interview room');

        const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=${lang}&client=tw-ob`;

        // Use dynamic import for node-fetch if using Node 16+, or native fetch in Node 18+
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
            }
        });

        if (!response.ok) throw new Error(`Google TTS returned ${response.status}`);

        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 1 day

        const buffer = await response.arrayBuffer();
        res.send(Buffer.from(buffer));
    } catch (err) {
        console.error("TTS Proxy Error:", err);
        res.status(500).send('TTS Generation failed');
    }
});


async function broadcastStaffUpdate() {
    invalidateRecordsCache();
    const todayStr = getTodayDateStr();
    const { data: allRegistrations } = await supabase
        .from('registrations')
        .select('status, is_priority, id, ccd_no, full_name, created_at')
        .like('ccd_no', `CCD-${todayStr}-%`);

    const waitingList = (allRegistrations || []).filter(r => r.status === 'Waiting');
    const skippedListRaw = (allRegistrations || []).filter(r => r.status === 'Skipped');
    const stats = {
        total: allRegistrations ? allRegistrations.length : 0,
        waiting: waitingList.length,
        served: (allRegistrations || []).filter(r => r.status === 'Served').length,
        skipped: skippedListRaw.length
    };

    const sortedList = getSortedList(waitingList, state.regularServedCount);

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
        if (!nextPerson.is_priority) {
            let slot = (state.regularServedCount >= 3) ? 1 : state.regularServedCount + 1;
            cycleLabel = `Next: Regular (${slot}/3)`;
        } else {
            cycleLabel = `Next: Priority`;
        }
    }

    const formattedSkippedList = skippedListRaw.map(r => ({
        id: r.id,
        ccdNo: r.ccd_no,
        fullName: r.full_name,
        isPriority: r.is_priority
    }));

    io.emit('staff_update', {
        currentlyServing: state.currentlyServing,
        waitingList: formattedList,
        skippedList: formattedSkippedList,
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
        startTimestamp: state.currentlyServing ? state.currentlyServing.startTimestamp : null,
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
        try {
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
                        region: formData.region || null,
                        address: formData.address || 'N/A',
                        purpose: formData.purpose || 'File a Complaint',
                        referred_by: formData.referredBy || null,
                        is_priority: isPriority,
                        status: 'Waiting',
                        e_signature: formData.signature || null,
                        registration_duration: formData.registrationDuration || null
                    }
                ])
                .select();

            if (error) {
                console.error("Registration Insert Error:", error);
                if (callback) callback({ success: false, error: error.message || "Unknown database error", details: error });
                return;
            }

            // Compute display name and short number once
            const firstName = (formData.fullName || '').trim().split(/\s+/)[0] || 'there';
            const displayName = firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();
            const shortNo = ccdNo.split('-').pop();

            // Send email notification (if email provided)
            if (formData.email) {
                sendQueueEmail(formData.email, displayName, shortNo)
                    .catch(err => console.error('[Email] Failed to notify:', err));
            }

            const { data: waitingList } = await supabase
                .from('registrations')
                .select('*')
                .eq('status', 'Waiting')
                .like('ccd_no', `CCD-${todayStr}-%`);

            const sortedList = getSortedList(waitingList || [], state.priorityServedCount);

            let position = -1;
            if (data && data.length > 0) {
                position = sortedList.findIndex(r => r.id === data[0].id);
            }
            if (position === -1) position = sortedList.length > 0 ? sortedList.length - 1 : 0;

            if (callback) {
                callback({ success: true, ccdNo: ccdNo, position: position, isPriority: isPriority });
            }
            await broadcastStaffUpdate();
        } catch (err) {
            console.error("Exception in submit_registration:", err);
            if (callback) callback({ success: false, error: err.message || "Server exception" });
        }
    });

    // Handle "End Current" logic
    socket.on('end_current', async () => {
        try {
            if (state.currentlyServing) {
                let serving_duration = null;
                if (state.currentlyServing.startTimestamp) {
                    const diffMs = Math.max(0, new Date() - new Date(state.currentlyServing.startTimestamp));
                    const mins = Math.floor(diffMs / 60000).toString().padStart(2, '0');
                    const secs = Math.floor((diffMs % 60000) / 1000).toString().padStart(2, '0');
                    serving_duration = `${mins}:${secs}`;
                }

                const { error: updateErr } = await supabase
                    .from('registrations')
                    .update({ status: 'Served', ...(serving_duration ? { serving_duration } : {}) })
                    .eq('id', state.currentlyServing.id);
                if (updateErr) throw updateErr;

                state.recentServed.unshift({
                    ccdNo: state.currentlyServing.ccdNo,
                    isPriority: state.currentlyServing.isPriority
                });
                if (state.recentServed.length > 4) state.recentServed.pop();

                state.currentlyServing = null;

                await broadcastStaffUpdate();
                broadcastDisplayUpdate(false);
            }
        } catch (err) {
            console.error("Error in 'end_current':", err);
            socket.emit('action_error', { message: "Failed to end current session. Database update blocked or failed." });
        }
    });

    // Handle "Next" logic with strict absolute priority algorithm
    socket.on('next', async () => {
        try {
            const previousServing = state.currentlyServing ? { ...state.currentlyServing } : null;
            if (state.currentlyServing) {
                let serving_duration = null;
                if (state.currentlyServing.startTimestamp) {
                    const diffMs = Math.max(0, new Date() - new Date(state.currentlyServing.startTimestamp));
                    const mins = Math.floor(diffMs / 60000).toString().padStart(2, '0');
                    const secs = Math.floor((diffMs % 60000) / 1000).toString().padStart(2, '0');
                    serving_duration = `${mins}:${secs}`;
                }

                const { error: updateErr } = await supabase
                    .from('registrations')
                    .update({ status: 'Served', ...(serving_duration ? { serving_duration } : {}) })
                    .eq('id', state.currentlyServing.id);
                if (updateErr) throw updateErr;

                state.recentServed.unshift({
                    ccdNo: state.currentlyServing.ccdNo,
                    isPriority: state.currentlyServing.isPriority
                });
                if (state.recentServed.length > 4) state.recentServed.pop();
            }

            const todayStr = getTodayDateStr();
            const { data: waiting, error: fetchErr } = await supabase
                .from('registrations')
                .select('*')
                .eq('status', 'Waiting')
                .like('ccd_no', `CCD-${todayStr}-%`);
            if (fetchErr) throw fetchErr;

            if (!waiting || waiting.length === 0) {
                state.currentlyServing = null;
                await broadcastStaffUpdate();
                broadcastDisplayUpdate(false);
                return;
            }

            const sortedWaiting = getSortedList(waiting, state.regularServedCount);
            const nextPerson = sortedWaiting[0];

            if (!nextPerson.is_priority) {
                if (state.regularServedCount >= 3) {
                    state.regularServedCount = 1;
                } else {
                    state.regularServedCount++;
                }
            } else {
                state.regularServedCount = 0;
            }

            const nowIso = new Date().toISOString();
            const { error: updateErr2 } = await supabase
                .from('registrations')
                .update({ status: 'Serving', serving_start_timestamp: nowIso })
                .eq('id', nextPerson.id);
            if (updateErr2) throw updateErr2;

            state.currentlyServing = {
                id: nextPerson.id,
                ccdNo: nextPerson.ccd_no,
                fullName: nextPerson.full_name,
                isPriority: nextPerson.is_priority,
                status: 'Serving',
                startTimestamp: nowIso
            };

            state.lastAction = {
                action: 'next',
                revertToWaitingId: nextPerson.id,
                restoreToServing: previousServing
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
                const previousServing = { ...state.currentlyServing };
                const skippedCcd = state.currentlyServing.ccdNo;
                const { error: updateErr1 } = await supabase
                    .from('registrations')
                    .update({ status: 'Skipped' })
                    .eq('id', state.currentlyServing.id);
                if (updateErr1) throw updateErr1;

                state.currentlyServing = null;

                state.lastAction = {
                    action: 'skip',
                    revertToWaitingId: null,
                    restoreToServing: previousServing
                };

                await broadcastStaffUpdate();
                broadcastDisplayUpdate(false, `${skippedCcd} Skipped`);
            }
        } catch (err) {
            console.error("Error in 'skip':", err);
            socket.emit('action_error', { message: "Failed to skip person. The database update was blocked or failed." });
        }
    });

    socket.on('call_skipped', async () => {
        try {
            const previousServing = state.currentlyServing ? { ...state.currentlyServing } : null;
            if (state.currentlyServing) {
                let serving_duration = null;
                if (state.currentlyServing.startTimestamp) {
                    const diffMs = Math.max(0, new Date() - new Date(state.currentlyServing.startTimestamp));
                    const mins = Math.floor(diffMs / 60000).toString().padStart(2, '0');
                    const secs = Math.floor((diffMs % 60000) / 1000).toString().padStart(2, '0');
                    serving_duration = `${mins}:${secs}`;
                }

                const { error: updateErr } = await supabase
                    .from('registrations')
                    .update({ status: 'Served', ...(serving_duration ? { serving_duration } : {}) })
                    .eq('id', state.currentlyServing.id);
                if (updateErr) throw updateErr;

                state.recentServed.unshift({
                    ccdNo: state.currentlyServing.ccdNo,
                    isPriority: state.currentlyServing.isPriority
                });
                if (state.recentServed.length > 4) state.recentServed.pop();
            }

            const todayStr = getTodayDateStr();
            const { data: skippedList, error: fetchErr } = await supabase
                .from('registrations')
                .select('*')
                .eq('status', 'Skipped')
                .like('ccd_no', `CCD-${todayStr}-%`)
                .order('created_at', { ascending: true })
                .limit(1);

            if (fetchErr) throw fetchErr;

            if (!skippedList || skippedList.length === 0) {
                state.currentlyServing = null;
                await broadcastStaffUpdate();
                broadcastDisplayUpdate(false);
                return;
            }

            const nextPerson = skippedList[0];
            const nowIso = new Date().toISOString();
            const { error: updateErr2 } = await supabase
                .from('registrations')
                .update({ status: 'Serving', serving_start_timestamp: nowIso })
                .eq('id', nextPerson.id);
            if (updateErr2) throw updateErr2;

            state.currentlyServing = {
                id: nextPerson.id,
                ccdNo: nextPerson.ccd_no,
                fullName: nextPerson.full_name,
                isPriority: nextPerson.is_priority,
                status: 'Serving',
                startTimestamp: nowIso
            };

            state.lastAction = {
                action: 'call_skipped',
                revertToSkippedId: nextPerson.id,
                restoreToServing: previousServing
            };

            await broadcastStaffUpdate();
            broadcastDisplayUpdate(true);
        } catch (err) {
            console.error("Error in 'call_skipped':", err);
            socket.emit('action_error', { message: "Failed to call skipped person. The database update was blocked or failed." });
        }
    });

    socket.on('serve_specific', async (id) => {
        try {
            const previousServing = state.currentlyServing ? { ...state.currentlyServing } : null;
            if (state.currentlyServing) {
                let serving_duration = null;
                if (state.currentlyServing.startTimestamp) {
                    const diffMs = Math.max(0, new Date() - new Date(state.currentlyServing.startTimestamp));
                    const mins = Math.floor(diffMs / 60000).toString().padStart(2, '0');
                    const secs = Math.floor((diffMs % 60000) / 1000).toString().padStart(2, '0');
                    serving_duration = `${mins}:${secs}`;
                }

                const { error: updateErr1 } = await supabase
                    .from('registrations')
                    .update({ status: 'Served', ...(serving_duration ? { serving_duration } : {}) })
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
                const nowIso = new Date().toISOString();
                const { error: updateErr2 } = await supabase
                    .from('registrations')
                    .update({ status: 'Serving', serving_start_timestamp: nowIso })
                    .eq('id', data.id);
                if (updateErr2) throw updateErr2;

                state.currentlyServing = {
                    id: data.id,
                    ccdNo: data.ccd_no,
                    fullName: data.full_name,
                    isPriority: data.is_priority,
                    status: 'Serving',
                    startTimestamp: nowIso
                };

                state.lastAction = {
                    action: 'serve_specific',
                    revertToWaitingId: data.id,
                    restoreToServing: previousServing
                };

                await broadcastStaffUpdate();
                broadcastDisplayUpdate(true);
            }
        } catch (err) {
            console.error("Error in 'serve_specific':", err);
            socket.emit('action_error', { message: "Failed to serve specific person. The database update was blocked or failed." });
        }
    });

    socket.on('archive_person', async (id) => {
        try {
            const { data, error: fetchErr } = await supabase
                .from('registrations')
                .select('*')
                .eq('id', id)
                .single();
            if (fetchErr) throw fetchErr;

            if (!data) {
                socket.emit('action_error', { message: "Person not found." });
                return;
            }

            const { error: updateErr } = await supabase
                .from('registrations')
                .update({ status: 'Served' })
                .eq('id', id);
            if (updateErr) throw updateErr;

            auditLog('Archive Person', `Archived (marked Served) ID ${id} - ${data.ccd_no}`);

            // Intentionally NOT touching state.currentlyServing or state.recentServed
            // so this person never flashes on the TV display screen.

            await broadcastStaffUpdate();
        } catch (err) {
            console.error("Error in 'archive_person':", err);
            socket.emit('action_error', { message: "Failed to archive person. The database update was blocked or failed." });
        }
    });

    socket.on('undo', async () => {
        try {
            if (!state.lastAction) return;
            const action = state.lastAction;

            // 1. Revert the newly served person back to their previous state
            if (action.revertToWaitingId) {
                await supabase.from('registrations')
                    .update({ status: 'Waiting', serving_start_timestamp: null })
                    .eq('id', action.revertToWaitingId);
            } else if (action.revertToSkippedId) {
                await supabase.from('registrations')
                    .update({ status: 'Skipped', serving_start_timestamp: null })
                    .eq('id', action.revertToSkippedId);
            }

            // 2. Restore the previous person to Serving
            if (action.restoreToServing) {
                await supabase.from('registrations')
                    .update({ status: 'Serving' })
                    .eq('id', action.restoreToServing.id);
                state.currentlyServing = action.restoreToServing;

                // Remove from recentServed if they were put there
                if (action.action === 'next' || action.action === 'serve_specific' || action.action === 'call_skipped') {
                    if (state.recentServed.length > 0 && state.recentServed[0].ccdNo === action.restoreToServing.ccdNo) {
                        state.recentServed.shift();
                    }
                }
            } else {
                state.currentlyServing = null;
            }

            // 3. Clear last action
            state.lastAction = null;

            await broadcastStaffUpdate();
            broadcastDisplayUpdate(false);
        } catch (err) {
            console.error("Error in 'undo':", err);
            socket.emit('action_error', { message: "Failed to undo action." });
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

cron.schedule('0 18 * * *', async () => {
    console.log(`\n\n========== 6 PM AUTOMATIC QUEUE RESET ==========`);
    console.log(`[${new Date().toLocaleTimeString()}] Marking ALL unserved registrations as Served...`);
    try {
        const { error, count } = await supabase
            .from('registrations')
            .update({ status: 'Served' })
            .in('status', ['Waiting', 'Serving']);

        if (error) {
            console.error("❌ Error running 6:00 PM reset:", error);
        } else {
            console.log(`✅ Successfully marked queue as Served at 6 PM`);
            state.currentlyServing = null;
            state.recentServed = [];
            state.regularServedCount = 0;
            await broadcastStaffUpdate();
            console.log(`========== QUEUE RESET COMPLETE ==========\n\n`);
        }
    } catch (err) {
        console.error("❌ Exception in 6:00 PM reset:", err);
    }
}, {
    timezone: "Asia/Manila"
});


// Function to send queue confirmation email
async function sendQueueEmail(toEmail, displayName, shortNo) {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        console.warn('[Email] EMAIL_USER/EMAIL_PASS not set — skipping email send');
        return { success: false, error: 'Email not configured' };
    }
    if (!toEmail) {
        return { success: false, error: 'No email provided' };
    }

    try {
        const info = await emailTransporter.sendMail({
            from: `"NBI Cybercrime Division" <${process.env.EMAIL_USER}>`,
            to: toEmail,
            subject: `NBI Cybercrime Division — Your Queue Number: ${shortNo}`,
            text:
            `Hello, ${displayName}!

Thank you for registering with the NBI Cybercrime Division.

YOUR QUEUE NUMBER: ${shortNo}

IMPORTANT REMINDERS:
- Please keep the printed/issued queue slip with you at all times while waiting.
- Listen carefully for the speaker announcement calling your queue number. Numbers are called only once per turn, so please stay within hearing distance of the waiting area.
- If you miss your number when called, please proceed to the counter immediately to check if you may still be accommodated, or coordinate with staff for reassignment.
- Keep this email and your queue slip until your transaction is fully completed, as it may be requested for verification.

We appreciate your patience and cooperation.

NBI Cybercrime Division
This is an automated message. Please do not reply to this email.`,
            html: `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>NBI Cybercrime Division — Queue Confirmation</title>
</head>
<body style="margin:0; padding:0; background-color:#eef0f3; font-family: Georgia, 'Times New Roman', serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#eef0f3; padding: 24px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff; border-radius: 8px; overflow:hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.08); max-width:600px; width:100%;">

          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #0b1f4d 0%, #142d6e 100%); padding: 28px 32px; border-bottom: 4px solid #f0a500;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="vertical-align:middle;">
                    <p style="margin:0; color:#f0a500; font-size:11px; letter-spacing: 2px; font-family: Arial, sans-serif; font-weight:bold; text-transform:uppercase;">
                      Republic of the Philippines
                    </p>
                    <p style="margin:4px 0 0 0; color:#ffffff; font-size:20px; font-weight:bold; font-family: Arial, sans-serif;">
                      National Bureau of Investigation
                    </p>
                    <p style="margin:2px 0 0 0; color:#c9d4ec; font-size:13px; font-family: Arial, sans-serif; letter-spacing: 1px;">
                      Cybercrime Division
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 36px 32px 12px 32px; font-family: Arial, sans-serif; color:#1a1a1a;">
              <p style="font-size:16px; margin:0 0 16px 0;">Hello, <strong>${displayName}</strong>,</p>
              <p style="font-size:14.5px; line-height:1.6; margin:0 0 24px 0; color:#333333;">
                Thank you for registering with the <strong>NBI Cybercrime Division</strong>. Your queue number has been successfully generated and is provided below.
              </p>
            </td>
          </tr>

          <!-- Queue Number Card -->
          <tr>
            <td style="padding: 0 32px 28px 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0b1f4d; border-radius:8px; border: 2px solid #f0a500;">
                <tr>
                  <td align="center" style="padding: 22px 20px;">
                    <p style="margin:0; color:#c9d4ec; font-size:11px; letter-spacing:2px; text-transform:uppercase; font-family: Arial, sans-serif;">
                      Your Queue Number
                    </p>
                    <p style="margin:8px 0 0 0; color:#f0a500; font-size:42px; font-weight:bold; font-family: Arial, sans-serif; letter-spacing: 2px;">
                      ${shortNo}
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Reminders -->
          <tr>
            <td style="padding: 0 32px 8px 32px; font-family: Arial, sans-serif;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#fdf6e8; border-left: 4px solid #f0a500; border-radius: 4px;">
                <tr>
                  <td style="padding: 16px 20px;">
                    <p style="margin:0 0 10px 0; color:#8a1f1f; font-size:13px; font-weight:bold; letter-spacing:0.5px;">
                      ⚠ IMPORTANT REMINDERS
                    </p>
                    <ul style="margin:0; padding-left:18px; color:#333333; font-size:13.5px; line-height:1.8;">
                      <li><strong>Keep your queue slip safe.</strong> Please hold on to the printed/issued queue slip at all times while waiting.</li>
                      <li><strong>Listen for the announcement.</strong> Our speaker system calls queue numbers aloud — please stay within hearing distance of the waiting area and pay close attention when numbers are called.</li>
                      <li><strong>If you miss your call,</strong> proceed to the counter immediately so staff can assist you or reassign your slot.</li>
                      <li><strong>Retain this email</strong> until your transaction is complete, as it may be requested for verification purposes.</li>
                    </ul>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding: 20px 32px 32px 32px; font-family: Arial, sans-serif;">
              <p style="font-size:13.5px; line-height:1.6; color:#333333; margin:0;">
                We appreciate your patience and cooperation. Should you have any concerns while waiting, please approach our staff on duty for assistance.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#0b1f4d; padding: 20px 32px; border-top: 4px solid #8a1f1f;">
              <p style="margin:0; color:#ffffff; font-size:13px; font-family: Arial, sans-serif; font-weight:bold;">
                NBI Cybercrime Division
              </p>
              <p style="margin:6px 0 0 0; color:#c9d4ec; font-size:11.5px; font-family: Arial, sans-serif;">
                This is an automated message. Please do not reply to this email.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`
        });

    console.log('[Email] ✓ Sent to', toEmail, '- message_id:', info.messageId);
    return { success: true, info };
} catch (err) {
    console.error('[Email] Exception:', err.message);
    return { success: false, error: err.message };
}
}



const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    
    // Run backup job after boot with a retry mechanism to handle network initialization delay
    function runBackupWithRetry(delayMs = 60000, attempt = 1) {
        setTimeout(async () => {
            console.log(`[Backup] Executing startup catch-up trigger (Attempt ${attempt})...`);
            const result = await runBackupAndCleanup();
            if (result && !result.success) {
                console.warn(`[Backup] Startup backup attempt ${attempt} failed. Internet or database connection might not be ready yet.`);
                if (attempt < 5) {
                    console.log(`[Backup] Scheduling retry ${attempt + 1} in 2 minutes (120000ms)...`);
                    runBackupWithRetry(120000, attempt + 1);
                } else {
                    console.error(`[Backup] Startup backup failed after 5 attempts. Will wait for the hourly scheduler.`);
                }
            } else {
                console.log(`[Backup] Startup backup execution completed successfully.`);
            }
        }, delayMs);
    }

    runBackupWithRetry(60000); // Wait 60 seconds after boot

    // Also run it periodically every hour while the server is awake
    cron.schedule('0 * * * *', () => {
        runBackupAndCleanup();
    });
});
