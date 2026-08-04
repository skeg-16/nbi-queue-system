import { useEffect, useMemo, useRef, useState } from 'react';

import { useNavigate, useLocation } from 'react-router-dom';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import Sidebar from '../components/Sidebar';

// ---------- Static data ----------
const CASE_TYPE_OPTIONS = [
  { value: 'Alleged Violation of Sec. 4 (a)(3) "Data Interference" under R.A. 10175 otherwise known as "Cybercrime Prevention Act of 2012".', label: 'Data Interference (Sec. 4a3, R.A. 10175)' },
  { value: 'Alleged Violation of Sec. 4 (a)(1) "Illegal Access" under R.A. 10175 otherwise known as "Cybercrime Prevention Act of 2012"', label: 'Illegal Access (Sec. 4a1, R.A. 10175)' },
  { value: 'Alleged Violation of Sec. 4 (b)(2) "Computer related Fraud" under R.A. 10175 otherwise known as "Cybercrime Prevention Act of 2012"', label: 'Computer-related Fraud (Sec. 4b2, R.A. 10175)' },
  { value: 'Alleged Violation of Sec. 4 Sec (b)(3) "Computer related Identity Theft" under R.A. 10175 otherwise known as "Cybercrime Prevention Act of 2012"', label: 'Computer-related Identity Theft (Sec. 4b3, R.A. 10175)' },
  { value: 'Alleged Violation of Sec. 4(b)(1)(i) "Computer-related Forgery" under R.A. 10175 otherwise known as "Cybercrime Prevention Act of 2012"', label: 'Computer-related Forgery (Sec. 4b1i, R.A. 10175)' },
  { value: 'Alleged Violation of Sec. 4(c)(4) "Libel" under R.A. 10175 otherwise known as "Cybercrime Prevention Act of 2012" and R.A. 9995 otherwise known as "Anti-Photo and Video Voyeurism Act of 2009".', label: 'Libel (Sec. 4c4, R.A. 10175 & R.A. 9995)' },
  { value: 'Alleged R.A. 8484 otherwise known as "Access Devices Regulation Act of 1998" in relation to RA 10175 otherwise known as "Cybercrime Prevention Act of 2012"', label: 'Access Devices Regulation Act (R.A. 8484)' },
  { value: 'Alleged Violation of Harassment and Article 282 "Grave Threat" of the Revised Penal Code (RPC) in relation to Sec. 6 of R.A. 10175 otherwise known as "Cybercrime Prevention Act of 2012"', label: 'Harassment & Grave Threat (Art. 282, RPC)' },
  { value: 'Alleged Violation of Article 282 "Grave Threat" of the Revised Penal Code (RPC) in relation to Sec. 6 of R.A. 10175 otherwise known as "Cybercrime Prevention Act of 2012"', label: 'Grave Threat (Art. 282, RPC)' },
  { value: 'Alleged Violation of Sec. 4(c)(4) "Libel "under R.A. 10175 otherwise known as "Cybercrime Prevention Act of 2012"', label: 'Libel (Sec. 4c4, R.A. 10175)' },
  { value: 'Alleged Violation of Article 283 of the RPC otherwise known as "Light Threats\' in relation to R.A. 10175 otherwise known as the "Cybercrime Prevention Act of 2012"', label: 'Light Threats (Art. 283, RPC)' },
  { value: 'Alleged Violation of Art. 315 "Estafa" of the Revised Penal Code in relation to R.A. 10175 otherwise known as "Cybercrime Prevention Act of 2012"', label: 'Estafa (Art. 315, RPC)' },
  { value: 'Alleged Violation of Art. 287 of the Revised Penal Code "Unjust Vexation" in relation to R.A. 10175 otherwise known as "Cybercrime Prevention Act of 2012"', label: 'Unjust Vexation (Art. 287, RPC)' },
  { value: 'RA 9775 is known as the "Anti-Child Pornography Act of 2009" in relation to R.A. 10175 otherwise known as "Cybercrime Prevention Act of 2012"', label: 'Anti-Child Pornography Act (R.A. 9775)' },
  { value: 'RA 9165 is known as the Comprehensive Dangerous Drugs Act of 2002" in relation to R.A. 10175 otherwise known as "Cybercrime Prevention Act of 2012"', label: 'Comprehensive Dangerous Drugs Act (R.A. 9165)' },
  { value: 'Alleged Violation of RA 9995 "Anti-Photo and Video Voyeurism Act of 2009" in relation to R.A. 10175 otherwise known as "Cybercrime Prevention Act of 2012"', label: 'Anti-Photo and Video Voyeurism Act (R.A. 9995)' },
  { value: 'Alleged Violation of Harassment; and Art. 294 (Robbery with Intimidation of Persons) of the Revised Penal Code R.A. 10175 otherwise known as "Cybercrime Prevention Act of 2012"', label: 'Harassment & Robbery w/ Intimidation (Art. 294, RPC)' },
  { value: 'Alleged Violation of Sec. 261(a) "Vote Buying & Vote-Selling" under BP. BLG. 881 (Omnibus Election Code)".', label: 'Vote Buying & Vote-Selling (Sec. 261a, Omnibus Election Code)' },
  { value: '__custom__', label: 'Other (specify)...' }
];

const CAUSES_OPTIONS = [
  { value: 'Inquire only', label: 'Inquire only' },
  { value: 'for Direct filing', label: 'for Direct filing' },
  { value: 'No Workable lead', label: 'No Workable lead' },
  { value: 'Not The proper Person fo File the case', label: 'Not The proper Person fo File the case' },
  { value: 'to return with Sufficient document', label: 'to return with Sufficient document' },
  { value: 'Refered to SEC', label: 'Refered to SEC' },
  { value: 'Reffered to BSP', label: 'Reffered to BSP' },
  { value: 'For records Purposes only (Identity Theft)', label: 'For records Purposes only (Identity Theft)' },
  { value: '__custom__', label: 'other (Specific)...' }
];

const REGION_OPTIONS = [
  'NCR',
  'CAR',
  'Region I',
  'Region II',
  'Region III',
  'Region IV-A',
  'Region IV-B',
  'Region V',
  'Region VI',
  'Region VII',
  'Region VIII',
  'Region IX',
  'Region X',
  'Region XI',
  'Region XII',
  'Region XIII',
  'BARMM'
];

const DEFAULT_GLOBAL_COLORS = {
  Served: { bg: '#064e3b', txt: '#34d399' },
  Waiting: { bg: '#1e3a8a', txt: '#60a5fa' },
  Skipped: { bg: '#7f1d1d', txt: '#f87171' },
  'No-show': { bg: '#374151', txt: '#9ca3af' },
  Serving: { bg: '#78350f', txt: '#fbbf24' },
  YES: { bg: '#064e3b', txt: '#34d399' },
  NO: { bg: '#7f1d1d', txt: '#f87171' }
};

const SQD_MAP = {
  'Strongly Agree': 5, Agree: 4, 'Neither Agree nor Disagree': 3, Disagree: 2, 'Strongly Disagree': 1
};

function getViewDateString(dateObj) {
  const offset = dateObj.getTimezoneOffset();
  const localDate = new Date(dateObj.getTime() - offset * 60 * 1000);
  return localDate.toISOString().split('T')[0];
}

function getAssessmentText(r) {
  const rd = r._remarksData || {};
  let isActionable = rd.isActionable !== undefined && rd.isActionable !== null && rd.isActionable !== ''
    ? rd.isActionable
    : r.isActionable;
  isActionable = (isActionable || '').toString().trim().toLowerCase();

  const caseType = rd.caseType || r.caseType || '';
  const subject = rd.subject || '';
  const remarksTxt = rd.text || '';

  if (isActionable === 'yes') {
    let text = `Case Type: ${caseType || 'N/A'}`;
    if (subject) text += ` | Subject: ${subject}`;
    return text;
  } else if (isActionable === 'no') {
    return remarksTxt ? `Remarks: ${remarksTxt}` : 'Not Actionable';
  }
  return 'Not Assessed';
}

function getGlobalColors() {
  try {
    const saved = localStorage.getItem('nbi_global_colors');
    if (saved) return JSON.parse(saved);
  } catch (e) { /* ignore */ }
  return JSON.parse(JSON.stringify(DEFAULT_GLOBAL_COLORS));
}

function DurationInput({ defaultValue, field, recordId, updateCell, showToast }) {
  const [val, setVal] = useState(defaultValue || '');

  useEffect(() => {
    setVal(defaultValue || '');
  }, [defaultValue]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      const trimmed = val.trim();
      if (trimmed !== '' && !/^\d{2}:\d{2}$/.test(trimmed)) {
        showToast('Invalid format. Please use MM:SS (e.g. 02:26)', true);
        return;
      }
      updateCell(recordId, field, trimmed);
      e.target.blur();
    } else if (e.key === 'Escape') {
      setVal(defaultValue || '');
      e.target.blur();
    }
  };

  const handleBlur = (e) => {
    if (val.trim() !== (defaultValue || '').trim()) {
      showToast('Press Enter to save the time', false, 'info');
      setVal(defaultValue || '');
    }
  };

  return (
    <input
      type="text"
      value={val}
      onChange={e => setVal(e.target.value.replace(/[^0-9:]/g, ''))}
      onKeyDown={handleKeyDown}
      onBlur={handleBlur}
      placeholder="-"
      style={{ width: 50, textAlign: 'center', border: '1px solid var(--border-color)', borderRadius: 4, padding: 4, background: 'transparent', color: 'var(--text-main)', fontFamily: 'monospace' }}
    />
  );
}
export default function Records() {
  useEffect(() => { document.title = "Complaint Registry | NBI QMS"; }, []);
  const socket = useSocket();
  const { user, logout } = useAuth();
  const isAdmin = user?.role === 'admin';
  const navigate = useNavigate();
  const location = useLocation();

  
  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // --- Core data state ---
  const [allRecords, setAllRecords] = useState([]);
  const [lastFetchTime, setLastFetchTime] = useState(null);
  const [isConnected, setIsConnected] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [currentView, setCurrentView] = useState('complaints'); // complaints | feedback_en | feedback_tl

  // --- View/nav state ---
  const [viewDateObj, setViewDateObj] = useState(new Date());
  const [calDateObj, setCalDateObj] = useState(new Date());
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarPos, setCalendarPos] = useState({ top: 0, left: 0 });
  const [openTabs, setOpenTabs] = useState([]);

  // --- Filters/sort ---
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPriority, setFilterPriority] = useState(false);
  const [sortColumn, setSortColumn] = useState('created_at');
  const [sortAsc, setSortAsc] = useState(false);

  // --- Pagination ---
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [modalDailyReminder, setModalDailyReminder] = useState(false);

useEffect(() => {
    setCurrentPage(1);
    setSelectedRows(new Set());
  }, [searchTerm, filterStatus, filterPriority, currentView, viewDateObj]);

  useEffect(() => {
    setIsLoading(true);
  }, [currentView]);

  // --- Global colors ---
  const [globalColors, setGlobalColors] = useState(getGlobalColors());

  // --- Modals ---
  const [modalView, setModalView] = useState(false);
  const [viewDetailsData, setViewDetailsData] = useState(null);

  const [modalEdit, setModalEdit] = useState(false);
  const [editForm, setEditForm] = useState(null); // null = closed, {} = new record fields

  const [modalStatus, setModalStatus] = useState(false);
  const [statusForm, setStatusForm] = useState({ id: '', status: 'Waiting', remarks: '' });

  const [modalRemarks, setModalRemarks] = useState(false);
  const [remarksForm, setRemarksForm] = useState(null);
  const [remarksErrors, setRemarksErrors] = useState({});

  const [modalExport, setModalExport] = useState(false);
  const [exportRange, setExportRange] = useState({ start: '', end: '' });
  const [downloadConfirm, setDownloadConfirm] = useState(null);

  const [modalDelete, setModalDelete] = useState(false);
  const [deleteId, setDeleteId] = useState(null);

  const [modalBulkDelete, setModalBulkDelete] = useState(false);
  const [selectedRows, setSelectedRows] = useState(new Set());

const [actionsMenuOpen, setActionsMenuOpen] = useState(null);
  const [actionsMenuPos, setActionsMenuPos] = useState({ top: 0, left: 0 });
  // --- Toasts ---
  const [toasts, setToasts] = useState([]);
  const toastIdRef = useRef(0);

  // ---------- Toasts ----------
  function showToast(msg, isError = false, type = 'info') {
    const id = ++toastIdRef.current;
    const themeClass = isError ? 'error' : type;
    setToasts(t => [...t, { id, msg, themeClass }]);
    setTimeout(() => {
      setToasts(t => t.filter(x => x.id !== id));
    }, 1800);
  }

  // ---------- Fetching ----------
  async function fetchRecords(silent = false) {
    if (!silent) setIsLoading(true);
    try {
      let url;
      if (currentView === 'complaints') {
        url = `/api/records?t=${Date.now()}`;
      } else {
        const lang = currentView === 'feedback_en' ? 'en' : 'tl';
        url = `/api/feedbacks?language=${lang}&t=${Date.now()}`;
      }
      const response = await fetch(url);
      if (!response.ok) throw new Error('Network response was not ok');
      const result = await response.json();

      const data = currentView === 'complaints' ? (result.success ? result.data : null) : result;
      if (data) {
        setAllRecords(data);
        setLastFetchTime(new Date());
        if (!isConnected) {
          setIsConnected(true);
          if (!silent) showToast('Reconnected — data updated');
        }
      }
    } catch (err) {
      console.error(err);
      setIsConnected(false);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchRecords();
    const interval = setInterval(() => fetchRecords(true), 5000);
    return () => {
      clearInterval(interval);
      document.body.classList.remove('zoom-layout');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentView]);

// ---------- Login export reminder (admin only, every login session) ----------
useEffect(() => {
  if (!isAdmin) return;
  const alreadyShownThisSession = sessionStorage.getItem('nbi_export_reminder_shown');
  if (!alreadyShownThisSession) {
    setModalDailyReminder(true);
  }
}, [isAdmin]);

function dismissDailyReminder(openExport = false) {
  sessionStorage.setItem('nbi_export_reminder_shown', 'true');
  setModalDailyReminder(false);
  if (openExport) {
    openExportModal();
  }
}

  // ---------- Socket realtime ----------
  useEffect(() => {
    let previousTotal = null;

    function onStaffUpdate(data) {
      if (previousTotal !== null && data.stats && data.stats.total > previousTotal) {
        showToast('New registration added!', false, 'success');
      }
      fetchRecords(true);
      if (data.stats) previousTotal = data.stats.total;
    }

    socket.on('staff_update', onStaffUpdate);

    return () => {
      socket.off('staff_update', onStaffUpdate);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentView]);

  // ---------- Derived: filtered + sorted records ----------
  const viewDateStr = useMemo(() => getViewDateString(viewDateObj), [viewDateObj]);

  const filteredRecords = useMemo(() => {
    const term = searchTerm.toLowerCase();

    let list = allRecords.filter(r => {
      if (!r.created_at || !r.created_at.startsWith(viewDateStr)) return false;

      if (currentView === 'complaints') {
        if (filterStatus && r.status !== filterStatus) return false;
        if (filterPriority && !r.is_priority) return false;

        if (term) {
          const fname = r.full_name || '';
          const ccd = r.ccd_no || '';
          const contact = r.contact || '';
          const email = r.email || '';
          const address = r.address || '';
          const stat = r.status || '';
          const ageStr = r.age ? r.age.toString() : '';
          return (
            fname.toLowerCase().includes(term) ||
            ccd.toLowerCase().includes(term) ||
            contact.toLowerCase().includes(term) ||
            email.toLowerCase().includes(term) ||
            address.toLowerCase().includes(term) ||
            stat.toLowerCase().includes(term) ||
            ageStr.includes(term)
          );
        }
        return true;
      } else {
        if (term) {
          const clientType = r.client_type || '';
          const service = r.service_availed || '';
          const email = r.email || '';
          const suggestions = r.suggestions || '';
          return (
            clientType.toLowerCase().includes(term) ||
            service.toLowerCase().includes(term) ||
            email.toLowerCase().includes(term) ||
            suggestions.toLowerCase().includes(term)
          );
        }
        return true;
      }
    });

    if (currentView === 'complaints') {
      list = [...list].sort((a, b) => {
        let valA = a[sortColumn];
        let valB = b[sortColumn];
        if (sortColumn === 'age') {
          valA = parseInt(valA);
          valB = parseInt(valB);
        }
        if (valA < valB) return sortAsc ? -1 : 1;
        if (valA > valB) return sortAsc ? 1 : -1;
        return 0;
      });
    }

    return list;
  }, [allRecords, viewDateStr, currentView, filterStatus, filterPriority, searchTerm, sortColumn, sortAsc]);

  const totalPages = Math.ceil(filteredRecords.length / itemsPerPage);
  const currentFilteredRecords = filteredRecords.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const viewRecordsForStats = useMemo(
    () => allRecords.filter(r => r.created_at && r.created_at.startsWith(viewDateStr)),
    [allRecords, viewDateStr]
  );

  // ---------- Sheet tabs ----------
  useEffect(() => {
    if (currentView !== 'complaints') return;
    if (openTabs.length === 0 && allRecords.length > 0) {
      const recordDates = Array.from(new Set(allRecords.filter(r => r.created_at).map(r => r.created_at.split('T')[0])))
        .sort((a, b) => b.localeCompare(a));
      setOpenTabs(recordDates.slice(0, 5));
    }
  }, [allRecords, currentView, openTabs.length]);

  useEffect(() => {
    setOpenTabs(tabs =>
      tabs.includes(viewDateStr)
        ? tabs
        : [...tabs, viewDateStr].sort((a, b) => b.localeCompare(a))
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewDateStr]);

  function closeTab(dateStr) {
    const remaining = openTabs.filter(d => d !== dateStr);
    setOpenTabs(remaining);
    if (dateStr === viewDateStr && remaining.length > 0) {
      setViewDateObj(new Date(remaining[0]));
    }
  }

  // ---------- Calendar ----------
  function renderCalendarDays() {
    const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const firstDay = new Date(calDateObj.getFullYear(), calDateObj.getMonth(), 1).getDay();
    const daysInMonth = new Date(calDateObj.getFullYear(), calDateObj.getMonth() + 1, 0).getDate();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const recordDates = new Set(allRecords.filter(r => r.created_at).map(r => r.created_at.split('T')[0]));

    const cells = [];
    for (let i = 0; i < firstDay; i++) {
      cells.push(<div key={'e' + i} className="cal-day empty" />);
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const dateVal = new Date(calDateObj.getFullYear(), calDateObj.getMonth(), d);
      dateVal.setHours(0, 0, 0, 0);
      const localStr = getViewDateString(dateVal);
      const isFuture = dateVal > today;
      const isSelected = dateVal.toDateString() === viewDateObj.toDateString();
      const isToday = dateVal.toDateString() === today.toDateString();
      const hasRecords = recordDates.has(localStr);

      let classes = 'cal-day';
      if (isFuture) classes += ' disabled';
      if (!hasRecords && !isFuture) classes += ' empty';
      if (hasRecords) classes += ' has-records';
      if (isSelected) classes += ' selected';
      if (isToday) classes += ' today';

      cells.push(
        <div
          key={d}
          className={classes}
          onClick={() => {
            if (isFuture) return;
            setViewDateObj(new Date(calDateObj.getFullYear(), calDateObj.getMonth(), d));
            setCalendarOpen(false);
          }}
        >
          {d}
        </div>
      );
    }
    return { cells, label: `${monthNames[calDateObj.getMonth()]} ${calDateObj.getFullYear()}` };
  }

  function openCalendar(e) {
    e.stopPropagation();
    if (calendarOpen) {
      setCalendarOpen(false);
      return;
    }
    setCalDateObj(new Date(viewDateObj));
    const rect = e.currentTarget.getBoundingClientRect();
    setCalendarPos({ top: rect.bottom + 5, left: rect.left });
    setCalendarOpen(true);
  }

// close calendar on outside click
  useEffect(() => {
    function handler(e) {
      if (!e.target.closest('#calendarPopover') && !e.target.closest('#dateHeader')) {
        setCalendarOpen(false);
      }
      if (!e.target.closest('.actions-menu-wrap')) {
        setActionsMenuOpen(null);
      }
    }
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);


  // ---------- updateCell (inline edits in the grid) ----------
  async function updateCell(id, field, value) {
    let payloadValue = value;
    if (field === 'is_priority') payloadValue = value === 'true' || value === true;
    else if (field === 'serving_duration' || field === 'registration_duration') payloadValue = value === '' ? null : value;

    setAllRecords(recs => recs.map(r => (r.id === id ? { ...r, [field]: payloadValue } : r)));

    try {
      const response = await fetch('/api/records/' + id, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: payloadValue })
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        showToast('Failed to save update.', true);
      } else if (field === 'status') {
        await fetchRecords(true);
      }
    } catch (err) {
      console.error(err);
      showToast('Error saving data.', true);
    }
  }

  // ---------- Sorting ----------
  function handleSort(col) {
    if (sortColumn === col) setSortAsc(a => !a);
    else {
      setSortColumn(col);
      setSortAsc(true);
    }
  }
  function sortIndicator(col) {
    if (sortColumn !== col) return '';
    return sortAsc ? ' ▲' : ' ▼';
  }

  // ---------- View details modal ----------
  async function viewDetails(id) {
    const r = allRecords.find(x => x.id === id);
    if (!r) return;

    let remarksData = null;
    try {
      const res = await fetch(`/api/records/${id}/remarks`);
      const json = await res.json();
      if (json.success) remarksData = json.data;
    } catch (e) { /* ignore */ }

    setViewDetailsData({ record: r, remarks: remarksData });
    setModalView(true);
  }

  // ---------- Add / Edit modal ----------
  function openAddModal() {
    const now = new Date();
    const localNow = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    setEditForm({
      id: '',
      created_at: localNow.toISOString().slice(0, 16),
      full_name: '', age: '', contact: '', email: '',
      gender: 'Prefer not to say', civil_status: 'Single',
      region: '', address: '', purpose: 'File a Complaint', referred_by: '',
      serving_duration: '', is_priority: false
    });
    setModalEdit(true);
  }

  function openEditModal(id) {
    const record = allRecords.find(r => r.id === id);
    if (!record) return;
    let localDateTime = '';
    if (record.created_at) {
      const dObj = new Date(record.created_at);
      localDateTime = new Date(dObj.getTime() - dObj.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    }
    setEditForm({
      id: record.id,
      created_at: localDateTime,
      full_name: record.full_name || '',
      age: record.age || '',
      contact: record.contact || '',
      email: record.email || '',
      gender: record.gender || 'Prefer not to say',
      civil_status: record.civil_status || 'Single',
      region: record.region || '',
      address: record.address || '',
      purpose: record.purpose || 'File a Complaint',
      referred_by: record.referred_by || '',
      serving_duration: record.serving_duration || '',
      is_priority: record.is_priority || false
    });
    setModalEdit(true);
  }

async function submitEdit(e) {
    e.preventDefault();
    const { id, created_at, ...rest } = editForm;
    const isoCreatedAt = created_at ? new Date(created_at).toISOString() : new Date().toISOString();
    const payload = {
      ...rest,
      created_at: isoCreatedAt,
      serving_duration: rest.serving_duration === '' ? null : rest.serving_duration
    };

    try {
      let res;
      if (id) {
        res = await fetch('/api/records/' + id, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } else {
        const dateForSeq = created_at ? created_at.slice(0, 10) : new Date().toISOString().slice(0, 10);
        const sameDateCount = allRecords.filter(r => r.created_at && r.created_at.split('T')[0] === dateForSeq).length;
        const seq = String(sameDateCount + 1).padStart(4, '0');
        payload.ccd_no = `CCD-${dateForSeq}-${seq}`;
        payload.status = 'Waiting';
        res = await fetch('/api/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ records: [payload] })
        });
      }

      let result = null;
      try { result = await res.json(); } catch (parseErr) { /* body wasn't JSON */ }

      if (res.ok && (!result || result.success !== false)) {
        showToast(id ? 'Record updated!' : 'Record added!', false, 'success');
        setModalEdit(false);
        setEditForm(null);
        fetchRecords();
      } else {
        const backendMsg = result?.error || result?.message;
        console.error('Save failed:', res.status, result);
        showToast(backendMsg ? `Failed to save: ${backendMsg}` : `Failed to save record (status ${res.status}).`, true);
      }
    } catch (err) {
      console.error(err);
      showToast('Network error. Please check your connection.', true);
    }
  }
  // ---------- Status modal ----------
  function openStatusModal(id, currentStatus) {
    setStatusForm({ id, status: currentStatus, remarks: '' });
    setModalStatus(true);
  }

  async function submitStatus() {
    if (!statusForm.remarks.trim()) {
      showToast('Remarks are required for status change.', true);
      return;
    }
    try {
      const response = await fetch(`/api/records/${statusForm.id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: statusForm.status })
      });
      const result = await response.json();
      if (result.success) {
        showToast('Status updated successfully');
        setModalStatus(false);
        await fetchRecords(true);
      } else {
        showToast('Failed to update status.', true);
      }
    } catch (err) {
      showToast('Server error.', true);
    }
  }

  // ---------- Agent remarks modal ----------
async function openRemarks(id) {
    setRemarksForm({

      id, interviewer: isAdmin ? '' : (user.username || ''), text: '', isActionable: 'no', caseType: '', customCaseType: '',
      subject: '', lastModified: null, readOnly: isAdmin, lockedBy: ''
    });
    setRemarksErrors({});
    setModalRemarks(true);

    try {
      const res = await fetch(`/api/records/${id}/remarks`);
      const json = await res.json();
      if (json.success) {
        const isActionableVal = json.data.isActionable || 'no';
        const knownValues = (isActionableVal === 'yes' ? CASE_TYPE_OPTIONS : CAUSES_OPTIONS).map(o => o.value);
        const savedCaseType = json.data.caseType || '';
        const isKnown = knownValues.includes(savedCaseType);
        const existingInterviewer = json.data.interviewer || '';
        const isLockedByOtherAgent = !isAdmin && existingInterviewer.trim() !== '' &&
          existingInterviewer.trim().toLowerCase() !== (user.username || '').trim().toLowerCase();

        setRemarksForm({
          id,
          interviewer: existingInterviewer || (isAdmin ? '' : (user.username || '')),
          text: json.data.text || '',
          isActionable: isActionableVal,
          caseType: isKnown ? savedCaseType : (savedCaseType ? '__custom__' : ''),
          customCaseType: isKnown ? '' : savedCaseType,
          subject: json.data.subject || '',
          lastModified: json.data.last_modified || null,
          readOnly: isAdmin || isLockedByOtherAgent,
          lockedBy: existingInterviewer,
          loading: false
        });
      } else {
        setRemarksForm(f => ({ ...f, readOnly: true, loading: false }));
        showToast('Failed to verify assessment ownership. Please try again.', true);
      }
    } catch (e) {
      setRemarksForm(f => ({ ...f, readOnly: true, loading: false }));
      showToast('Failed to load existing assessment', true);
    }
  }

  async function clearRemarksAssessment(id) {
    if (!window.confirm('Clear this assessment? This will remove the interviewer lock and let any agent claim it again.')) return;
    try {
      const response = await fetch(`/api/records/${id}/remarks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          interviewer: '',
          text: '',
          isActionable: '',
          caseType: '',
          subject: '',
          isAdmin: true
        })
      });
      const result = await response.json();
      if (result.success) {
        showToast('Assessment cleared', false, 'success');
        setModalRemarks(false);
      } else {
        showToast('Failed to clear assessment.', true);
      }
    } catch (err) {
      showToast('Server error.', true);
    }
  }

  async function submitRemarks() {
    if (!remarksForm || remarksForm.readOnly) {
      showToast('You do not have permission to edit this assessment.', true);
      return;
    }

    try {
      const checkRes = await fetch(`/api/records/${remarksForm.id}/remarks`);
      const checkJson = await checkRes.json();
       if (checkJson.success) {
        const currentInterviewer = (checkJson.data.interviewer || '').trim().toLowerCase();
        const myName = (user.username || '').trim().toLowerCase();
        if (!isAdmin && currentInterviewer && currentInterviewer !== myName) {
          showToast(`This assessment was already claimed by ${checkJson.data.interviewer}.`, true);
          setModalRemarks(false);
          return;
        }
      }
    } catch (e) {
      showToast('Could not verify assessment status. Please try again.', true);
      return;
    }

    let hasErrors = false;
    const newErrors = {};

    if (!remarksForm.interviewer || !remarksForm.interviewer.trim()) {
      newErrors.interviewer = true;
      hasErrors = true;
    }

    let caseType = remarksForm.caseType === '__custom__' ? remarksForm.customCaseType.trim() : remarksForm.caseType;

    if (!caseType) {
      newErrors.caseType = true;
      hasErrors = true;
    }

    if (hasErrors) {
      setRemarksErrors(newErrors);
      showToast('Please fill in all required fields.', true);
      return;
    }

    try {
      const response = await fetch(`/api/records/${remarksForm.id}/remarks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          interviewer: remarksForm.interviewer,
          text: remarksForm.text,
          isActionable: remarksForm.isActionable,
          caseType,
          subject: remarksForm.subject,
          isAdmin
        })
      });
      const result = await response.json();
      if (result.success) {
        showToast('Assessment saved successfully', false, 'success');
        setModalRemarks(false);
      } else {
        showToast(result.error || 'Failed to save assessment.', true);
        if (response.status === 403) setModalRemarks(false);
      }
    } catch (err) {
      showToast('Server error.', true);
    }
  }

  function remarksWordCount() {
    if (!remarksForm) return 0;
    const words = remarksForm.text.trim().length ? remarksForm.text.trim().split(/\s+/) : [];
    return words.length;
  }

  function handleRemarksTextChange(value) {
    const words = value.trim().length ? value.trim().split(/\s+/) : [];
    if (words.length > 300) {
      value = words.slice(0, 300).join(' ');
    }
    setRemarksForm(f => ({ ...f, text: value }));
  }

  // ---------- Delete ----------
  function confirmDeleteRecord(id) {
    setDeleteId(id);
    setModalDelete(true);
  }

  async function submitDelete() {
    try {
      const response = await fetch(`/api/records/${deleteId}`, { method: 'DELETE' });
      const result = await response.json();
      if (result.success) {
        showToast('Record deleted successfully', false, 'success');
        setModalDelete(false);
        setAllRecords(recs => recs.filter(x => x.id !== deleteId));
      } else {
        showToast('Failed to delete record. Please try again.', true);
      }
    } catch (err) {
      showToast('Server error. Deletion failed.', true);
    }
  }

  // ---------- Bulk select / delete ----------
  function toggleRowSelect(id) {
    setSelectedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelectedRows(prev => {
      const allSelected = currentFilteredRecords.length > 0 && currentFilteredRecords.every(r => prev.has(r.id));
      if (allSelected) return new Set();
      return new Set(currentFilteredRecords.map(r => r.id));
    });
  }

  async function submitBulkDelete() {
    const ids = Array.from(selectedRows);
    try {
      const results = await Promise.all(ids.map(id => fetch(`/api/records/${id}`, { method: 'DELETE' })));
      const allOk = results.every(res => res.ok);
      setModalBulkDelete(false);
      setAllRecords(recs => recs.filter(r => !selectedRows.has(r.id)));
      setSelectedRows(new Set());
      showToast(allOk ? `${ids.length} record(s) deleted successfully` : 'Some records failed to delete.', !allOk, allOk ? 'success' : 'error');
    } catch (err) {
      showToast('Server error. Bulk deletion failed.', true);
    }
  }
  // ---------- Export ----------
  function openExportModal() {
    setExportRange({ start: viewDateStr, end: viewDateStr });
    setModalExport(true);
  }

  function getExportDataRange() {
    const { start, end } = exportRange;
    if (!start || !end) return [];
    return allRecords
      .filter(r => r.created_at && r.created_at.split('T')[0] >= start && r.created_at.split('T')[0] <= end)
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  }

  async function fetchRemarksForExport(recordsList) {
    await Promise.allSettled(
      recordsList.map(async r => {
        try {
          const res = await fetch(`/api/records/${r.id}/remarks`);
          if (!res.ok) throw new Error('Fetch failed: ' + res.status);
          const json = await res.json();
          r._remarksData = json.success ? json.data : null;
        } catch (e) {
          r._remarksData = null;
        }
      })
    );
    return recordsList;
  }

  function getExportData(recordsList) {
    return recordsList.map(r => ({
      'Date & Time': new Date(r.created_at).toLocaleString('en-PH'),
      'CCD No.': r.ccd_no ? r.ccd_no.split('-').pop() : '',
      'Full Name': r.full_name,
      Age: r.age,
      Contact: r.contact,
      Gender: r.gender,
      'Civil Status': r.civil_status,
      Region: r.region,
      Address: r.address,
      Purpose: r.purpose,
      Priority: r.is_priority ? 'YES' : 'NO',
      'Agent Assessment': getAssessmentText(r),
      'Registration Duration (mins)': r.registration_duration || '',
      'Interview Duration (mins)': r.serving_duration || ''
    }));
  }

async function doExport(type) {
    const recordsToExport = getExportDataRange();
    if (recordsToExport.length === 0) {
      showToast('No records found in this date range.', true);
      return;
    }
    setModalExport(false);
    showToast('Preparing export — this may take a bit longer if the server was idle...', false, 'info');

    let fetchDone = false;
    const wakeupWarningTimer = setTimeout(() => {
      if (!fetchDone) {
        showToast('Still waking up the server — please wait a bit longer...', false, 'info');
      }
    }, 8000);

    try {
      await fetchRemarksForExport(recordsToExport);
    } catch (e) {
      showToast('Some assessments failed to load, exporting with available data.', true);
    } finally {
      fetchDone = true;
      clearTimeout(wakeupWarningTimer);
    }

    const typeLabels = { csv: 'CSV', pdf: 'PDF' };

    try {
      let exportResult = null;
      if (type === 'csv') exportResult = await exportToCSV(recordsToExport);
      else if (type === 'pdf') exportResult = await exportToPDF(recordsToExport);

      if (exportResult) {
        setDownloadConfirm(exportResult);
      }
      showToast(`${typeLabels[type]} export downloaded successfully!`, false, 'success');
    } catch (err) {
      console.error(err);
      showToast(`Failed to export ${typeLabels[type]} file.`, true, 'error');
    }
  }

  const getExportFilename = (ext) => {
    const formatDate = (dateStr) => {
      if (!dateStr) return '';
      const d = new Date(dateStr);
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const yy = String(d.getFullYear()).slice(-2);
      return `${mm}_${dd}_${yy}`;
    };
    const s = formatDate(exportRange.start);
    const e = formatDate(exportRange.end);
    let fname = 'REPORT';
    if (s && e && s !== e) fname += ` ${s}-${e}`;
    else if (s) fname += ` ${s}`;
    else fname += ` ${formatDate(new Date().toISOString())}`;
    return `${fname}.${ext}`;
  };

  async function exportToCSV(recordsList) {
    const XLSX = await import('xlsx');
    const ws = XLSX.utils.json_to_sheet(getExportData(recordsList));
    const dataCsv = XLSX.utils.sheet_to_csv(ws);
    const metaLines = [
      `Generated by,${(user.full_name || user.username || 'Unknown').replace(/,/g, ' ')}`,
      `Generated on,${new Date().toLocaleString('en-PH')}`,
      ''
    ].join('\n');
    const csv = metaLines + dataCsv;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    const filename = getExportFilename('csv');
    link.download = filename;
    link.click();
    return { url, filename };
  }

  async function exportToPDF(recordsList) {
  const { jsPDF } = await import('jspdf');
  const autoTableModule = await import('jspdf-autotable');
  const autoTable = autoTableModule.default;

  const doc = new jsPDF('landscape');
  doc.setFontSize(16);
  doc.text('NBI Cybercrime Division - Official Records', 14, 15);
  doc.setFontSize(10);
  doc.text(`Generated by: ${user.full_name || user.username || 'Unknown'} | ${new Date().toLocaleString('en-PH')} | Range: ${exportRange.start} to ${exportRange.end}`, 14, 22);
  const tableData = recordsList.map(r => [
    new Date(r.created_at).toLocaleString('en-PH'), r.ccd_no ? r.ccd_no.split('-').pop() : '', r.full_name, r.age,
    r.region, r.address, r.contact, getAssessmentText(r), r.registration_duration || '', r.serving_duration || ''
  ]);

  autoTable(doc, {
    head: [['Date & Time', 'CCD No.', 'Full Name', 'Age', 'Region', 'Address', 'Contact', "Agent's Remarks / Nature of Case", 'Reg. Duration (mins)', 'Interview (mins)']],
    body: tableData,
    startY: 28,
    styles: { fontSize: 8 }
  });
  const filename = getExportFilename('pdf');
  doc.save(filename);
  const url = doc.output('bloburl');
  return { url, filename };
}

// ---------- View switching (Complaints / Feedback) ----------
  function switchView(viewName) {
    setCurrentView(viewName);
  }
  const pageTitle = currentView === 'complaints' ? 'Complaint Registry'
    : currentView === 'feedback_en' ? 'English Feedback Database'
    : 'Tagalog Feedback Database';

  // ==================== RENDER ====================
  if (!user) return null;

 return (
    <div style={{ display: 'flex', height: '100vh', maxWidth: '100vw', overflow: 'hidden' }}>   
  <Sidebar
        user={user}
        activePath={location.pathname}
        onNavigate={navigate}
        onLogout={handleLogout}
      />
<div style={{ flex: 1, minWidth: 0, maxWidth: '100%', display: 'flex', flexDirection: 'column', overflowX: 'hidden', height: '100vh', overflowY: 'hidden' }}>      {/* Action bar */}
<div className="action-bar" style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '10px 25px', background: 'var(--panel-bg)', borderBottom: '1px solid var(--border-color)' }}>        <div className="header-top-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <h2 style={{ margin: 0, fontSize: '1.4rem', color: 'var(--text-main)', fontWeight: 600, letterSpacing: '0.02em' }}>Complaint Records</h2>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.95rem', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>
              {isLoading && (
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--nbi-blue, #3b82f6)', display: 'inline-block', animation: 'shimmerSweep 1s ease-in-out infinite alternate' }} />
              )}
              {isConnected
                ? (lastFetchTime ? `Last updated: ${lastFetchTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Loading...')
                : 'Connection lost — retrying...'}
            </span>
            </div>
        </div>

        <div className="filter-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div className="search-filter-group" style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
  <input type="text" className="form-input search-input" placeholder="Search records..." style={{ width: 300 }}
    value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
  {currentView === 'complaints' && (
    <>
      <select className="form-select" style={{ width: 160 }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
        <option value="">All Statuses</option>
        <option value="Waiting">Waiting</option>
        <option value="Serving">Serving</option>
        <option value="Served">Served</option>
        <option value="Skipped">Skipped</option>
        <option value="No-show">No-show</option>
      </select>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-main)', cursor: 'pointer', fontSize: '0.95rem', fontWeight: 500, marginLeft: 5 }}>
        <input type="checkbox" checked={filterPriority} onChange={e => setFilterPriority(e.target.checked)} style={{ width: 16, height: 16, accentColor: 'var(--nbi-blue)' }} /> Priority Only
      </label>
    </>
  )}
</div>
          <div className="action-buttons-group" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            {currentView === 'complaints' && (
              <button className="btn-formal btn-primary" onClick={openAddModal}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style={{ marginRight: 4 }}><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" /></svg> Add Record
              </button>
            )}
            {currentView === 'complaints' && (
              <button className="btn-formal" onClick={openExportModal}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style={{ marginRight: 4 }}><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" /></svg> Export Records
              </button>
            )}
            <button className="btn-formal" onClick={() => window.print()}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style={{ marginRight: 4 }}><path d="M19 8H5c-1.66 0-3 1.34-3 3v6h4v4h12v-4h4v-6c0-1.66-1.34-3-3-3zm-3 11H8v-5h8v5zm3-7c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm-1-9H6v4h12V3z" /></svg> Print
            </button>
          </div>
        </div>
      </div>

      {/* Date navigation tabs */}
      {currentView === 'complaints' && (
      <div className="sheet-tabs" style={{ position: 'relative', background: 'var(--bg-color)', borderBottom: '1px solid var(--border-color)', padding: '2px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', overflowX: 'auto', flex: 1, minWidth: 0 }}>
            <div className="sheet-tab" id="dateHeader" title="Open Date from Calendar" onClick={openCalendar} style={{ flexShrink: 0 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style={{ marginRight: 6 }}><path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zm0-12H5V6h14v2z" /></svg>
              <span style={{ fontSize: '0.7em', marginLeft: 4 }}>▼</span>
            </div>
            {openTabs.map(dateStr => {
              const dObj = new Date(dateStr);
              return (
                <div key={dateStr} className={`sheet-tab ${dateStr === viewDateStr ? 'active' : ''}`} onClick={() => setViewDateObj(dObj)} style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                  <span>{dObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                  <span
                    onClick={e => { e.stopPropagation(); closeTab(dateStr); }}
                    style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 16, height: 16, borderRadius: 4, fontSize: '0.75rem', lineHeight: 1, color: 'var(--text-muted)', cursor: 'pointer' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = 'var(--text-main)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                  >
                    &times;
                  </span>
                </div>
              );
            })}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
  {selectedRows.size > 0 && (
    <>
      <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
        {selectedRows.size} selected
      </span>
      <button
        onClick={() => setModalBulkDelete(true)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          padding: '4px 10px', fontSize: '0.78rem', fontWeight: 500,
          color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca',
          borderRadius: 6, cursor: 'pointer', whiteSpace: 'nowrap'
        }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
          <path d="M10 11v6" /><path d="M14 11v6" />
          <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
        </svg>
        Delete {selectedRows.size}
      </button>
    </>
  )}
</div>
        </div>
      )}
      {/* Calendar popover */}
      {calendarOpen && (
        <div id="calendarPopover" className="calendar-popover active" style={{ position: 'fixed', top: calendarPos.top, left: calendarPos.left }}>
          <div className="cal-header">
            <button className="cal-nav-btn" onClick={() => setCalDateObj(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))}>◀</button>
            <div className="cal-title">{renderCalendarDays().label}</div>
            <button className="cal-nav-btn" onClick={() => setCalDateObj(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))}>▶</button>
          </div>
          <div className="cal-grid">
            <div className="cal-day-label">Su</div><div className="cal-day-label">Mo</div><div className="cal-day-label">Tu</div>
            <div className="cal-day-label">We</div><div className="cal-day-label">Th</div><div className="cal-day-label">Fr</div><div className="cal-day-label">Sa</div>
            {renderCalendarDays().cells}
          </div>
        </div>
      )}

      {/* Main table */}
      <div className="grid-workspace" style={{ padding: '10px 20px', display: 'flex', flexDirection: 'column', minWidth: 0, maxWidth: '100%', flex: 1, minHeight: 0 }}>
        
        <div style={{ flex: 1, minWidth: 0, maxWidth: '100%', display: 'flex', flexDirection: 'column', background: 'var(--panel-bg)', borderRadius: 8, border: '1px solid var(--border-color)', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
          <style>{`
            @keyframes shimmerSweep {
              0% { background-position: -400px 0; }
              100% { background-position: 400px 0; }
            }
            @keyframes skeletonFadeIn {
              from { opacity: 0; transform: translateY(4px); }
              to { opacity: 1; transform: translateY(0); }
            }
            .skeleton-bar {
              display: inline-block;
              height: 14px;
              border-radius: 5px;
              background: linear-gradient(90deg, rgba(148,163,184,0.15) 25%, rgba(148,163,184,0.35) 37%, rgba(148,163,184,0.15) 63%);
              background-size: 400px 100%;
              animation: shimmerSweep 1.4s ease-in-out infinite;
            }
            .skeleton-row {
              animation: skeletonFadeIn 0.35s ease-out both;
            }
            .data-table th, .data-table td {
              padding: 4px 6px !important;
              font-size: 0.75rem !important;
              line-height: 1.2 !important;
            }
            .data-table th.col-title {
              font-size: 0.72rem !important;
              white-space: nowrap;
            }
            .data-table th.col-title.duration-col {
              white-space: normal !important;
              font-size: 0.68rem !important;
              word-break: normal !important;
            }
            .data-table th:first-child, .data-table td:first-child {
              padding-left: 24px !important;
            }
            .data-table th:last-child, .data-table td:last-child {
              padding-right: 24px !important;
            }

            @media (max-width: 768px) {
              .header-top-row { flex-direction: column; align-items: flex-start !important; gap: 6px; }
              .header-top-row h2 { font-size: 1.1rem !important; }
              .filter-row { flex-direction: column; align-items: stretch !important; }
              .search-filter-group { flex-direction: column; align-items: stretch !important; width: 100%; }
              .search-input { width: 100% !important; }
              .search-filter-group select.form-select { width: 100% !important; }
              .action-buttons-group { width: 100%; flex-wrap: wrap; gap: 8px !important; }
              .action-buttons-group .btn-formal { flex: 1; justify-content: center; white-space: nowrap; font-size: 0.8rem; padding: 8px 10px; }
              .sheet-tabs { overflow-x: auto; -webkit-overflow-scrolling: touch; }
              .grid-workspace { padding: 8px !important; }
              .modal { width: 95vw !important; max-width: 95vw !important; max-height: 88vh !important; overflow-y: auto !important; margin: 0 !important; }
              .form-grid { grid-template-columns: 1fr !important; }
              .pagination-bar { flex-direction: column; align-items: stretch !important; gap: 10px; text-align: center; }
              .pagination-controls { justify-content: center !important; flex-wrap: wrap; }
              .data-table th, .data-table td { font-size: 0.68rem !important; padding: 3px 4px !important; }
            }

            @media (max-width: 480px) {
              .action-buttons-group .btn-formal svg { margin-right: 2px !important; }
              .action-buttons-group .btn-formal { font-size: 0.72rem; padding: 7px 8px; }
            }
          `}</style>
          
          <div style={{ flex: 1, overflowX: 'auto', overflowY: 'auto', minWidth: 0 }}>
            <table className="data-table" style={{ width: '100%', minWidth: 900, tableLayout: 'auto', borderCollapse: 'collapse' }}>
            <thead>
              {currentView === 'complaints' ? (
                <tr className="column-titles">
                  <th className="col-title" style={{ width: 32, textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={currentFilteredRecords.length > 0 && currentFilteredRecords.every(r => selectedRows.has(r.id))}
                      onChange={toggleSelectAll}
                      style={{ width: 15, height: 15, cursor: 'pointer' }}
                    />
                  </th>
                  <th className="col-title" onClick={() => handleSort('created_at')}>Date{sortIndicator('created_at')}</th>
                  <th className="col-title">Time</th>
                  <th className="col-title" onClick={() => handleSort('ccd_no')}>CCD No.{sortIndicator('ccd_no')}</th>
                  <th className="col-title" onClick={() => handleSort('full_name')}>Full Name{sortIndicator('full_name')}</th>
                  <th className="col-title" onClick={() => handleSort('age')}>Age{sortIndicator('age')}</th>
                  <th className="col-title" onClick={() => handleSort('region')}>Region{sortIndicator('region')}</th>
                  <th className="col-title" onClick={() => handleSort('contact')}>Contact{sortIndicator('contact')}</th>
                  <th className="col-title" onClick={() => handleSort('is_priority')}>Priority{sortIndicator('is_priority')}</th>
                  <th className="col-title" onClick={() => handleSort('status')}>Status{sortIndicator('status')}</th>
                  <th className="col-title" style={{ textAlign: 'center', whiteSpace: 'normal', fontSize: '0.68rem', lineHeight: 1.2, width: 90 }}>Registration<br />Duration</th>
                  <th className="col-title" style={{ textAlign: 'center', whiteSpace: 'normal', fontSize: '0.68rem', lineHeight: 1.2, width: 90 }}>Interview<br />Duration</th>
                  <th className="col-title" style={{ textAlign: 'center', letterSpacing: '0.05em' }}>ACTIONS</th>
                </tr>
              ) : (
                <tr className="column-titles">
                  <th className="col-title">Date</th>
                  <th className="col-title">Client Type</th>
                  <th className="col-title">Age / Sex</th>
                  <th className="col-title">Region</th>
                  <th className="col-title">Service</th>
                  <th className="col-title">CC1-3</th>
                  <th className="col-title">SQD Avg</th>
                  <th className="col-title">Suggestions</th>
                  <th className="col-title">Email</th>
                </tr>
              )}
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={'skel-' + i} className="skeleton-row" style={{ animationDelay: `${i * 60}ms` }}>
                    {Array.from({ length: currentView === 'complaints' ? 13 : 9 }).map((__, c) => (
                      <td key={c} style={{ textAlign: c === 0 ? 'center' : 'left' }}>
                        {c === 0 ? (
                          <span className="skeleton-bar" style={{ width: 15, height: 15, borderRadius: 3 }} />
                        ) : (
                          <span className="skeleton-bar" style={{ width: `${45 + ((c * 13 + i * 7) % 40)}%` }} />
                        )}
                      </td>
                    ))}
                  </tr>
                ))
              ) : currentFilteredRecords.length === 0 ? (
                <tr><td colSpan={currentView === 'complaints' ? 13 : 9} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                  {currentView === 'complaints' ? 'No records found.' : 'No feedbacks found.'}
                </td></tr>
              ) : currentView === 'complaints' ? (
                currentFilteredRecords.map(r => {
                  const dateObj = new Date(r.created_at);
                  const dateStr = dateObj.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
                  const timeStr = dateObj.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' });
                  return (
                    <tr key={r.id} className={r.is_priority ? 'priority-row' : ''}>
                      <td style={{ textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={selectedRows.has(r.id)}
                          onChange={() => toggleRowSelect(r.id)}
                          style={{ width: 15, height: 15, cursor: 'pointer' }}
                        />
                      </td>
                      <td>{dateStr}</td>
                      <td>{timeStr}</td>
                      <td style={{ fontWeight: 500 }}>{r.ccd_no ? r.ccd_no.split('-').pop() : ''}</td>
                      <td>
                        <div style={{ fontWeight: 500 }}>{r.full_name}</div>
                        {r.isActionable === 'yes' && <div style={{ fontSize: '0.75em', marginTop: 4, color: 'var(--gold)', fontWeight: 'bold' }}>Actionable: {r.caseType || 'N/A'}</div>}
                        {r.isActionable === 'no' && <div style={{ fontSize: '0.75em', marginTop: 4, color: 'var(--text-muted)' }}>Not Actionable</div>}
                      </td>
                      <td>{r.age}</td>
                      <td>
                        <div>{r.region}</div>
                        <div style={{ fontSize: '0.75em', color: 'var(--text-muted)', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.address}>{r.address}</div>
                      </td>
                      <td>{r.contact}</td>
                      <td>
                        <select className="status-badge" data-priority={r.is_priority} value={String(r.is_priority)} style={{ cursor: 'pointer', border: 'none', fontWeight: 'bold', padding: '4px 8px', borderRadius: 4 }}
                            onChange={e => updateCell(r.id, 'is_priority', e.target.value)}>
                          <option value="false">NO</option>
                          <option value="true">YES</option>
                        </select>
                      </td>
                      <td>
                        <select className="status-badge" data-status={r.status} value={r.status} style={{ cursor: 'pointer', border: 'none', fontWeight: 'bold', padding: '4px 8px', borderRadius: 4 }}
                            onChange={e => updateCell(r.id, 'status', e.target.value)}>
                          <option value="Waiting">Waiting</option>
                          <option value="Serving">Serving</option>
                          <option value="Served">Served</option>
                          <option value="Skipped">Skipped</option>
                          <option value="No-show">No-show</option>
                        </select>
                      </td>
                      <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <DurationInput defaultValue={r.registration_duration} field="registration_duration" recordId={r.id} updateCell={updateCell} showToast={showToast} />
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginLeft: 4 }}></span>
                      </td>
                      <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <DurationInput defaultValue={r.serving_duration} field="serving_duration" recordId={r.id} updateCell={updateCell} showToast={showToast} />
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginLeft: 4 }}></span>
                      </td>
                     <td style={{ textAlign: 'center', position: 'relative' }}>
                        <div className="actions-menu-wrap" style={{ position: 'relative', display: 'inline-block' }}>
                          <button
                            className="btn-icon"
                            data-tooltip="Actions"
                            onClick={(e) => {
                              e.stopPropagation();
                              const rect = e.currentTarget.getBoundingClientRect();
                              setActionsMenuPos({ top: rect.bottom + 4, left: rect.right - 170 });
                              setActionsMenuOpen(o => (o === r.id ? null : r.id));
                            }}
                            style={{ background: 'transparent', border: 'none', padding: 4, cursor: 'pointer', color: '#1e3a5f', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                          >
                            <svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor" style={{ display: 'block' }}>
                              <circle cx="12" cy="5" r="2" />
                              <circle cx="12" cy="12" r="2" />
                              <circle cx="12" cy="19" r="2" />
                            </svg>
                          </button>

                          {actionsMenuOpen === r.id && (
                            <div
                              className="actions-menu-wrap"
                              style={{
                                position: 'fixed', top: actionsMenuPos.top, left: actionsMenuPos.left, zIndex: 9999,
                                background: 'var(--panel-bg)', border: '1px solid var(--border-color)',
                                borderRadius: 6, boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                                minWidth: 190, padding: '6px 0', textAlign: 'left'
                              }}
                            >
                              <button className="dropdown-item" onClick={() => { setActionsMenuOpen(null); viewDetails(r.id); }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, background: 'transparent', border: 'none', padding: '8px 14px', textAlign: 'left', cursor: 'pointer', color: 'var(--text-main)', fontSize: '0.85rem' }}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                                View Details
                              </button>
                              <button className="dropdown-item" onClick={() => { setActionsMenuOpen(null); openRemarks(r.id); }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, background: 'transparent', border: 'none', padding: '8px 14px', textAlign: 'left', cursor: 'pointer', color: 'var(--text-main)', fontSize: '0.85rem' }}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/></svg>
                                Agent Assessment
                              </button>
                              <button className="dropdown-item" onClick={() => { setActionsMenuOpen(null); openEditModal(r.id); }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, background: 'transparent', border: 'none', padding: '8px 14px', textAlign: 'left', cursor: 'pointer', color: 'var(--text-main)', fontSize: '0.85rem' }}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                Edit Record
                              </button>
                              <button className="dropdown-item" onClick={() => { setActionsMenuOpen(null); confirmDeleteRecord(r.id); }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, background: 'transparent', border: 'none', padding: '8px 14px', textAlign: 'left', cursor: 'pointer', color: '#dc2626', fontSize: '0.85rem' }}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/></svg>
                                Delete Record
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                      </tr>
                  );
                })
              ) : (
                currentFilteredRecords.map((r, idx) => {
                  const dateObj = new Date(r.created_at);
                  const dateStr = dateObj.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
                  const timeStr = dateObj.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' });
                  let sqdSum = 0, sqdCount = 0;
                  for (let i = 0; i <= 8; i++) {
                    const val = r['sqd' + i];
                    if (val && SQD_MAP[val]) { sqdSum += SQD_MAP[val]; sqdCount++; }
                  }
                  const sqdAvg = sqdCount > 0 ? (sqdSum / sqdCount).toFixed(2) : 'N/A';
                  const ccVals = `${r.cc1 || '-'} / ${r.cc2 || '-'} / ${r.cc3 || '-'}`;
                  return (
                    <tr key={r.id || idx}>
                      <td>{dateStr}<br /><span style={{ fontSize: '0.8em', color: 'gray' }}>{timeStr}</span></td>
                      <td>{r.client_type}</td>
                      <td>{r.age || '-'} / {r.sex || '-'}</td>
                      <td>{r.region}</td>
                      <td>{r.service_availed}</td>
                      <td>{ccVals}</td>
                      <td><strong style={{ color: 'var(--text-accent)' }}>{sqdAvg}</strong></td>
                      <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.suggestions || ''}>{r.suggestions || '-'}</td>
                      <td>{r.email || '-'}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
          </div>
          
          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="pagination-bar" style={{ padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)', background: 'var(--panel-bg)', color: 'var(--text-main)', fontSize: '0.9rem' }}>
              <div className="pagination-info">
                Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredRecords.length)} of {filteredRecords.length} entries
              </div>
              <div className="pagination-controls" style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <button 
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))} 
                  disabled={currentPage === 1}
                  style={{ padding: '5px 15px', borderRadius: 4, background: currentPage === 1 ? 'transparent' : 'var(--accent-color)', color: currentPage === 1 ? 'var(--text-muted)' : 'white', border: '1px solid var(--border-color)', cursor: currentPage === 1 ? 'not-allowed' : 'pointer' }}
                >
                  Previous
                </button>
                <span style={{ padding: '5px 10px', background: 'var(--bg-color)', borderRadius: 4, border: '1px solid var(--border-color)' }}>
                  Page {currentPage} of {totalPages}
                </span>
                <button 
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} 
                  disabled={currentPage === totalPages}
                  style={{ padding: '5px 15px', borderRadius: 4, background: currentPage === totalPages ? 'transparent' : 'var(--accent-color)', color: currentPage === totalPages ? 'var(--text-muted)' : 'white', border: '1px solid var(--border-color)', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer' }}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ---------- Modals ---------- */}

      {modalView && viewDetailsData && (
        <div className="modal-overlay" style={{ display: 'flex' }}>
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title">Official Dossier</div>
              <button className="modal-close" onClick={() => setModalView(false)}>&times;</button>
            </div>
            <ViewDetailsBody data={viewDetailsData} />
            <div className="modal-footer">
              <button className="btn-formal" onClick={() => setModalView(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {modalEdit && editForm && (
        <div className="modal-overlay" style={{ display: 'flex' }}>
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title">{editForm.id ? 'Edit Record' : 'Add New Record'}</div>
              <button className="modal-close" onClick={() => setModalEdit(false)}>&times;</button>
            </div>
            <form onSubmit={submitEdit}>
              <div className="form-grid">
                <div className="form-group full-width">
                  <label className="form-label">Date & Time</label>
                  <input type="datetime-local" className="form-input" required
                    value={editForm.created_at} onChange={e => setEditForm(f => ({ ...f, created_at: e.target.value }))} />
                </div>
                <div className="form-group full-width">
                  <label className="form-label">Full Name</label>
                  <input type="text" className="form-input" required
                    value={editForm.full_name} onChange={e => setEditForm(f => ({ ...f, full_name: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Age</label>
                  <input type="number" className="form-input" required
                    value={editForm.age} onChange={e => setEditForm(f => ({ ...f, age: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Contact</label>
                  <input type="tel" className="form-input" pattern="[0-9]*" maxLength={11} required
                    value={editForm.contact}
                    onChange={e => setEditForm(f => ({ ...f, contact: e.target.value.replace(/[^0-9]/g, '') }))} />
                </div>
                <div className="form-group full-width">
                  <label className="form-label">Email</label>
                  <input type="email" className="form-input"
                    value={editForm.email} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Gender</label>
                  <select className="form-select" value={editForm.gender} onChange={e => setEditForm(f => ({ ...f, gender: e.target.value }))}>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Prefer not to say">Prefer not to say</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Civil Status</label>
                  <select className="form-select" value={editForm.civil_status} onChange={e => setEditForm(f => ({ ...f, civil_status: e.target.value }))}>
                    <option value="Single">Single</option>
                    <option value="Married">Married</option>
                    <option value="Widowed">Widowed</option>
                    <option value="Separated">Separated</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Region</label>
                  <select className="form-select" required
                    value={editForm.region} onChange={e => setEditForm(f => ({ ...f, region: e.target.value }))}>
                    <option value="" disabled>Select region...</option>
                    {REGION_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div className="form-group full-width">
                  <label className="form-label">Address</label>
                  <input type="text" className="form-input" required
                    value={editForm.address} onChange={e => setEditForm(f => ({ ...f, address: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Purpose</label>
                  <select className="form-select" value={editForm.purpose} onChange={e => setEditForm(f => ({ ...f, purpose: e.target.value }))}>
                    <option value="File a Complaint">File a Complaint</option>
                    <option value="Inquire">Inquire</option>
                    <option value="Follow-Up">Follow-Up</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div className="form-group full-width">
                  <label className="form-label">Referred By</label>
                  <input type="text" className="form-input"
                    value={editForm.referred_by} onChange={e => setEditForm(f => ({ ...f, referred_by: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Serving Duration (MM:SS)</label>
                  <input type="text" className="form-input" placeholder="00:00" pattern="[0-9]{2}:[0-9]{2}"
                    value={editForm.serving_duration} onChange={e => setEditForm(f => ({ ...f, serving_duration: e.target.value }))} />
                </div>
                <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <input type="checkbox" style={{ width: 16, height: 16 }} checked={editForm.is_priority}
                    onChange={e => setEditForm(f => ({ ...f, is_priority: e.target.checked }))} />
                  <label className="form-label" style={{ marginBottom: 0 }}>PWD / Senior Citizen Priority</label>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-formal" onClick={() => setModalEdit(false)}>Cancel</button>
                <button type="submit" className="btn-formal btn-primary">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modalStatus && (
        <div className="modal-overlay" style={{ display: 'flex' }}>
          <div className="modal" style={{ maxWidth: 450 }}>
            <div className="modal-header">
              <div className="modal-title">Change Status</div>
              <button className="modal-close" onClick={() => setModalStatus(false)}>&times;</button>
            </div>
            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
              <label className="form-label">New Status</label>
              <select className="form-select" value={statusForm.status} onChange={e => setStatusForm(f => ({ ...f, status: e.target.value }))}>
                <option value="Waiting">Waiting</option>
                <option value="Serving">Serving</option>
                <option value="Served">Served</option>
                <option value="Skipped">Skipped</option>
                <option value="No-show">No-show</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Remarks (Required)</label>
              <input type="text" className="form-input" placeholder="Reason for override..." required
                value={statusForm.remarks} onChange={e => setStatusForm(f => ({ ...f, remarks: e.target.value }))} />
            </div>
            <div className="modal-footer">
              <button className="btn-formal" onClick={() => setModalStatus(false)}>Cancel</button>
              <button className="btn-formal btn-primary" onClick={submitStatus}>Update Status</button>
            </div>
          </div>
        </div>
      )}

      {modalRemarks && remarksForm && (
        <div className="modal-overlay" style={{ display: 'flex' }}>
          <div className="modal" style={{ maxWidth: 900, width: '90vw' }}>
            <div className="modal-header">
              <div className="modal-title">{remarksForm.readOnly ? 'Agent Assessment (View Only)' : 'Agent Assessment'}</div>
              <button className="modal-close" onClick={() => setModalRemarks(false)}>&times;</button>
            </div>

            {remarksForm.readOnly && remarksForm.lockedBy && (
              <div style={{ marginBottom: '1rem', padding: '10px 14px', borderRadius: 6, background: 'rgba(240,165,0,0.1)', border: '1px solid rgba(240,165,0,0.3)', fontSize: '0.85rem', color: 'var(--text-main)' }}>
                🔒 This assessment was created by <strong>{remarksForm.lockedBy}</strong>. Only that agent can edit it.
              </div>
            )}
            {remarksForm.readOnly && !remarksForm.lockedBy && isAdmin && (
              <div style={{ marginBottom: '1rem', padding: '10px 14px', borderRadius: 6, background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)', fontSize: '0.85rem', color: 'var(--text-main)' }}>
                Admins have view-only access to assessments.
              </div>
            )}

            <div className="form-group" style={{ marginBottom: '1rem' }}>
              <label className="form-label">Interviewer (Agent) <span style={{ color: '#e74c3c' }}>*</span></label>
              <input type="text" className="form-input" disabled
                placeholder="Enter interviewer name..."
                style={{ width: '100%', boxSizing: 'border-box', display: 'block', padding: '10px 16px', opacity: 0.7 }}
                value={remarksForm.interviewer || ''}
                readOnly
              />
            </div>
            <div className="form-group" style={{ marginBottom: '1rem' }}>
              <label className="form-label">Is Actionable?</label>
              <select className="form-input" value={remarksForm.isActionable} disabled={remarksForm.readOnly}
                onChange={e => {
                  setRemarksForm(f => ({ ...f, isActionable: e.target.value, caseType: '', customCaseType: '' }));
                  setRemarksErrors(errs => ({ ...errs, caseType: false }));
                }}>
                <option value="no">No (Remarks/Comment only)</option>
                <option value="yes">Yes (Actionable)</option>
              </select>
            </div>

            {remarksForm.isActionable === 'no' && (
              <>
                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label className="form-label">Causes <span style={{ color: '#e74c3c' }}>*</span></label>
                  <select className={`form-input ${remarksErrors.caseType ? 'err' : ''}`} 
                    value={remarksForm.caseType}
                    disabled={remarksForm.readOnly}
                    style={{ borderColor: remarksErrors.caseType ? '#e74c3c' : '' }}
                    onChange={e => {
                      setRemarksForm(f => ({ ...f, caseType: e.target.value }));
                      setRemarksErrors(errs => ({ ...errs, caseType: false }));
                    }}>
                    <option value="" disabled>Select cause...</option>
                    {CAUSES_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                  </select>

                  {remarksForm.caseType && remarksForm.caseType !== '__custom__' && (
                    <div style={{ marginTop: 8 }}>
                      <label className="form-label" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Full Cause (auto-filled)</label>
                      <textarea className="form-input" readOnly rows={2}
                        style={{ width: '100%', boxSizing: 'border-box', resize: 'none', background: 'var(--table-hover)', fontSize: '0.85rem', lineHeight: 1.4, cursor: 'default' }}
                        value={remarksForm.caseType} />
                    </div>
                  )}
                </div>

                {remarksForm.caseType === '__custom__' && (
                  <div className="form-group" style={{ marginBottom: '1rem' }}>
                    <label className="form-label" style={{ display: 'block', marginBottom: 6 }}>Custom Cause <span style={{ color: '#e74c3c' }}>*</span></label>
                    <input type="text" className={`form-input ${remarksErrors.caseType ? 'err' : ''}`} 
                      placeholder="Enter custom cause..."
                      disabled={remarksForm.readOnly}
                      style={{ 
                        width: '100%', 
                        boxSizing: 'border-box', 
                        display: 'block', 
                        padding: '10px 16px',
                        borderColor: remarksErrors.caseType ? '#e74c3c' : ''
                      }}
                      value={remarksForm.customCaseType} 
                      onChange={e => {
                        const val = e.target.value;
                        setRemarksForm(f => ({ ...f, customCaseType: val }));
                        if (val.trim()) {
                          setRemarksErrors(errs => ({ ...errs, caseType: false }));
                        }
                      }} 
                    />
                  </div>
                )}

                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label className="form-label">Case Notes & Remarks</label>
                  <textarea className="form-textarea" placeholder="Enter agent remarks or comment for this complainant..."
                    disabled={remarksForm.readOnly}
                    style={{ minHeight: 140, fontSize: '1rem', lineHeight: 1.5, resize: 'none' }}
                    value={remarksForm.text} onChange={e => handleRemarksTextChange(e.target.value)} />
                  <div style={{ display: 'flex', justifyContent: 'flex-end', fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4 }}>
                    <span>{remarksWordCount()}</span>&nbsp;/&nbsp;300 words
                  </div>
                </div>
              </>
            )}

            {remarksForm.isActionable === 'yes' && (
              <>
                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label className="form-label">Case Type <span style={{ color: '#e74c3c' }}>*</span></label>
                  <select className={`form-input ${remarksErrors.caseType ? 'err' : ''}`} 
                    value={remarksForm.caseType}
                    disabled={remarksForm.readOnly}
                    style={{ borderColor: remarksErrors.caseType ? '#e74c3c' : '' }}
                    onChange={e => {
                      setRemarksForm(f => ({ ...f, caseType: e.target.value }));
                      setRemarksErrors(errs => ({ ...errs, caseType: false }));
                    }}>
                    <option value="" disabled>Select case type...</option>
                    {CASE_TYPE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                  </select>

                  {remarksForm.caseType && remarksForm.caseType !== '__custom__' && (
                    <div style={{ marginTop: 8 }}>
                      <label className="form-label" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Full Case Type (auto-filled)</label>
                      <textarea className="form-input" readOnly rows={2}
                        style={{ width: '100%', boxSizing: 'border-box', resize: 'none', background: 'var(--table-hover)', fontSize: '0.85rem', lineHeight: 1.4, cursor: 'default' }}
                        value={remarksForm.caseType} />
                    </div>
                  )}
                </div>

                {remarksForm.caseType === '__custom__' && (
                  <div className="form-group" style={{ marginBottom: '1rem' }}>
                    <label className="form-label" style={{ display: 'block', marginBottom: 6 }}>Custom Case Type <span style={{ color: '#e74c3c' }}>*</span></label>
                    <input type="text" className={`form-input ${remarksErrors.caseType ? 'err' : ''}`} 
                      placeholder="Enter custom case type..."
                      disabled={remarksForm.readOnly}
                      style={{ 
                        width: '100%', 
                        boxSizing: 'border-box', 
                        display: 'block', 
                        padding: '10px 16px',
                        borderColor: remarksErrors.caseType ? '#e74c3c' : ''
                      }}
                      value={remarksForm.customCaseType} 
                      onChange={e => {
                        const val = e.target.value;
                        setRemarksForm(f => ({ ...f, customCaseType: val }));
                        if (val.trim()) {
                          setRemarksErrors(errs => ({ ...errs, caseType: false }));
                        }
                      }} 
                    />
                  </div>
                )}

                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label className="form-label">Subject</label>
                  <textarea className="form-input" placeholder="Brief subject/title of the case..." rows={2}
                    disabled={remarksForm.readOnly}
                    style={{ width: '100%', boxSizing: 'border-box', resize: 'none', minHeight: 50, fontFamily: 'inherit' }}
                    value={remarksForm.subject} onChange={e => setRemarksForm(f => ({ ...f, subject: e.target.value }))} />
                </div>
              </>
            )}

            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic', marginBottom: '1.5rem' }}>
              {remarksForm.lastModified ? `Last modified: ${new Date(remarksForm.lastModified).toLocaleString('en-PH')}` : 'No previous assessment.'}
            </div>
            <div className="modal-footer">
              <button className="btn-formal" onClick={() => setModalRemarks(false)}>Close</button>
              {isAdmin && remarksForm.lockedBy && (
                <button className="btn-formal btn-danger" onClick={() => clearRemarksAssessment(remarksForm.id)}>Clear Assessment</button>
              )}
              {!remarksForm.readOnly && !remarksForm.loading && (
                <button className="btn-formal btn-primary" onClick={submitRemarks}>Save Assessment</button>
              )}
            </div>
          </div>
        </div>
      )}


      {/* Daily reminder to export/backup records */}
      {modalDailyReminder && (
        <div className="modal-overlay" style={{ display: 'flex' }}>
          <div className="modal" style={{ maxWidth: 450 }}>
            <div className="modal-header">
              <div className="modal-title">Daily Backup Reminder</div>
              <button className="modal-close" onClick={() => dismissDailyReminder(false)}>&times;</button>
            </div>
            <div style={{ padding: '10px 0 20px', color: 'var(--text-main)', lineHeight: 1.6 }}>
              <p style={{ marginBottom: 10 }}>
                ⚠️ <strong>Reminder:</strong> Please export and download today's records before you sign off for the day.
              </p>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Note: the server may go to sleep after periods of inactivity, so exporting regularly helps make sure your data is always backed up and ready when you need it.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn-formal" onClick={() => dismissDailyReminder(false)}>Remind Me Later</button>
              <button className="btn-formal btn-primary" onClick={() => dismissDailyReminder(true)}>Export Now</button>
            </div>
          </div>
        </div>
      )}

      {modalExport && (
        <div className="modal-overlay" style={{ display: 'flex' }}>
          <div className="modal" style={{ maxWidth: 450 }}>
            <div className="modal-header">
              <div className="modal-title">Export Records</div>
              <button className="modal-close" onClick={() => setModalExport(false)}>&times;</button>
            </div>

            <div style={{
              marginBottom: 16,
              padding: '10px 14px',
              borderRadius: 6,
              background: 'rgba(240,165,0,0.1)',
              border: '1px solid rgba(240,165,0,0.3)',
              fontSize: '0.8rem',
              color: 'var(--text-main)',
              lineHeight: 1.5
            }}>
              ⚠️ The server may be idle and could take 30–60 seconds to wake up before the export completes. Please don't close this window while it's loading.
            </div>

            <div className="form-group" style={{ marginBottom: '1rem' }}>
              <label className="form-label">Start Date</label>
              <input type="date" className="form-input" value={exportRange.start} onChange={e => setExportRange(r => ({ ...r, start: e.target.value }))} />
            </div>
            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
              <label className="form-label">End Date</label>
              <input type="date" className="form-input" value={exportRange.end} onChange={e => setExportRange(r => ({ ...r, end: e.target.value }))} />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', marginBottom: 10 }}>
              <button className="btn-formal btn-primary" style={{ flex: 1 }} onClick={() => doExport('csv')}>CSV</button>
              <button className="btn-formal btn-primary" style={{ flex: 1 }} onClick={() => doExport('pdf')}>PDF</button>
            </div>
          </div>
        </div>
      )}
      {downloadConfirm && (
        <div className="modal-overlay" style={{ display: 'flex' }}>
          <div className="modal" style={{ maxWidth: 450, textAlign: 'center' }}>
            <div className="modal-header">
              <div className="modal-title">Download Complete</div>
              <button className="modal-close" onClick={() => setDownloadConfirm(null)}>&times;</button>
            </div>
            <div style={{ padding: '20px 0', color: 'var(--text-main)' }}>
              <p style={{ marginBottom: 15 }}>Your report has been downloaded successfully.</p>
              <p style={{ fontWeight: 'bold', wordBreak: 'break-all' }}>{downloadConfirm.filename}</p>
            </div>
            <div className="modal-footer" style={{ justifyContent: 'center' }}>
              <a href={downloadConfirm.url} target="_blank" rel="noreferrer" className="btn-formal btn-primary" style={{ textDecoration: 'none', display: 'inline-block', lineHeight: 'normal' }} onClick={() => setDownloadConfirm(null)}>
                Open File
              </a>
              <button className="btn-formal" onClick={() => setDownloadConfirm(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      
      {modalDelete && (
        <div className="modal-overlay" style={{ display: 'flex' }}>
          <div className="modal" style={{ maxWidth: 450 }}>
            <div className="modal-header">
              <div className="modal-title" style={{ color: 'var(--red)' }}>Delete Record</div>
              <button className="modal-close" onClick={() => setModalDelete(false)}>&times;</button>
            </div>
            <div style={{ lineHeight: 1.6, color: 'var(--text-main)', marginBottom: '2rem' }}>
              Are you absolutely sure you want to permanently delete this official record? <strong>This action cannot be undone.</strong>
            </div>
            <div className="modal-footer">
              <button className="btn-formal" onClick={() => setModalDelete(false)}>Cancel</button>
              <button className="btn-formal btn-danger" onClick={submitDelete}>Delete Record</button>
            </div>
          </div>
        </div>
      )}

      {modalBulkDelete && (
        <div className="modal-overlay" style={{ display: 'flex' }}>
          <div className="modal" style={{ maxWidth: 450 }}>
            <div className="modal-header">
              <div className="modal-title" style={{ color: 'var(--red)' }}>Delete {selectedRows.size} Record{selectedRows.size > 1 ? 's' : ''}</div>
              <button className="modal-close" onClick={() => setModalBulkDelete(false)}>&times;</button>
            </div>
            <div style={{ lineHeight: 1.6, color: 'var(--text-main)', marginBottom: '2rem' }}>
              Are you absolutely sure you want to permanently delete <strong>{selectedRows.size}</strong> selected record(s)? <strong>This action cannot be undone.</strong>
            </div>
            <div className="modal-footer">
              <button className="btn-formal" onClick={() => setModalBulkDelete(false)}>Cancel</button>
              <button className="btn-formal btn-danger" onClick={submitBulkDelete}>Delete {selectedRows.size} Record{selectedRows.size > 1 ? 's' : ''}</button>
            </div>
          </div>
        </div>
      )}

        {/* Centered modal toasts — success & error only */}
      {toasts.filter(t => t.themeClass === 'success' || t.themeClass === 'error').length > 0 && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(15, 23, 42, 0.55)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            pointerEvents: 'none'
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, pointerEvents: 'auto' }}>
            {toasts
              .filter(t => t.themeClass === 'success' || t.themeClass === 'error')
              .map(t => {
                const palette = {
                  error:   { bg: '#ffffff', accent: '#ef4444', accentBg: '#fee2e2', text: '#7f1d1d', icon: '✕' },
                  success: { bg: '#ffffff', accent: '#22c55e', accentBg: '#dcfce7', text: '#14532d', icon: '✓' }
                };
                const style = palette[t.themeClass];
                return (
                  <div
                    key={t.id}
                    style={{
                      width: 380,
                      background: style.bg,
                      borderRadius: 20,
                      padding: '40px 32px 32px',
                      boxShadow: '0 25px 50px -12px rgba(0,0,0,0.45)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      textAlign: 'center',
                      gap: 20,
                      animation: 'toastPop 0.25s ease-out'
                    }}
                  >
                    <div
                      style={{
                        width: 80,
                        height: 80,
                        borderRadius: '50%',
                        background: style.accentBg,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}
                    >
                      <span style={{ fontSize: '2.5rem', color: style.accent, fontWeight: 700, lineHeight: 1 }}>
                        {style.icon}
                      </span>
                    </div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 600, color: style.text, lineHeight: 1.5 }}>
                      {t.msg}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Regular corner toasts — info/loading messages */}
      <div className="toast-container">
        {toasts
          .filter(t => t.themeClass !== 'success' && t.themeClass !== 'error')
          .map(t => (
            <div key={t.id} className={`toast show ${t.themeClass}`}>
              <div className="toast-content">{t.msg}</div>
            </div>
          ))}
      </div>
      </div>
    </div>
  );
}
 



function ViewDetailsBody({ data }) {
  const { record: r, remarks } = data;
  const dateStr = new Date(r.created_at).toLocaleString('en-PH');
  const remarksText = remarks?.text || 'None';
  const isActionable = remarks?.isActionable;

  return (
    <div>
      <div className="detail-row"><div className="detail-label">Control No.</div><div className="detail-value" style={{ color: 'var(--gold)', fontWeight: 800 }}>{r.ccd_no ? r.ccd_no.split('-').pop() : ''}</div></div>
      <div className="detail-row"><div className="detail-label">Registration</div><div className="detail-value">{dateStr}</div></div>
      <div className="detail-row"><div className="detail-label">Status</div><div className="detail-value">{r.status} {r.is_priority && <span className="badge badge-priority" style={{ marginLeft: 5 }}>Priority</span>}</div></div>
      <div className="detail-row"><div className="detail-label">Full Name</div><div className="detail-value">{r.full_name}</div></div>
      <div className="detail-row"><div className="detail-label">Demographics</div><div className="detail-value">{r.age} yrs • {r.gender} • {r.civil_status}</div></div>
      <div className="detail-row"><div className="detail-label">Contact Info</div><div className="detail-value">{r.contact} <br /> {r.email || 'No email provided'}</div></div>
      <div className="detail-row"><div className="detail-label">Region</div><div className="detail-value">{r.region || 'N/A'}</div></div>
      <div className="detail-row"><div className="detail-label">Address</div><div className="detail-value">{r.address}</div></div>
      <div className="detail-row"><div className="detail-label">Purpose</div><div className="detail-value">{r.purpose}</div></div>
      <div className="detail-row"><div className="detail-label">Referred By</div><div className="detail-value">{r.referred_by || 'N/A'}</div></div>
      <div className="detail-row"><div className="detail-label">Registration Duration</div><div className="detail-value">{r.registration_duration ? `${r.registration_duration} mins` : 'N/A'}</div></div>
      <div className="detail-row"><div className="detail-label">Interview Duration</div><div className="detail-value">{r.serving_duration ? `${r.serving_duration} mins` : 'N/A'}</div></div>
      {remarks && (
        <div className="detail-row">
          <div className="detail-label">Assessment</div>
          <div className="detail-value">
            {isActionable === 'yes' ? <span style={{ color: '#2ecc71', fontWeight: 'bold' }}>Yes (Actionable)</span> : <span style={{ color: '#e74c3c', fontWeight: 'bold' }}>No</span>}
            {isActionable === 'yes' && remarks.caseType && ` | Case: ${remarks.caseType}`}
            {isActionable === 'yes' && remarks.subject && <> | <br />Subject: {remarks.subject}</>}
          </div>
        </div>
      )}
      <div className="detail-row" style={{ flexDirection: 'column', borderBottom: 'none' }}>
        <div className="detail-label" style={{ width: '100%', marginBottom: '0.5rem' }}>Agent Remarks</div>
        <div className="detail-value" style={{ width: '100%', background: 'var(--panel-bg)', padding: '1rem', borderRadius: 6, border: '1px solid var(--border-color)', whiteSpace: 'pre-wrap', textAlign: 'left' }}>{remarksText}</div>
      </div>
      {r.e_signature && (
        <div className="detail-row" style={{ flexDirection: 'column', borderBottom: 'none' }}>
          <div className="detail-label" style={{ width: '100%', marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>E-Signature</span>
            <a href={r.e_signature} download={`Signature_${r.ccd_no}.png`} style={{ textDecoration: 'none', background: 'var(--btn-bg)', color: 'var(--text-main)', padding: '4px 12px', borderRadius: 4, border: '1px solid var(--border-color)', fontSize: '0.75rem' }}>Download</a>
          </div>
          <div className="detail-value" style={{ width: '100%', background: 'white', padding: '1rem', borderRadius: 6, border: '1px solid var(--border-color)', textAlign: 'center' }}>
            <img src={r.e_signature} style={{ maxHeight: 150, maxWidth: '100%' }} alt="E-Signature" />
          </div>
        </div>
      )}
    </div>
  );
}