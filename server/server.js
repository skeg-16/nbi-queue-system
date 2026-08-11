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
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { runBackupAndCleanup } = require('./backupJob');
const crypto = require('crypto');

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
        const nextPriority = priorityQueue[pIdx];
        const nextRegular = regularQueue[rIdx];

        // Bump the priority person up if the 1:3 slot is due, OR if they
        // actually arrived earlier than the next regular person (don't make
        // an earlier-arriving priority wait just to satisfy the ratio).
        const priorityArrivedEarlier = nextPriority && nextRegular &&
            new Date(nextPriority.created_at) < new Date(nextRegular.created_at);

        if (nextPriority && (rCount >= 3 || !nextRegular || priorityArrivedEarlier)) {
            interleaved.push(nextPriority);
            pIdx++;
            rCount = 0;
        } else if (nextRegular) {
            interleaved.push(nextRegular);
            rIdx++;
            rCount++;
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
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    family: 4,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// Serve static files
app.use(express.static(path.join(__dirname, '../client/dist'), {
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
            ? { text: data.text || '', isActionable: data.is_actionable || 'no', caseType: data.case_type || '', subject: data.subject || '', interviewer: data.interviewer || '', last_modified: data.last_modified }
            : { text: '', isActionable: 'no', caseType: '', subject: '', interviewer: '', last_modified: null };

        res.json({ success: true, data: recordRemarks });
    } catch (err) {
        console.error("Error loading remarks:", err);
        res.status(500).json({ success: false, error: "Failed to load remarks" });
    }
});

app.post('/api/records/:id/remarks', async (req, res) => {
    try {
        const id = req.params.id;
        const { text, isActionable, caseType, subject, interviewer, isAdmin } = req.body;

        // Server-side ownership check — huwag umasa sa front-end lang
        const { data: existing, error: fetchErr } = await supabase
            .from('agent_remarks')
            .select('interviewer')
            .eq('record_id', id)
            .maybeSingle();
        if (fetchErr) throw fetchErr;

        const existingInterviewer = (existing?.interviewer || '').trim().toLowerCase();
        const requestInterviewer = (interviewer || '').trim();
        const requestInterviewerLower = requestInterviewer.toLowerCase();

        if (!isAdmin && existingInterviewer && existingInterviewer !== requestInterviewerLower) {
            return res.status(403).json({
                success: false,
                error: `This assessment was already claimed by ${existing.interviewer}. You cannot edit it.`
            });
        }

        const payload = {
            record_id: id,
            text: text || '',
            is_actionable: isActionable || 'no',
            case_type: caseType || '',
            subject: subject || '',
            interviewer: requestInterviewer,
            last_modified: new Date().toISOString()
        };

        const { data, error } = await supabase
            .from('agent_remarks')
            .upsert(payload, { onConflict: 'record_id' })
            .select()
            .single();

        if (error) throw error;

        auditLog('Agent Remarks', `Updated remarks for ID ${id} by ${requestInterviewer || 'unknown'}`);
        res.json({
            success: true,
            data: { text: data.text, isActionable: data.is_actionable, caseType: data.case_type, subject: data.subject, interviewer: data.interviewer, last_modified: data.last_modified }
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

        // Kung na-delete ang record na may pinakamataas na CCD number ngayong araw,
        // i-recompute ang in-memory daily counter para sa totoong pinakamataas na natitira —
        // sa ganon, kung na-delete yung pinakahuling number, mare-reuse ito sa susunod na registration
        // imbes na basta lumaktaw pasulong (stale in-memory counter).
        try {
            const todayStr = getTodayDateStr();
            const { data: latestData } = await supabase
                .from('registrations')
                .select('ccd_no')
                .like('ccd_no', `CCD-${todayStr}-%`)
                .order('ccd_no', { ascending: false })
                .limit(1);

            if (latestData && latestData.length > 0) {
                const parts = latestData[0].ccd_no.split('-');
                const num = parseInt(parts[parts.length - 1], 10);
                state.dailyCounter = isNaN(num) ? 0 : num;
            } else {
                state.dailyCounter = 0;
            }
        } catch (recalcErr) {
            console.error("Failed to recalculate daily counter after delete:", recalcErr);
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

// POST /api/import
app.post('/api/import', async (req, res) => {
  const { records } = req.body;
  const record = records[0]; 

  const MAX_RETRIES = 5;
  let attempt = 0;
  let lastError = null;

  while (attempt < MAX_RETRIES) {
    try {
      let ccdNo = record.ccd_no;

      if (!ccdNo || !ccdNo.trim()) {
        const dateForSeq = record.created_at
          ? record.created_at.slice(0, 10)
          : new Date().toISOString().slice(0, 10);

        const { data: existing, error: fetchErr } = await supabase
          .from('registrations')
          .select('ccd_no')
          .gte('created_at', `${dateForSeq}T00:00:00`)
          .lte('created_at', `${dateForSeq}T23:59:59`);

        if (fetchErr) throw fetchErr;

        let maxSeq = 0;
        (existing || []).forEach(r => {
          if (r.ccd_no) {
            const parts = r.ccd_no.split('-');
            const seqNum = parseInt(parts[parts.length - 1], 10);
            if (!isNaN(seqNum) && seqNum > maxSeq) maxSeq = seqNum;
          }
        });

        const seq = String(maxSeq + 1).padStart(4, '0');
        ccdNo = `CCD-${dateForSeq}-${seq}`;
      }

      const { data: orderRows, error: orderErr } = await supabase
        .from('registrations')
        .select('queue_order')
        .order('queue_order', { ascending: false })
        .limit(1);

      if (orderErr) throw orderErr;
      const nextQueueOrder = orderRows?.[0]?.queue_order ? orderRows[0].queue_order + 1 : 1;

      const { data: inserted, error: insertErr } = await supabase
        .from('registrations')
        .insert([{ ...record, ccd_no: ccdNo, queue_order: nextQueueOrder }])
        .select();

      if (insertErr) {
        if (insertErr.code === '23505') {
          attempt++;
          lastError = insertErr;
          continue;
        }
        throw insertErr;
      }

      return res.json({ success: true, data: inserted[0] });
    } catch (err) {
      lastError = err;
      break;
    }
  }

  console.error('Insert failed after retries:', lastError);
  return res.status(500).json({ success: false, error: lastError?.message || 'Failed to insert record' });
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

app.delete('/api/feedbacks/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { error, count } = await supabase.from('feedbacks').delete({ count: 'exact' }).eq('id', id);
        if (error) throw error;
        if (count === 0) {
            return res.status(404).json({ success: false, error: 'Record not found or already deleted.' });
        }
        auditLog('Delete Feedback', `Deleted feedback record ID ${id}`);
        res.json({ success: true });
    } catch (err) {
        console.error("Feedback Delete Error:", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// === Auth Middleware ===
function verifyToken(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, error: 'No token provided' });
    }
    const token = authHeader.split(' ')[1];
    try {
        req.user = jwt.verify(token, process.env.JWT_SECRET);
        next();
    } catch (err) {
        return res.status(401).json({ success: false, error: 'Invalid or expired token' });
    }
}


function requireAdmin(req, res, next) {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ success: false, error: 'Admin access required' });
    }
    next();
}

// === Auth Endpoints ===
app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const { data: user, error } = await supabase
            .from('users')
            .select('*')
            .eq('username', username)
            .maybeSingle();

        if (error || !user) {
            return res.status(401).json({ success: false, error: 'Invalid credentials' });
        }

        if (user.is_active === false) {
            return res.status(403).json({ success: false, error: 'Invalid Credentials.' });
        }

        if (user.is_locked) {
            return res.status(423).json({
                success: false,
                error: 'This account is locked due to multiple failed login attempts. Please wait for an administrator to unlock it.',
                locked: true
            });
        }

        const match = await bcrypt.compare(password, user.password_hash);
        if (!match) {
            const attempts = (user.failed_login_attempts || 0) + 1;

            if (attempts >= 3) {
                await supabase.from('users').update({ failed_login_attempts: attempts, is_locked: true }).eq('id', user.id);
                await supabase.from('account_requests').insert([{ user_id: user.id, type: 'account_locked', status: 'pending' }]);
                auditLog('Account Locked', `${username} locked out after 3 failed attempts`);
                return res.status(423).json({
                    success: false,
                    error: 'Too many failed attempts. Your account has been locked. An administrator must unlock it before you can log in again.',
                    locked: true
                });
            }

            await supabase.from('users').update({ failed_login_attempts: attempts }).eq('id', user.id);
            const remaining = 3 - attempts;
            return res.status(401).json({
                success: false,
                error: `Invalid credentials. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining before lockout.`,
                attemptsRemaining: remaining
            });
        }

        if (user.failed_login_attempts && user.failed_login_attempts > 0) {
            await supabase.from('users').update({ failed_login_attempts: 0 }).eq('id', user.id);
        }

        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role, full_name: user.full_name },
            process.env.JWT_SECRET,
            { expiresIn: '8h' }
        );

        auditLog('Login', `${user.username} logged in`);

       res.json({
            success: true,
            token,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role,
                full_name: user.full_name,
                is_first_login: user.is_first_login,
                avatar_seed: user.avatar_seed
            }
        });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ success: false, error: 'Login failed' });
    }
});

app.post('/api/auth/forgot-password', async (req, res) => {
    try {
        const { username } = req.body;
        if (!username) {
            return res.status(400).json({ success: false, error: 'Username is required' });
        }

        const { data: user, error } = await supabase
            .from('users')
            .select('id, email, full_name')
            .eq('username', username)
            .maybeSingle();

        if (error || !user) {
            // Wag i-reveal kung existing ba yung username o wala
            return res.json({ success: true, message: 'If this account exists, a request has been sent to the administrator.' });
        }

        const { data: existingReq } = await supabase
            .from('account_requests')
            .select('id')
            .eq('user_id', user.id)
            .eq('type', 'forgot_password')
            .eq('status', 'pending')
            .maybeSingle();

        if (!existingReq) {
            await supabase.from('account_requests').insert([{ user_id: user.id, type: 'forgot_password', status: 'pending' }]);
            auditLog('Forgot Password', `Password reset requested by ${username}, forwarded to admin`);
        }

        res.json({ success: true, message: 'Your request has been sent to the administrator. You will be given a reset code once approved.' });
    } catch (err) {
        console.error('Forgot password error:', err);
        res.status(500).json({ success: false, error: 'Failed to process request' });
    }
});

app.post('/api/auth/reset-password', async (req, res) => {
    try {
        const { username, otp, newPassword } = req.body;
        if (!username || !otp || !newPassword) {
            return res.status(400).json({ success: false, error: 'All fields are required' });
        }

        const { data: user, error } = await supabase
            .from('users')
            .select('id, reset_otp, reset_otp_expires')
            .eq('username', username)
            .maybeSingle();

        if (error || !user || !user.reset_otp) {
            return res.status(400).json({ success: false, error: 'Invalid or expired code' });
        }

        if (user.reset_otp !== otp) {
            return res.status(400).json({ success: false, error: 'Invalid or expired code' });
        }

        if (new Date(user.reset_otp_expires) < new Date()) {
            return res.status(400).json({ success: false, error: 'Code has expired. Please request a new one.' });
        }

        const hash = await bcrypt.hash(newPassword, 10);
        const { error: updateErr } = await supabase
            .from('users')
            .update({ password_hash: hash, is_first_login: false, reset_otp: null, reset_otp_expires: null })
            .eq('id', user.id);
        if (updateErr) throw updateErr;

        auditLog('Reset Password', `Password reset via OTP for username ${username}`);
        res.json({ success: true });
    } catch (err) {
        console.error('Reset password error:', err);
        res.status(500).json({ success: false, error: 'Failed to reset password' });
    }
});

app.post('/api/auth/change-password', verifyToken, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword) {
            return res.status(400).json({ success: false, error: 'Current password is required' });
        }

        const { data: existingUser, error: fetchErr } = await supabase
            .from('users')
            .select('password_hash')
            .eq('id', req.user.id)
            .single();

        if (fetchErr || !existingUser) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        const match = await bcrypt.compare(currentPassword, existingUser.password_hash);
        if (!match) {
            return res.status(401).json({ success: false, error: 'Current password is incorrect' });
        }

        const hash = await bcrypt.hash(newPassword, 10);

        const { error } = await supabase
            .from('users')
            .update({ password_hash: hash, is_first_login: false })
            .eq('id', req.user.id);

        if (error) throw error;
        auditLog('Change Password', `${req.user.email} changed password`);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Failed to change password' });
    }
});

app.post('/api/auth/avatar-seed', verifyToken, async (req, res) => {
    try {
        const { avatarSeed } = req.body;
        if (!avatarSeed || typeof avatarSeed !== 'string' || avatarSeed.length > 100) {
            return res.status(400).json({ success: false, error: 'Invalid avatar seed' });
        }

        const { error } = await supabase
            .from('users')
            .update({ avatar_seed: avatarSeed })
            .eq('id', req.user.id);

        if (error) {
            console.error('Avatar seed update error:', error);
            throw error;
        }
        auditLog('Update Avatar', `${req.user.email || req.user.username} changed avatar`);
        res.json({ success: true, avatarSeed });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Failed to update avatar' });
    }
});

async function sendAccountCredentialsEmail(toEmail, displayName, username, password, role) {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        console.warn('[Email] EMAIL_USER/EMAIL_PASS not set — skipping account email');
        return { success: false, error: 'Email not configured' };
    }
    if (!toEmail) {
        return { success: false, error: 'No email provided' };
    }

    try {
        const info = await emailTransporter.sendMail({
            from: `"NBI Cybercrime Division" <${process.env.EMAIL_USER}>`,
            to: toEmail,
            subject: `NBI Cybercrime Division — Your Account Credentials`,
            text: `Hello, ${displayName}!\n\nAn account has been created for you on the NBI Cybercrime Division Queue System.\n\nRole: ${role}\nUsername: ${username}\nDefault Password: ${password}\n\nYou will be required to change this password on your first login.\n\nNBI Cybercrime Division\nThis is an automated message. Please do not reply to this email.`,
            html: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /></head>
<body style="margin:0; padding:0; background-color:#eef0f3; font-family: Arial, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#eef0f3; padding: 24px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="500" cellpadding="0" cellspacing="0" style="background-color:#ffffff; border-radius: 8px; overflow:hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.08); max-width:500px; width:100%;">
          <tr>
            <td style="background: linear-gradient(135deg, #0b1f4d 0%, #142d6e 100%); padding: 24px 32px; border-bottom: 4px solid #f0a500;">
              <p style="margin:0; color:#ffffff; font-size:18px; font-weight:bold;">NBI Cybercrime Division</p>
              <p style="margin:2px 0 0 0; color:#c9d4ec; font-size:13px;">Account Created</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px;">
              <p style="font-size:14.5px; color:#333;">Hello, <strong>${displayName}</strong>,</p>
              <p style="font-size:14px; color:#333; line-height:1.6;">An account has been created for you on the Queue System. Use the credentials below to log in.</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0b1f4d; border-radius:8px; border: 2px solid #f0a500; margin: 20px 0;">
                <tr>
                  <td style="padding: 18px 22px;">
                    <p style="margin:0 0 8px 0; color:#c9d4ec; font-size:12px;">Role: <strong style="color:#f0a500;">${role}</strong></p>
                    <p style="margin:0 0 8px 0; color:#c9d4ec; font-size:12px;">Username: <strong style="color:#ffffff;">${username}</strong></p>
                    <p style="margin:0; color:#c9d4ec; font-size:12px;">Default Password: <strong style="color:#ffffff;">${password}</strong></p>
                  </td>
                </tr>
              </table>
              <p style="font-size:12.5px; color:#888;">You will be required to change this password on your first login.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
        });
        console.log('[Email] ✓ Account credentials sent to', toEmail, '- message_id:', info.messageId);
        return { success: true };
    } catch (err) {
        console.error('[Email] Account email exception:', err.message);
        return { success: false, error: err.message };
    }
}

// === User Management (Admin Only) ===
app.get('/api/users', verifyToken, requireAdmin, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('users')
            .select('id, username, email, role, full_name, is_first_login, created_at, is_active, deactivated_at, is_locked, failed_login_attempts, avatar_seed')
            .order('created_at', { ascending: false });
        if (error) throw error;
        res.json({ success: true, data });
    } catch (err) {
        console.error('Error fetching users:', err);
        res.status(500).json({ success: false, error: err.message || 'Failed to fetch users' });
    }
});

app.post('/api/users', verifyToken, requireAdmin, async (req, res) => {
    try {
        const { username, email, full_name, role } = req.body;

        if (!username || !full_name || !role) {
            return res.status(400).json({ success: false, error: 'Username, full name, and role are required' });
        }

        if (role === 'admin' && !email) {
            return res.status(400).json({ success: false, error: 'Email is required for admin accounts' });
        }

        const finalEmail = role === 'admin' ? email : null;

        const defaultPassword = 'NBIagent123';
        const hash = await bcrypt.hash(defaultPassword, 10);

        const { data, error } = await supabase
            .from('users')
            .insert([{ id: crypto.randomUUID(), username, email: finalEmail, full_name, role, password_hash: hash, is_first_login: true }])
            .select()
            .single();

        if (error) {
            console.error('Create user DB error:', error);

            if (error.code === '23505') {
                if (error.message && error.message.includes('email')) {
                    return res.status(400).json({ success: false, error: 'That email is already used by another account.' });
                }
                return res.status(400).json({ success: false, error: 'That username is already taken. Please choose another.' });
            }
            if (error.code === '23502') {
                const missingField = error.message && error.message.match(/column "(\w+)"/)?.[1];
                const fieldLabels = { email: 'Email', username: 'Username', full_name: 'Full name', role: 'Role' };
                const label = fieldLabels[missingField] || 'A required field';
                return res.status(400).json({ success: false, error: `${label} is required.` });
            }

            return res.status(500).json({ success: false, error: 'Something went wrong while creating the account. Please try again.' });
        }

        auditLog('Create User', `${req.user.username} created account for ${username}`);

        let emailSent = false;
        if (finalEmail) {
            const emailResult = await sendAccountCredentialsEmail(finalEmail, full_name, username, defaultPassword, role);
            emailSent = emailResult.success;
        }

        res.json({ success: true, data, defaultPassword, emailSent });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.post('/api/users/:id/deactivate', verifyToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { error } = await supabase
            .from('users')
            .update({ is_active: false, deactivated_at: new Date().toISOString() })
            .eq('id', id);
        if (error) throw error;
        auditLog('Deactivate User', `${req.user.username} deactivated user ${id}`);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Failed to deactivate user' });
    }
});

app.post('/api/users/:id/reactivate', verifyToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { error } = await supabase
            .from('users')
            .update({ is_active: true, deactivated_at: null })
            .eq('id', id);
        if (error) throw error;
        auditLog('Reactivate User', `${req.user.username} reactivated user ${id}`);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Failed to reactivate user' });
    }
});

app.post('/api/users/admin-reset', verifyToken, requireAdmin, async (req, res) => {
    try {
        const { userId } = req.body;
        const defaultPassword = 'NBIagent123';
        const hash = await bcrypt.hash(defaultPassword, 10);

        const { error } = await supabase
            .from('users')
            .update({ password_hash: hash, is_first_login: true })
            .eq('id', userId);

        if (error) throw error;
        auditLog('Admin Reset Password', `${req.user.email} reset password for user ${userId}`);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Reset failed' });
    }
});

app.put('/api/users/:id/username', verifyToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { username } = req.body;

        if (!username || !username.trim()) {
            return res.status(400).json({ success: false, error: 'Username is required' });
        }

        const { data, error } = await supabase
            .from('users')
            .update({ username: username.trim() })
            .eq('id', id)
            .select()
            .single();

        if (error) {
            if (error.code === '23505') {
                return res.status(400).json({ success: false, error: 'That username is already taken.' });
            }
            throw error;
        }

        auditLog('Edit Username', `${req.user.username} changed username of ${id} to ${username.trim()}`);
        res.json({ success: true, data });
    } catch (err) {
        console.error('Error updating username:', err);
        res.status(500).json({ success: false, error: 'Failed to update username' });
    }
});

// === Account Requests (Forgot Password / Locked Account) — Admin Only ===
app.get('/api/account-requests', verifyToken, requireAdmin, async (req, res) => {
    try {
        const { data: requests, error } = await supabase
            .from('account_requests')
            .select('*')
            .eq('status', 'pending')
            .order('created_at', { ascending: true });
        if (error) throw error;

        const userIds = [...new Set((requests || []).map(r => r.user_id).filter(Boolean))];
        let usersMap = {};
        if (userIds.length > 0) {
            const { data: usersData, error: usersErr } = await supabase
                .from('users')
                .select('id, username, full_name, email, role')
                .in('id', userIds);
            if (usersErr) throw usersErr;
            (usersData || []).forEach(u => { usersMap[u.id] = u; });
        }

        const data = (requests || []).map(r => ({ ...r, users: usersMap[r.user_id] || null }));

        res.json({ success: true, data });
    } catch (err) {
        console.error('Fetch account requests error:', err);
        res.status(500).json({ success: false, error: 'Failed to fetch requests' });
    }
});
app.post('/api/account-requests/:id/accept', verifyToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { email } = req.body;

        const { data: reqRow, error: fetchErr } = await supabase
            .from('account_requests')
            .select('*')
            .eq('id', id)
            .maybeSingle();
        if (fetchErr || !reqRow) {
            return res.status(404).json({ success: false, error: 'Request not found' });
        }

        const { data: targetUser, error: userFetchErr } = await supabase
            .from('users')
            .select('id, username, full_name, email')
            .eq('id', reqRow.user_id)
            .maybeSingle();
        if (userFetchErr || !targetUser) {
            return res.status(404).json({ success: false, error: 'Associated user not found' });
        }

        if (reqRow.type === 'forgot_password') {
            if (!email) {
                return res.status(400).json({ success: false, error: "The agent's email is required to send the reset code." });
            }
            const otp = generateOtp();
            const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString();

            await supabase
                .from('users')
                .update({ reset_otp: otp, reset_otp_expires: expires, email })
                .eq('id', targetUser.id);

            await sendOtpEmail(email, targetUser.full_name, otp);
            auditLog('Approve Forgot Password', `${req.user.username} approved reset for ${targetUser.username}, sent to ${email}`);
        } else if (reqRow.type === 'account_locked') {
            await supabase
                .from('users')
                .update({ is_locked: false, failed_login_attempts: 0 })
                .eq('id', targetUser.id);
            auditLog('Unlock Account', `${req.user.username} unlocked ${targetUser.username}`);
        }

        await supabase
            .from('account_requests')
            .update({ status: 'completed', resolved_at: new Date().toISOString() })
            .eq('id', id);

        res.json({ success: true });
    } catch (err) {
        console.error('Accept account request error:', err);
        res.status(500).json({ success: false, error: 'Failed to process request' });
    }
});

app.post('/api/account-requests/:id/reject', verifyToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        await supabase
            .from('account_requests')
            .update({ status: 'rejected', resolved_at: new Date().toISOString() })
            .eq('id', id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Failed to reject request' });
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

            // Kunin ang pinakamataas na existing seq ngayong araw mula DB
            // (hindi na umaasa sa in-memory dailyCounter, para consistent
            // sa parehong logic ng /api/import at hindi nade-desync)
            const { data: existingToday, error: existingErr } = await supabase
                .from('registrations')
                .select('ccd_no')
                .like('ccd_no', `CCD-${todayStr}-%`);
            if (existingErr) throw existingErr;

            let maxSeq = 0;
            (existingToday || []).forEach(r => {
                if (r.ccd_no) {
                    const parts = r.ccd_no.split('-');
                    const seqNum = parseInt(parts[parts.length - 1], 10);
                    if (!isNaN(seqNum) && seqNum > maxSeq) maxSeq = seqNum;
                }
            });
            state.dailyCounter = maxSeq + 1;
            const ccdNo = `CCD-${todayStr}-${String(state.dailyCounter).padStart(4, '0')}`;
            const isPriority = formData.isPriority === true || formData.isPriority === 'true';

            // Kunin ang pinakamataas na queue_order overall, +1 sa bago
            const { data: orderRows, error: orderErr } = await supabase
                .from('registrations')
                .select('queue_order')
                .order('queue_order', { ascending: false })
                .limit(1);
            if (orderErr) throw orderErr;
            const nextQueueOrder = orderRows?.[0]?.queue_order ? orderRows[0].queue_order + 1 : 1;

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
                        registration_duration: formData.registrationDuration || null,
                        queue_order: nextQueueOrder
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

cron.schedule('0 0 * * *', async () => {
    await broadcastStaffUpdate();
    broadcastDisplayUpdate(false);
    console.log(`========== MIDNIGHT DAILY RESET COMPLETE ==========\n\n`);
}, {
    timezone: "Asia/Manila"
});

// Auto-delete accounts deactivated 30+ days ago — runs daily at midnight
cron.schedule('0 0 * * *', async () => {
    try {
        const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        const { data, error } = await supabase
            .from('users')
            .delete()
            .eq('is_active', false)
            .lt('deactivated_at', cutoff)
            .select('id, username');

        if (error) {
            console.error('❌ Error auto-deleting deactivated accounts:', error);
        } else if (data && data.length > 0) {
            console.log(`✅ Auto-deleted ${data.length} account(s) deactivated 30+ days ago:`, data.map(u => u.username).join(', '));
            auditLog('Auto-Delete Accounts', `Deleted ${data.length} account(s): ${data.map(u => u.username).join(', ')}`);
        }
    } catch (err) {
        console.error('❌ Exception in auto-delete deactivated accounts job:', err);
    }
}, {
    timezone: "Asia/Manila"
});

function maskEmail(email) {
    if (!email || !email.includes('@')) return '';
    const [local, domain] = email.split('@');
    if (local.length <= 2) {
        return `${local[0]}***@${domain}`;
    }
    const first = local[0];
    const last = local[local.length - 1];
    const stars = '*'.repeat(Math.max(3, local.length - 2));
    return `${first}${stars}${last}@${domain}`;
}

function generateOtp() {
    return String(Math.floor(100000 + Math.random() * 900000)); // 6-digit
}

async function sendOtpEmail(toEmail, displayName, otp) {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        console.warn('[Email] EMAIL_USER/EMAIL_PASS not set — skipping OTP email');
        return { success: false, error: 'Email not configured' };
    }

    try {
        const info = await emailTransporter.sendMail({
            from: `"NBI Cybercrime Division" <${process.env.EMAIL_USER}>`,
            to: toEmail,
            subject: `NBI Cybercrime Division — Password Reset Code: ${otp}`,
            text: `Hello, ${displayName}!\n\nYour password reset code is: ${otp}\n\nThis code will expire in 10 minutes. If you did not request this, please ignore this email or contact your administrator.\n\nNBI Cybercrime Division\nThis is an automated message. Please do not reply to this email.`,
            html: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /></head>
<body style="margin:0; padding:0; background-color:#eef0f3; font-family: Arial, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#eef0f3; padding: 24px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="500" cellpadding="0" cellspacing="0" style="background-color:#ffffff; border-radius: 8px; overflow:hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.08); max-width:500px; width:100%;">
          <tr>
            <td style="background: linear-gradient(135deg, #0b1f4d 0%, #142d6e 100%); padding: 24px 32px; border-bottom: 4px solid #f0a500;">
              <p style="margin:0; color:#ffffff; font-size:18px; font-weight:bold;">NBI Cybercrime Division</p>
              <p style="margin:2px 0 0 0; color:#c9d4ec; font-size:13px;">Password Reset Request</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px;">
              <p style="font-size:14.5px; color:#333;">Hello, <strong>${displayName}</strong>,</p>
              <p style="font-size:14px; color:#333; line-height:1.6;">Use the code below to reset your password. This code expires in 10 minutes.</p>
              <div style="text-align:center; margin: 24px 0;">
                <span style="display:inline-block; background:#0b1f4d; color:#f0a500; font-size:32px; font-weight:bold; letter-spacing:6px; padding: 16px 24px; border-radius:8px; border: 2px solid #f0a500;">${otp}</span>
              </div>
              <p style="font-size:12.5px; color:#888;">If you did not request a password reset, please ignore this email or contact your administrator immediately.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
        });
        console.log('[Email] ✓ OTP sent to', toEmail, '- message_id:', info.messageId);
        return { success: true };
    } catch (err) {
        console.error('[Email] OTP send exception:', err.message);
        return { success: false, error: err.message };
    }
}

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

app.get(/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, '../client/dist/index.html'));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
