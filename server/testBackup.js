require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const exceljs = require('exceljs');
const nodemailer = require('nodemailer');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
const fs = require('fs');
const path = require('path');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const SPREADSHEET_ID = '1qVE1MRGxGKz-rdeuwOWb1kB6nq3sR7k6iDgB9wrBhGY';
const BOSS_EMAIL = 'sesedee2026@gmail.com';

const emailTransporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

async function runTestBackup() {
    console.log('[Test Backup] Starting TEST backup (forces today\'s records to sync)...');

    // Force cutoff date to tomorrow so it captures everything registered today
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() + 1);
    
    console.log(`[Test Backup] Cutoff Date forced to: ${cutoffDate.toISOString()}`);

    // Fetch records
    const { data: records, error } = await supabase
        .from('registrations')
        .select(`
            *,
            agent_remarks (
                interviewer,
                text,
                is_actionable,
                case_type,
                subject
            )
        `)
        .lt('created_at', cutoffDate.toISOString());

    if (error) {
        console.error('[Test Backup] Error fetching records:', error);
        return;
    }

    if (!records || records.length === 0) {
        console.log('[Test Backup] No records found in Supabase. Please register someone first!');
        return;
    }

    console.log(`[Test Backup] Found ${records.length} records to test.`);

    const columns = [
        { header: 'ID', key: 'id', width: 36 },
        { header: 'CCD No', key: 'ccd_no', width: 15 },
        { header: 'Full Name', key: 'full_name', width: 30 },
        { header: 'Contact', key: 'contact', width: 20 },
        { header: 'Age', key: 'age', width: 10 },
        { header: 'Email', key: 'email', width: 30 },
        { header: 'Civil Status', key: 'civil_status', width: 15 },
        { header: 'Gender', key: 'gender', width: 15 },
        { header: 'Is Priority', key: 'is_priority', width: 15 },
        { header: 'Status', key: 'status', width: 15 },
        { header: 'Created At', key: 'created_at', width: 25 },
        { header: 'Address', key: 'address', width: 30 },
        { header: 'Purpose', key: 'purpose', width: 20 },
        { header: 'Referred By', key: 'referred_by', width: 20 },
        { header: 'Region', key: 'region', width: 15 },
        { header: 'Serving Duration', key: 'serving_duration', width: 20 },
        { header: 'Registration Duration', key: 'registration_duration', width: 20 },
        { header: 'E-Signature', key: 'e_signature', width: 15 },
        { header: 'Interviewer', key: 'interviewer', width: 20 },
        { header: 'Agent Remarks', key: 'agent_remarks_text', width: 40 },
        { header: 'Actionable', key: 'is_actionable', width: 15 },
        { header: 'Case Type', key: 'case_type', width: 20 },
        { header: 'Subject', key: 'subject', width: 20 }
    ];

    try {
        // Generate Excel
        const workbook = new exceljs.Workbook();
        const worksheet = workbook.addWorksheet('Registrations Backup');
        worksheet.columns = columns;

        records.forEach(r => {
            const remarkObj = Array.isArray(r.agent_remarks) ? r.agent_remarks[0] : r.agent_remarks;
            
            worksheet.addRow({
                ...r,
                is_priority: r.is_priority ? 'Yes' : 'No',
                created_at: new Date(r.created_at).toLocaleString(),
                e_signature: r.e_signature ? 'Signed' : 'None',
                interviewer: remarkObj?.interviewer || 'None',
                agent_remarks_text: remarkObj?.text || 'None',
                is_actionable: remarkObj?.is_actionable || 'None',
                case_type: remarkObj?.case_type || 'None',
                subject: remarkObj?.subject || 'None'
            });
        });

        // 3b. Generate Signatures HTML Backup
        let htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Complainant Signatures Backup</title>
    <style>
        body { font-family: 'Helvetica Neue', Arial, sans-serif; padding: 20px; background-color: #f8f9fa; color: #333; }
        h2 { text-align: center; color: #2c3e50; }
        .date-info { text-align: center; margin-bottom: 20px; color: #7f8c8d; font-size: 0.9em; }
        table { width: 100%; border-collapse: collapse; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,0.1); border-radius: 8px; overflow: hidden; margin-top: 20px; }
        th, td { padding: 12px 15px; text-align: left; border-bottom: 1px solid #e0e0e0; }
        th { background-color: #34495e; color: #fff; font-weight: 600; text-transform: uppercase; font-size: 0.85em; }
        tr:hover { background-color: #f1f2f6; }
        .sig-container { background: #fff; border: 1px solid #ddd; padding: 5px; border-radius: 4px; display: inline-block; }
        .sig-img { max-height: 80px; max-width: 250px; display: block; }
        .no-sig { color: #95a5a6; font-style: italic; }
    </style>
</head>
<body>
    <h2>NBI Queue System - Complainant Signatures Backup</h2>
    <div class="date-info">Generated on ${new Date().toLocaleString()} (Records older than ${cutoffDate.toLocaleDateString()})</div>
    <table>
        <thead>
            <tr>
                <th style="width: 15%">Date & Time</th>
                <th style="width: 10%">CCD No</th>
                <th style="width: 25%">Full Name</th>
                <th style="width: 20%">Remarks / Subject</th>
                <th style="width: 30%">E-Signature</th>
            </tr>
        </thead>
        <tbody>
`;

        records.forEach(r => {
            const formattedDate = new Date(r.created_at).toLocaleString();
            const sigCell = r.e_signature 
                ? `<div class="sig-container"><img class="sig-img" src="${r.e_signature}" alt="Signature"></div>`
                : '<span class="no-sig">No signature provided</span>';
            
            const remarkObj = Array.isArray(r.agent_remarks) ? r.agent_remarks[0] : r.agent_remarks;
            const remarksHtml = remarkObj?.text 
                ? `<strong>${remarkObj.subject || 'No Subject'}</strong><br><small>${remarkObj.text}</small>`
                : '<span class="no-sig">No remarks</span>';
            
            htmlContent += `
            <tr>
                <td>${formattedDate}</td>
                <td><strong>${r.ccd_no || 'N/A'}</strong></td>
                <td>${r.full_name || 'N/A'}</td>
                <td>${remarksHtml}</td>
                <td>${sigCell}</td>
            </tr>\n`;
        });

        htmlContent += `
        </tbody>
    </table>
</body>
</html>
`;

        const htmlBuffer = Buffer.from(htmlContent, 'utf-8');

        // 4. Send Email
        const timestamp = Date.now();
        const buffer = await workbook.xlsx.writeBuffer();
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: BOSS_EMAIL,
            subject: `Weekly NBI Queue System Report (Older than ${cutoffDate.toLocaleDateString()})`,
            text: `Attached is the automated backup report containing ${records.length} records.\n\nThese records have been synced to Google Sheets and removed from the active database to preserve storage.\n\nTo view complainant signatures, open the attached file "NBI_Queue_Signatures_${timestamp}.html" in your browser.`,
            attachments: [
                {
                    filename: `NBI_Queue_Backup_${timestamp}.xlsx`,
                    content: buffer
                },
                {
                    filename: `NBI_Queue_Signatures_${timestamp}.html`,
                    content: htmlBuffer
                }
            ]
        };

        if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
            await emailTransporter.sendMail(mailOptions);
            console.log('[Test Backup] TEST Email sent successfully to', BOSS_EMAIL);
        } else {
            console.log('[Test Backup] Skipping Email: Credentials not set in .env.');
        }

        // Sync to GSheets
        const credsPath = path.join(__dirname, 'service-account.json');
        if (fs.existsSync(credsPath)) {
            const creds = require(credsPath);
            const serviceAccountAuth = new JWT({
                email: creds.client_email,
                key: creds.private_key,
                scopes: ['https://www.googleapis.com/auth/spreadsheets'],
            });

            const doc = new GoogleSpreadsheet(SPREADSHEET_ID, serviceAccountAuth);
            await doc.loadInfo();
            const sheet = doc.sheetsByIndex[0];

            try {
                await sheet.setHeaderRow(columns.map(c => c.header));
            } catch (e) {}

            const sheetRows = records.map(r => {
                const remarkObj = Array.isArray(r.agent_remarks) ? r.agent_remarks[0] : r.agent_remarks;
                return {
                    'ID': r.id,
                    'CCD No': r.ccd_no,
                    'Full Name': r.full_name,
                    'Contact': r.contact,
                    'Age': r.age,
                    'Email': r.email,
                    'Civil Status': r.civil_status,
                    'Gender': r.gender,
                    'Is Priority': r.is_priority ? 'Yes' : 'No',
                    'Status': r.status,
                    'Created At': new Date(r.created_at).toLocaleString(),
                    'Address': r.address,
                    'Purpose': r.purpose,
                    'Referred By': r.referred_by,
                    'Region': r.region,
                    'Serving Duration': r.serving_duration,
                    'Registration Duration': r.registration_duration,
                    'E-Signature': r.e_signature ? 'Signed' : 'None',
                    'Interviewer': remarkObj?.interviewer || 'None',
                    'Agent Remarks': remarkObj?.text || 'None',
                    'Actionable': remarkObj?.is_actionable || 'None',
                    'Case Type': remarkObj?.case_type || 'None',
                    'Subject': remarkObj?.subject || 'None'
                };
            });

            await sheet.addRows(sheetRows);
            console.log('[Test Backup] TEST Synced successfully to Google Sheets!');
        } else {
            console.log('[Test Backup] Skipping Google Sheets: service-account.json not found.');
        }

        console.log('[Test Backup] TEST process complete. Note: We DID NOT delete the records from Supabase for this test.');

    } catch (err) {
        console.error('[Test Backup] TEST failed:', err);
    }
}

runTestBackup();
