
        // --- State ---
        let allRecords = [];
        let filteredRecords = [];
        let lastFetchTime = null;
        let isConnected = true;

        let viewDateObj = new Date();
        let calDateObj = new Date(); // For calendar rendering

        let currentPage = 1;
        const recordsPerPage = 25;

        let sortColumn = 'created_at';
        let sortAsc = false;

        let searchTimeout = null;

        // --- Theme Logic ---
        function toggleTheme() {
            const root = document.documentElement;
            const currentTheme = root.getAttribute('data-theme') || 'light';
            const newTheme = currentTheme === 'light' ? 'dark' : 'light';
            root.setAttribute('data-theme', newTheme);
            localStorage.setItem('nbi_theme', newTheme);
            document.getElementById('themeToggle').textContent = newTheme === 'light' ? '☀️' : '🌙';
            
            // Re-apply pill colors on theme switch so they instantly swap
            setTimeout(applyGlobalColorsToGrid, 10);
        }
        
        // Initialize theme on load
        if (localStorage.getItem('nbi_theme') === 'dark') {
            document.documentElement.setAttribute('data-theme', 'dark');
            document.getElementById('themeToggle').textContent = '🌙';
        } else {
            document.documentElement.setAttribute('data-theme', 'light');
            document.getElementById('themeToggle').textContent = '☀️';
        }

        
        
        // --- Global Value Colors Customization ---
        const defaultGlobalColors = {
            'Served': { bg: '#064e3b', txt: '#34d399' },
            'Waiting': { bg: '#1e3a8a', txt: '#60a5fa' },
            'Skipped': { bg: '#7f1d1d', txt: '#f87171' },
            'No-show': { bg: '#374151', txt: '#9ca3af' },
            'Serving': { bg: '#78350f', txt: '#fbbf24' },
            'YES': { bg: '#064e3b', txt: '#34d399' },
            'NO': { bg: '#7f1d1d', txt: '#f87171' }
        };

        // Auto-purge old bright colors from cache if they exist
        try {
            const saved = localStorage.getItem('nbi_global_colors');
            if (saved && saved.includes('#D1FAE5')) {
                localStorage.removeItem('nbi_global_colors');
            }
        } catch(e) {}

        function getGlobalColors() {
            try {
                const saved = localStorage.getItem('nbi_global_colors');
                if (saved) return JSON.parse(saved);
            } catch(e) {}
            return JSON.parse(JSON.stringify(defaultGlobalColors));
        }

        function saveGlobalColors(colors) {
            localStorage.setItem('nbi_global_colors', JSON.stringify(colors));
            applyGlobalColorsToGrid();
        }

        function applyGlobalColorsToGrid() {
            const colors = getGlobalColors();
            // Apply to all select elements in the grid
            const selects = document.querySelectorAll('.excel-grid select, .excel-grid .status-badge');
            selects.forEach(select => {
                const val = select.tagName === 'SELECT' ? select.options[select.selectedIndex].text.trim() : (select.value || select.innerText).trim();
                if (colors[val]) {
                    select.style.backgroundColor = colors[val].bg;
                    select.style.color = colors[val].txt;
                    // Ensure it overrides default appearance
                    select.style.appearance = 'none';
                } else {
                    select.style.backgroundColor = 'transparent';
                    select.style.color = 'inherit';
                }
            });
        }

        function openColorSettings() {
            const colors = getGlobalColors();
            const form = document.getElementById('colorSettingsForm');
            form.innerHTML = '';
            
            for (const [word, vals] of Object.entries(colors)) {
                addColorRuleRow(form, word, vals.bg, vals.txt);
            }
            openModal('modalColors');
        }

        function addColorRuleRow(container, word = '', bg = '#ffffff', txt = '#000000') {
            const row = document.createElement('div');
            row.className = 'color-rule-row';
            row.style.display = 'flex';
            row.style.alignItems = 'center';
            row.style.gap = '10px';
            row.style.marginBottom = '10px';
            
            const wordInput = document.createElement('input');
            wordInput.type = 'text';
            wordInput.value = word;
            wordInput.placeholder = 'Exact Word...';
            wordInput.className = 'form-input';
            wordInput.style.width = '120px';
            
            const bgInput = document.createElement('input');
            bgInput.type = 'color';
            bgInput.value = bg;
            bgInput.style.cursor = 'pointer';
            
            const txtInput = document.createElement('input');
            txtInput.type = 'color';
            txtInput.value = txt;
            txtInput.style.cursor = 'pointer';
            
            const preview = document.createElement('div');
            preview.className = `status-badge`;
            preview.style.backgroundColor = bg;
            preview.style.color = txt;
            preview.style.minWidth = '80px';
            preview.textContent = word || "Preview";
            
            const delBtn = document.createElement('button');
            delBtn.innerHTML = '&times;';
            delBtn.className = 'btn-formal';
            delBtn.style.color = 'red';
            delBtn.style.padding = '2px 8px';
            delBtn.onclick = () => row.remove();
            
            wordInput.addEventListener('keyup', e => preview.textContent = e.target.value || "Preview");
            bgInput.addEventListener('input', e => preview.style.backgroundColor = e.target.value);
            txtInput.addEventListener('input', e => preview.style.color = e.target.value);
            
            row.appendChild(wordInput);
            row.appendChild(document.createTextNode('Bg:'));
            row.appendChild(bgInput);
            row.appendChild(document.createTextNode('Txt:'));
            row.appendChild(txtInput);
            row.appendChild(preview);
            row.appendChild(delBtn);
            
            container.appendChild(row);
        }

        function addNewColorRule() {
            const form = document.getElementById('colorSettingsForm');
            addColorRuleRow(form);
        }

        function saveColorRules() {
            const rows = document.querySelectorAll('.color-rule-row');
            const newColors = {};
            rows.forEach(row => {
                const word = row.children[0].value.trim();
                const bg = row.children[2].value;
                const txt = row.children[4].value;
                if (word) {
                    newColors[word] = { bg, txt };
                }
            });
            saveGlobalColors(newColors);
            closeModal('modalColors');
            showToast("Color rules saved!", false, "success");
        }

        function resetDefaultColors() {
            localStorage.removeItem('nbi_global_colors');
            openColorSettings(); // Refresh modal
            applyGlobalColorsToGrid();
            showToast("Reset to default colors.");
        }

        // Apply colors on page load
        document.addEventListener('DOMContentLoaded', applyGlobalColorsToGrid);


        // --- Initialization ---
        applyGlobalColorsToGrid();

        document.addEventListener('DOMContentLoaded', () => {
            updateLedgerDateDisplay();
            fetchRecords();

            // Dropdowns & Calendar Close
            document.addEventListener('click', (e) => {
                if (!e.target.closest('.dropdown')) {
                    document.querySelectorAll('.dropdown').forEach(d => d.classList.remove('active'));
                }
                if (!e.target.closest('#calendarPopover') && !e.target.closest('#dateHeader')) {
                    document.getElementById('calendarPopover').classList.remove('active');
                }
            });

            // Debounced Auto-Search
            document.getElementById('searchInput').addEventListener('input', () => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => applyFiltersAndSort(), 300);
            });

            document.getElementById('filterStatus').addEventListener('change', applyFiltersAndSort);
            document.getElementById('filterPriority').addEventListener('change', applyFiltersAndSort);

            // Silent Auto Refresh loop
            setInterval(() => fetchRecords(true), 15000);
            setInterval(updateCacheWarning, 1000);
        });

        function toggleDropdown(event, id) {
            event.stopPropagation();
            const parent = event.currentTarget.closest('.dropdown');
            const wasActive = parent.classList.contains('active');
            document.querySelectorAll('.dropdown').forEach(d => d.classList.remove('active'));
            if (!wasActive) parent.classList.add('active');
        }

        let openTabs = [];

        function renderSheetTabsUI() {
            const container = document.getElementById('sheetTabsContainer');
            if (!container) return;
            
            const currentDateStr = getViewDateString();
            
            // Initialize open tabs on first load with up to 5 recent dates
            if (openTabs.length === 0) {
                const recordDates = Array.from(new Set(allRecords.filter(r => r.created_at).map(r => r.created_at.split('T')[0]))).sort((a,b)=>b.localeCompare(a));
                openTabs = recordDates.slice(0, 5);
            }
            
            // Ensure the currently viewed date is always added to open tabs
            if (!openTabs.includes(currentDateStr)) {
                openTabs.push(currentDateStr);
            }
            
            // Sort tabs descending
            openTabs.sort((a,b)=>b.localeCompare(a));
            
            container.innerHTML = '';
            
            // Calendar icon tab
            const calTab = document.createElement('div');
            calTab.className = 'sheet-tab';
            calTab.id = 'dateHeader';
            calTab.innerHTML = '📅 <span style="font-size:0.7em; margin-left:4px;">▼</span>';
            calTab.title = "Open Date from Calendar";
            calTab.onclick = (e) => {
                e.stopPropagation();
                const popover = document.getElementById('calendarPopover');
                if (popover.classList.contains('active')) {
                    popover.classList.remove('active');
                } else {
                    calDateObj = new Date(viewDateObj);
                    renderCalendar();
                    popover.classList.add('active');
                }
            };
            container.appendChild(calTab);
            
            // Render open tabs
            openTabs.forEach(dateStr => {
                const tab = document.createElement('div');
                tab.className = 'sheet-tab';
                if (dateStr === currentDateStr) tab.classList.add('active');
                
                const dObj = new Date(dateStr);
                
                const titleSpan = document.createElement('span');
                titleSpan.textContent = dObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                tab.appendChild(titleSpan);
                
                // Add close button if there is more than 1 tab open
                if (openTabs.length > 1) {
                    const closeBtn = document.createElement('span');
                    closeBtn.innerHTML = '&times;';
                    closeBtn.style.marginLeft = '8px';
                    closeBtn.style.color = 'inherit';
                    closeBtn.style.fontSize = '1.2em';
                    closeBtn.style.lineHeight = '0.5';
                    closeBtn.style.verticalAlign = 'middle';
                    closeBtn.style.opacity = '0.5';
                    closeBtn.style.cursor = 'pointer';
                    
                    closeBtn.onmouseover = () => closeBtn.style.opacity = '1';
                    closeBtn.onmouseout = () => closeBtn.style.opacity = '0.5';
                    
                    closeBtn.onclick = (e) => {
                        e.stopPropagation(); // prevent tab click
                        closeTab(dateStr);
                    };
                    tab.appendChild(closeBtn);
                }
                
                tab.onclick = () => {
                    viewDateObj = dObj;
                    applyFiltersAndSort();
                };
                container.appendChild(tab);
            });
        }

        function closeTab(dateStr) {
            openTabs = openTabs.filter(d => d !== dateStr);
            const currentDateStr = getViewDateString();
            
            if (dateStr === currentDateStr && openTabs.length > 0) {
                // If we closed the active tab, switch to the first available open tab
                viewDateObj = new Date(openTabs[0]);
                applyFiltersAndSort();
            } else {
                renderSheetTabsUI();
            }
        }

        // --- Ledger Date & Calendar Logic ---
        function updateLedgerDateDisplay() {
            renderSheetTabsUI();
        }

        function changeDate(offset) {
            viewDateObj.setDate(viewDateObj.getDate() + offset);
            const today = new Date();
            if (viewDateObj > today) viewDateObj = new Date(today);

            applyFiltersAndSort();
        }

        function getViewDateString() {
            const offset = viewDateObj.getTimezoneOffset();
            const localDate = new Date(viewDateObj.getTime() - (offset * 60 * 1000));
            return localDate.toISOString().split('T')[0];
        }

        function renderCalendar() {
            const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
            document.getElementById('calMonthYear').textContent = `${monthNames[calDateObj.getMonth()]} ${calDateObj.getFullYear()}`;

            const firstDay = new Date(calDateObj.getFullYear(), calDateObj.getMonth(), 1).getDay();
            const daysInMonth = new Date(calDateObj.getFullYear(), calDateObj.getMonth() + 1, 0).getDate();

            const grid = document.getElementById('calGrid');
            // Remove old days
            const dayLabels = Array.from(grid.querySelectorAll('.cal-day-label'));
            grid.innerHTML = '';
            dayLabels.forEach(l => grid.appendChild(l));

            const today = new Date();
            today.setHours(0, 0, 0, 0);

            // Find days that have records
            const recordDates = new Set(allRecords.map(r => r.created_at.split('T')[0]));

            // Empty slots
            for (let i = 0; i < firstDay; i++) {
                grid.innerHTML += `<div class="cal-day empty"></div>`;
            }

            for (let d = 1; d <= daysInMonth; d++) {
                const dateVal = new Date(calDateObj.getFullYear(), calDateObj.getMonth(), d);
                dateVal.setHours(0, 0, 0, 0);

                const offset = dateVal.getTimezoneOffset();
                const localStr = new Date(dateVal.getTime() - (offset * 60 * 1000)).toISOString().split('T')[0];

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

                grid.innerHTML += `<div class="${classes}" onclick="if(!${isFuture}) selectCalendarDate(${calDateObj.getFullYear()}, ${calDateObj.getMonth()}, ${d})">${d}</div>`;
            }
        }

        function changeCalendarMonth(offset) {
            calDateObj.setMonth(calDateObj.getMonth() + offset);
            renderCalendar();
        }

        function selectCalendarDate(y, m, d) {
            viewDateObj = new Date(y, m, d);
            document.getElementById('calendarPopover').classList.remove('active');
            const ledgerDisplay = document.getElementById('ledgerDateDisplay');
            if (ledgerDisplay) ledgerDisplay.classList.remove('active');
            updateLedgerDateDisplay();
            applyFiltersAndSort();
        }

        // --- Data Fetching (Cache) ---
        async function fetchRecords(silent = false) {
            try {
                const response = await fetch(`/api/records?t=${Date.now()}`);
                if (!response.ok) throw new Error("Network response was not ok");
                const result = await response.json();
                if (result.success) {
                    allRecords = result.data;
                    lastFetchTime = new Date();

                    if (!isConnected) {
                        isConnected = true;
                        showToast('Reconnected — data updated');
                    }

                    updateSummaryBar();
                    renderSheetTabsUI(); // Make sure previous dates show up after data loads!
                    applyFiltersAndSort();
                    updateCacheWarning();
                }
            } catch (err) {
                console.error(err);
                isConnected = false;
                updateCacheWarning();
            }
        }

        function updateCacheWarning() {
            const el = document.getElementById('lastUpdated');
            if (!el) return;
            if (!isConnected) {
                el.textContent = "Connection lost — retrying...";
                el.style.color = "var(--red)";
                return;
            }
            if (!lastFetchTime) return;

            el.style.color = "var(--text-muted)";
            const now = new Date();
            const diffMins = Math.floor((now - lastFetchTime) / 60000);
            const timeStr = lastFetchTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            let text = `Last updated: ${timeStr}`;

            if (diffMins >= 5) {
                text = `⚠️ Data may be outdated (${diffMins}m ago). Try reloading.`;
                el.style.color = "var(--red)";
            }
            el.textContent = text;
        }

        function updateSummaryBar() {
            const viewStr = getViewDateString();
            const viewRecords = allRecords.filter(r => r.created_at && r.created_at.startsWith(viewStr));

            const safeSetText = (id, text) => {
                const el = document.getElementById(id);
                if (el) el.textContent = text;
            };

            safeSetText('stat-registered', viewRecords.length);
            safeSetText('stat-served', viewRecords.filter(r => r.status === 'Served').length);
            safeSetText('stat-waiting', viewRecords.filter(r => r.status === 'Waiting').length);
            safeSetText('stat-skipped', viewRecords.filter(r => r.status === 'Skipped' || r.status === 'No-show').length);
            safeSetText('stat-priority', viewRecords.filter(r => r.is_priority).length);
        }

        function clearFilters() {
            document.getElementById('searchInput').value = '';
            document.getElementById('filterStatus').value = '';
            document.getElementById('filterPriority').checked = false;
            applyFiltersAndSort();
        }

        function applyFiltersAndSort() {
            const term = document.getElementById('searchInput').value.toLowerCase();
            const status = document.getElementById('filterStatus').value;
            const prio = document.getElementById('filterPriority').checked;

            let activeFilters = 0;
            if (status) activeFilters++;
            if (prio) activeFilters++;

            const badge = document.getElementById('filterBadge');
            const clearBtn = document.getElementById('clearFiltersBtn');
            
            if (badge) {
                if (activeFilters > 0) {
                    badge.style.display = 'inline-block';
                    badge.textContent = activeFilters;
                } else {
                    badge.style.display = 'none';
                }
            }
            
            if (clearBtn) {
                if (activeFilters > 0 || term) {
                    clearBtn.style.display = 'inline';
                } else {
                    clearBtn.style.display = 'none';
                }
            }

            const viewStr = getViewDateString();

            filteredRecords = allRecords.filter(r => {
                if (!r.created_at || !r.created_at.startsWith(viewStr)) return false;
                if (status && r.status !== status) return false;
                if (prio && !r.is_priority) return false;

                if (term) {
                    const fname = r.full_name || '';
                    const ccd = r.ccd_no || '';
                    const contact = r.contact || '';
                    const email = r.email || '';
                    const address = r.address || '';
                    const stat = r.status || '';
                    const ageStr = r.age ? r.age.toString() : '';

                    return fname.toLowerCase().includes(term) ||
                        ccd.toLowerCase().includes(term) ||
                        contact.toLowerCase().includes(term) ||
                        email.toLowerCase().includes(term) ||
                        address.toLowerCase().includes(term) ||
                        stat.toLowerCase().includes(term) ||
                        ageStr.includes(term);
                }
                return true;
            });

            filteredRecords.sort((a, b) => {
                let valA = a[sortColumn];
                let valB = b[sortColumn];
                if (sortColumn === 'age') {
                    valA = parseInt(valA); valB = parseInt(valB);
                }
                if (valA < valB) return sortAsc ? -1 : 1;
                if (valA > valB) return sortAsc ? 1 : -1;
                return 0;
            });

            updateSummaryBar();
            renderTable();
        }

        function handleSort(col, thIndex) {
            if (sortColumn === col) sortAsc = !sortAsc;
            else { sortColumn = col; sortAsc = true; }

            const ths = document.querySelectorAll('#recordsTable th span');
            ths.forEach(span => span.textContent = '');
            ths[thIndex].textContent = sortAsc ? ' ▲' : ' ▼';

            applyFiltersAndSort();
        }

        function renderTable() {
            const tbody = document.getElementById('recordsBody');
            tbody.innerHTML = '';

            if (filteredRecords.length === 0) {
                tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; padding: 3rem; color: var(--text-muted);">No records found.</td></tr>`;
                document.getElementById('recordCount').textContent = "Showing 0 records";
                return;
            }

            filteredRecords.forEach(r => {
                const dateObj = new Date(r.created_at);
                const dateStr = dateObj.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
                const timeStr = dateObj.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' });

                const tr = document.createElement('tr');
                if (r.is_priority) tr.className = 'priority-row';

                tr.innerHTML = `
                    <td>${dateStr}</td>
                    <td>${timeStr}</td>
                    <td style="font-weight: 500;">${r.ccd_no || ''}</td>
                    <td>${r.full_name || ''}</td>
                    <td>${r.age || ''}</td>
                    <td>${r.contact || ''}</td>
                    <td>
                        <select onchange="updateCell(this, 'is_priority', '${r.id}')" class="status-badge ${r.is_priority ? 'badge-priority' : ''}" style="cursor: pointer; border: none; background: transparent; font-weight: bold; padding: 2px;">
                            <option value="false" ${!r.is_priority ? 'selected' : ''}>NO</option>
                            <option value="true" ${r.is_priority ? 'selected' : ''}>YES</option>
                        </select>
                    </td>
                    <td>
                        <select onchange="updateCell(this, 'status', '${r.id}')" class="status-badge" style="cursor: pointer; border: none; background: transparent; font-weight: bold; padding: 2px;">
                            <option value="Waiting" ${r.status === 'Waiting' ? 'selected' : ''}>Waiting</option>
                            <option value="Serving" ${r.status === 'Serving' ? 'selected' : ''}>Serving</option>
                            <option value="Served" ${r.status === 'Served' ? 'selected' : ''}>Served</option>
                            <option value="Skipped" ${r.status === 'Skipped' ? 'selected' : ''}>Skipped</option>
                            <option value="No-show" ${r.status === 'No-show' ? 'selected' : ''}>No-show</option>
                        </select>
                    </td>
                    <td style="text-align: center; white-space: nowrap;">
                        <button class="btn-formal" style="padding: 4px 8px; font-size: 0.8rem; margin-right: 4px;" onclick="openEditModal('${r.id}')" title="Edit Record">Edit</button>
                        <button class="btn-formal" style="padding: 4px 8px; font-size: 0.8rem; color: #ef4444;" onclick="cmDeleteRow('${r.id}')" title="Delete Record">Del</button>
                    </td>
                `;
                tbody.appendChild(tr);
            });

            document.getElementById('recordCount').textContent = `Showing ${filteredRecords.length} records`;
        }

        async function updateCell(element, field, id) {
            let newValue = element.value !== undefined ? element.value : element.innerText.trim();
            let payloadValue = newValue;
            if (field === 'is_priority') {
                payloadValue = (newValue === 'true' || newValue === true);
            }

            const oldRecord = allRecords.find(x => x.id === id);
            if (oldRecord) oldRecord[field] = payloadValue; // keep local cache fresh

            element.style.opacity = '0.5';
            
            try {
                const response = await fetch('/api/records/' + id, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ [field]: payloadValue })
                });
                
                if (!response.ok) {
                    showToast('Failed to save update.', true);
                } else {
                    if (field === 'is_priority' || field === 'status') {
                        renderTable(); // Re-render to update badge classes instantly
                    }
                }
            } catch (err) {
                console.error(err);
                showToast('Error saving data.', true);
            } finally {
                element.style.opacity = '1';
            }
        }

        // --- Modals Base ---
        function openModal(id) {
            document.getElementById(id).style.display = 'flex';
            document.body.style.overflow = 'hidden';
        }
        function closeModal(id) {
            document.getElementById(id).style.display = 'none';
            document.body.style.overflow = '';
        }

        // --- CRUD Operations ---
        async function viewDetails(id) {
            const r = allRecords.find(x => x.id === id);
            if (!r) return;

            // Fetch remarks for full details
            let remarksText = 'None';
            try {
                const res = await fetch(`/api/records/${id}/remarks`);
                const json = await res.json();
                if (json.success && json.data.text) remarksText = json.data.text;
            } catch (e) { }

            const dateStr = new Date(r.created_at).toLocaleString('en-PH');
            const html = `
                <div class="detail-row"><div class="detail-label">Control No.</div><div class="detail-value" style="color: var(--gold); font-weight: 800;">${r.ccd_no}</div></div>
                <div class="detail-row"><div class="detail-label">Registration</div><div class="detail-value">${dateStr}</div></div>
                <div class="detail-row"><div class="detail-label">Status</div><div class="detail-value">${r.status} ${r.is_priority ? '<span class="badge badge-priority" style="margin-left:5px;">Priority</span>' : ''}</div></div>
                <div class="detail-row"><div class="detail-label">Full Name</div><div class="detail-value">${r.full_name}</div></div>
                <div class="detail-row"><div class="detail-label">Demographics</div><div class="detail-value">${r.age} yrs • ${r.gender} • ${r.civil_status}</div></div>
                <div class="detail-row"><div class="detail-label">Contact Info</div><div class="detail-value">${r.contact} <br> ${r.email || 'No email provided'}</div></div>
                <div class="detail-row"><div class="detail-label">Address</div><div class="detail-value">${r.address}</div></div>
                <div class="detail-row"><div class="detail-label">Purpose</div><div class="detail-value">${r.purpose}</div></div>
                <div class="detail-row"><div class="detail-label">Referred By</div><div class="detail-value">${r.referred_by || 'N/A'}</div></div>
                <div class="detail-row" style="flex-direction: column; border-bottom: none;"><div class="detail-label" style="width: 100%; margin-bottom: 0.5rem;">Agent Remarks</div><div class="detail-value" style="width: 100%; background: var(--panel-bg); padding: 1rem; border-radius: 6px; border: 1px solid var(--border-color); white-space: pre-wrap;">${remarksText}</div></div>
            `;
            document.getElementById('viewDetailsContent').innerHTML = html;
            openModal('modalView');
        }

        // Old openEdit and submitEdit removed — replaced by openEditModal and new submitEdit below

        function openStatus(id, currentStatus) {
            document.getElementById('statusId').value = id;
            document.getElementById('newStatus').value = currentStatus;
            document.getElementById('statusRemarks').value = '';
            openModal('modalStatus');
        }

        async function submitStatus() {
            const id = document.getElementById('statusId').value;
            const newStatus = document.getElementById('newStatus').value;
            const remarks = document.getElementById('statusRemarks').value.trim();

            if (!remarks) { showToast("Remarks are required for status change.", true); return; }

            try {
                const response = await fetch(`/api/records/${id}/status`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ status: newStatus })
                });
                if ((await response.json()).success) {
                    showToast('Status updated successfully');
                    closeModal('modalStatus');

                    const idx = allRecords.findIndex(x => x.id === id);
                    if (idx !== -1) allRecords[idx].status = newStatus;
                    applyFiltersAndSort();
                } else { showToast('Failed to update status.', true); }
            } catch (err) { showToast('Server error.', true); }
        }

        async function openRemarks(id) {
            document.getElementById('remarksId').value = id;
            document.getElementById('remarksText').value = "Loading...";
            document.getElementById('remarksTimestamp').textContent = "";
            openModal('modalRemarks');

            try {
                const res = await fetch(`/api/records/${id}/remarks`);
                const json = await res.json();
                if (json.success) {
                    document.getElementById('remarksText').value = json.data.text || "";
                    if (json.data.last_modified) {
                        const d = new Date(json.data.last_modified).toLocaleString('en-PH');
                        document.getElementById('remarksTimestamp').textContent = `Last modified: ${d}`;
                    } else {
                        document.getElementById('remarksTimestamp').textContent = "No previous remarks.";
                    }
                }
            } catch (e) {
                document.getElementById('remarksText').value = "";
                showToast("Failed to load existing remarks", true);
            }
        }

        async function submitRemarks() {
            const id = document.getElementById('remarksId').value;
            const text = document.getElementById('remarksText').value;

            try {
                const response = await fetch(`/api/records/${id}/remarks`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text })
                });
                if ((await response.json()).success) {
                    showToast('Remarks saved successfully');
                    closeModal('modalRemarks');
                } else { showToast('Failed to save remarks.', true); }
            } catch (err) { showToast('Server error.', true); }
        }

        function confirmDelete(id) {
            document.getElementById('deleteId').value = id;
            openModal('modalDelete');
        }

        async function submitDelete() {
            const id = document.getElementById('deleteId').value;
            try {
                const response = await fetch(`/api/records/${id}`, { method: 'DELETE' });
                if ((await response.json()).success) {
                    showToast('Record deleted successfully');
                    closeModal('modalDelete');

                    // Instantly update local cache
                    allRecords = allRecords.filter(x => x.id !== id);
                    applyFiltersAndSort();
                } else { showToast('Failed to delete record. Please try again.', true); }
            } catch (err) { showToast('Server error. Deletion failed.', true); }
        }

        // --- Export & Reports ---
        function getExportData() {
            return filteredRecords.map(r => ({
                "Date & Time": new Date(r.created_at).toLocaleString('en-PH'),
                "CCD No.": r.ccd_no,
                "Full Name": r.full_name,
                "Age": r.age,
                "Contact": r.contact,
                "Gender": r.gender,
                "Civil Status": r.civil_status,
                "Address": r.address,
                "Purpose": r.purpose,
                "Priority": r.is_priority ? "YES" : "NO",
                "Queue Status": r.status
            }));
        }

        function exportToExcel() {
            if (filteredRecords.length === 0) return alert("No records to export.");
            const ws = XLSX.utils.json_to_sheet(getExportData());
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Records");
            XLSX.writeFile(wb, `NBI_Records_${getViewDateString()}.xlsx`);
        }

        function exportToCSV() {
            if (filteredRecords.length === 0) return alert("No records to export.");
            const ws = XLSX.utils.json_to_sheet(getExportData());
            const csv = XLSX.utils.sheet_to_csv(ws);
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement("a");
            link.href = URL.createObjectURL(blob);
            link.download = `NBI_Records_${getViewDateString()}.csv`;
            link.click();
        }

        function exportToPDF() {
            if (filteredRecords.length === 0) return alert("No records to export.");
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF('landscape');
            doc.setFontSize(16);
            doc.text("NBI Cybercrime Division - Official Records", 14, 15);
            doc.setFontSize(10);
            doc.text(`Generated: ${new Date().toLocaleString('en-PH')}`, 14, 22);

            const tableData = filteredRecords.map(r => [
                new Date(r.created_at).toLocaleString('en-PH'), r.ccd_no, r.full_name, r.age, r.contact, r.status
            ]);

            doc.autoTable({
                head: [['Date & Time', 'CCD No.', 'Full Name', 'Age', 'Contact', 'Status']],
                body: tableData,
                startY: 28,
                styles: { fontSize: 8 }
            });
            doc.save(`NBI_Records_${getViewDateString()}.pdf`);
        }

        function exportToWord() {
            if (filteredRecords.length === 0) return alert("No records to export.");

            let html = `
            <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
            <head><meta charset='utf-8'><title>NBI Records</title>
            
    

            </head>
            <body>

    <!-- Hidden elements to preserve JS compatibility -->
    <div style="display: none;">
        <span id="themeToggle"></span>
        <span id="filterBadge"></span>
        <span id="clearFiltersBtn"></span>
        <span id="statsContext"></span>
        <span id="stat-registered"></span>
        <span id="stat-served"></span>
        <span id="stat-waiting"></span>
        <span id="stat-skipped"></span>
        <span id="stat-priority"></span>
    </div>

                <h1>NBI Cybercrime Division - Official Records</h1>
                <p><strong>Generated on:</strong> ${new Date().toLocaleString('en-PH')}</p>
                <p><strong>Date:</strong> ${getViewDateString()}</p>
                <table>
                    <tr>
                        <th>Date & Time</th><th>CCD No.</th><th>Full Name</th>
                        <th>Age</th><th>Contact</th><th>Status</th><th>Priority</th>
                    </tr>`;

            filteredRecords.forEach(r => {
                html += `<tr>
                    <td>${new Date(r.created_at).toLocaleString('en-PH')}</td>
                    <td>${r.ccd_no}</td>
                    <td>${r.full_name}</td>
                    <td>${r.age}</td>
                    <td>${r.contact}</td>
                    <td>${r.status}</td>
                    <td>${r.is_priority ? 'YES' : 'NO'}</td>
                </tr>`;
            });
            html += `</table></body></html>`;

            const blob = new Blob(['\ufeff', html], { type: 'application/msword' });
            const link = document.createElement("a");
            link.href = URL.createObjectURL(blob);
            link.download = `NBI_Records_${getViewDateString()}.doc`;
            link.click();
        }

        function generateEODReport() {
            const viewStr = getViewDateString();
            const viewRecords = allRecords.filter(r => r.created_at.startsWith(viewStr));

            let html = `<div style="margin-bottom: 20px;"><strong>Date:</strong> ${viewStr}</div>`;
            html += `<table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; color: var(--text-main);">
                <tr><td style="border: 1px solid var(--border-color); padding: 10px;">Total Registered</td><td style="border: 1px solid var(--border-color); padding: 10px; font-weight: bold;">${viewRecords.length}</td></tr>
                <tr><td style="border: 1px solid var(--border-color); padding: 10px;">Served</td><td style="border: 1px solid var(--border-color); padding: 10px; color: #2ecc71;">${viewRecords.filter(r => r.status === 'Served').length}</td></tr>
                <tr><td style="border: 1px solid var(--border-color); padding: 10px;">Waiting Left</td><td style="border: 1px solid var(--border-color); padding: 10px; color: #3498db;">${viewRecords.filter(r => r.status === 'Waiting').length}</td></tr>
                <tr><td style="border: 1px solid var(--border-color); padding: 10px;">Skipped/No-Show</td><td style="border: 1px solid var(--border-color); padding: 10px; color: #e74c3c;">${viewRecords.filter(r => r.status === 'Skipped' || r.status === 'No-show').length}</td></tr>
                <tr><td style="border: 1px solid var(--border-color); padding: 10px;">Priority (PWD/Senior)</td><td style="border: 1px solid var(--border-color); padding: 10px; color: var(--red);">${viewRecords.filter(r => r.is_priority).length}</td></tr>
            </table>`;

            document.getElementById('eodContent').innerHTML = html;
            openModal('modalEOD');
        }

        function exportEODToPDF() {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            const viewStr = getViewDateString();

            doc.setFontSize(16);
            doc.text("NBI Cybercrime Division - End of Day Report", 14, 20);
            doc.setFontSize(12);
            doc.text(`Date: ${viewStr}`, 14, 30);

            const viewRecords = allRecords.filter(r => r.created_at.startsWith(viewStr));

            doc.autoTable({
                startY: 40,
                head: [['Metric', 'Count']],
                body: [
                    ['Total Registered', viewRecords.length],
                    ['Served', viewRecords.filter(r => r.status === 'Served').length],
                    ['Waiting Left', viewRecords.filter(r => r.status === 'Waiting').length],
                    ['Skipped / No-show', viewRecords.filter(r => r.status === 'Skipped' || r.status === 'No-show').length],
                    ['Priority (PWD/Senior)', viewRecords.filter(r => r.is_priority).length]
                ]
            });

            doc.save(`NBI_EOD_Report_${viewStr}.pdf`);
        }

        // --- Bulk CSV Import ---
        async function handleCSVImport(event) {
            const file = event.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = async function(e) {
                const text = e.target.result;
                const rows = text.split('\\n');
                if (rows.length < 2) {
                    showToast("CSV file is empty or missing headers", true);
                    return;
                }

                const headers = rows[0].split(',').map(h => h.trim().toLowerCase());
                const records = [];

                for (let i = 1; i < rows.length; i++) {
                    const row = rows[i];
                    if (!row.trim()) continue;
                    
                    // Simple CSV parsing (does not handle quoted commas properly, but fine for basic)
                    const values = row.split(',').map(v => v.trim());
                    const record = {};
                    
                    headers.forEach((h, index) => {
                        let val = values[index] !== undefined ? values[index] : null;
                        if (val === '') val = null;
                        
                        if (h === 'age') val = val ? parseInt(val) : 0;
                        if (h === 'is_priority') val = (val === 'true' || val === '1' || val === 'yes');
                        
                        // Map CSV headers to database columns if needed
                        record[h] = val;
                    });
                    
                    // Fallbacks for required fields based on Schema Finalization
                    if (!record.ccd_no) record.ccd_no = 'CCD-IMPORT-' + Date.now() + '-' + i;
                    if (!record.full_name) record.full_name = 'Unknown Name';
                    if (!record.status) record.status = 'Waiting';
                    if (!record.age) record.age = 0;

                    records.push(record);
                }

                if (records.length === 0) return;

                try {
                    showToast("Importing " + records.length + " records...");
                    const response = await fetch('/api/import', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ records })
                    });
                    
                    const result = await response.json();
                    if (result.success) {
                        showToast(`Successfully imported ${result.count} records!`);
                        fetchRecords(); // Refresh the grid
                    } else {
                        showToast("Import failed: " + result.error, true);
                    }
                } catch (err) {
                    showToast("Import failed: " + err.message, true);
                }
                
                // Clear the input so the same file can be uploaded again if needed
                event.target.value = '';
            };
            reader.readAsText(file);
        }

        // --- Toasts (React-Toastify Style) ---
        function showToast(msg, isError = false, type = 'info') {
            const container = document.getElementById('toastContainer') || document.body.appendChild(Object.assign(document.createElement('div'), {id: 'toastContainer', className: 'toast-container'}));
            const toast = document.createElement('div');
            let themeClass = isError ? 'error' : type;
            toast.className = `toast ${themeClass}`;
            
            let iconSvg = '<svg viewBox="0 0 24 24" fill="#3498db"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>'; // info
            if(isError) iconSvg = '<svg viewBox="0 0 24 24" fill="#e74c3c"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>'; // error
            if(type === 'success' && !isError) iconSvg = '<svg viewBox="0 0 24 24" fill="#2ecc71"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>'; // success

            toast.innerHTML = `
                <div class="toast-icon">${iconSvg}</div>
                <div class="toast-content">${msg}</div>
                <div class="toast-progress"></div>
            `;
            container.appendChild(toast);

            setTimeout(() => toast.classList.add('show'), 10);
            setTimeout(() => {
                toast.classList.remove('show');
                setTimeout(() => toast.remove(), 300);
            }, 3000);
        }
            // --- Ribbon Tabs Logic ---
        function switchTab(tabName) {
            // Update tabs
            ['home', 'insert', 'data'].forEach(t => {
                document.getElementById('tab-' + t).classList.remove('active');
                document.getElementById('toolbar-' + t).style.display = 'none';
            });
            document.getElementById('tab-' + tabName).classList.add('active');
            document.getElementById('toolbar-' + tabName).style.display = 'flex';
        }

        // --- Removed spreadsheet clipboard and keyboard handlers ---

        // --- Global Add/Edit Modal Logic ---
        function openAddModal() {
            document.getElementById('editId').value = ''; 
            document.getElementById('editForm').reset();
            document.getElementById('modalEdit').querySelector('.modal-title').textContent = 'Add New Record';
            openModal('modalEdit');
        }

        function openEditModal(id) {
            const record = allRecords.find(r => r.id === id);
            if (!record) return;
            
            document.getElementById('editId').value = record.id;
            document.getElementById('editName').value = record.full_name || '';
            document.getElementById('editAge').value = record.age || '';
            document.getElementById('editContact').value = record.contact || '';
            document.getElementById('editEmail').value = record.email || '';
            document.getElementById('editGender').value = record.gender || 'Prefer not to say';
            document.getElementById('editCivil').value = record.civil_status || 'Single';
            document.getElementById('editAddress').value = record.address || '';
            document.getElementById('editPurpose').value = record.purpose || 'File a Complaint';
            document.getElementById('editReferred').value = record.referred_by || '';
            document.getElementById('editPriority').checked = record.is_priority || false;
            
            document.getElementById('modalEdit').querySelector('.modal-title').textContent = 'Edit Record';
            openModal('modalEdit');
        }

        async function submitEdit(e) {
            e.preventDefault();
            const id = document.getElementById('editId').value;
            const payload = {
                full_name: document.getElementById('editName').value,
                age: document.getElementById('editAge').value,
                contact: document.getElementById('editContact').value,
                email: document.getElementById('editEmail').value,
                gender: document.getElementById('editGender').value,
                civil_status: document.getElementById('editCivil').value,
                address: document.getElementById('editAddress').value,
                purpose: document.getElementById('editPurpose').value,
                referred_by: document.getElementById('editReferred').value,
                is_priority: document.getElementById('editPriority').checked
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
                    // Add new record via the import endpoint
                    payload.ccd_no = 'CCD-' + Date.now();
                    payload.status = 'Waiting';
                    payload.created_at = new Date().toISOString();
                    res = await fetch('/api/import', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ records: [payload] })
                    });
                }

                if(res.ok) {
                    showToast(id ? 'Record updated!' : 'Record added!', false, "success");
                    closeModal('modalEdit');
                    fetchRecords();
                } else {
                    showToast('Failed to save record.', true);
                }
            } catch(err) {
                console.error(err);
                showToast('Network error.', true);
            }
        }

        async function cmDeleteRow(rowId) {
            document.getElementById('confirmMessage').innerText = "Are you sure you want to completely delete this record? This cannot be undone.";
            openModal('modalConfirm');
            
            document.getElementById('confirmYesBtn').onclick = async function() {
                closeModal('modalConfirm');
                try {
                    const res = await fetch('/api/records/' + rowId, { method: 'DELETE' });
                    const result = await res.json();
                    if(result.success) {
                        showToast("Row deleted successfully!", false, "success");
                        fetchRecords();
                    } else {
                        showToast("Failed to delete row.", true);
                    }
                } catch(err) {
                    showToast("Server error deleting row.", true);
                }
            };
        }


        // --- Socket.IO Realtime Notifications ---
        if (typeof io !== 'undefined') {
            const socket = io();
            let previousTotal = null;
            socket.on('staff_update', (data) => {
                if (previousTotal !== null && data.stats && data.stats.total > previousTotal) {
                    showToast("New registration added!", false, "success");
                    fetchRecords(); // auto refresh grid
                }
                if (data.stats) previousTotal = data.stats.total;
            });

            socket.on('available_voices_update', (voices) => {
                const select = document.getElementById('voiceSelect');
                if(!select) return;
                select.innerHTML = '<option value="">-- Let System Decide --</option>';
                voices.forEach(v => {
                    let opt = document.createElement('option');
                    opt.value = v.voiceURI;
                    opt.textContent = `${v.name} (${v.lang})`;
                    select.appendChild(opt);
                });
            });

            socket.on('voice_settings_update', (settings) => {
                const select = document.getElementById('voiceSelect');
                if(select && settings.voiceURI) select.value = settings.voiceURI;
            });

            window.saveVoiceSetting = function() {
                const voiceURI = document.getElementById('voiceSelect').value;
                socket.emit('update_voice_settings', { voiceURI });
                closeModal('modalVoice');
                showToast('Voice settings updated for TV Display', false, 'success');
            }
            window.testVoiceDisplay = function() {
                socket.emit('trigger_test_voice');
                showToast('Test announcement triggered on TV Display', false, 'success');
            }
        }

