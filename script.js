(function() {
    'use strict';

    // ============================================================
    // DATA LAYER
    // ============================================================
    const STORAGE_KEY = 'kliniksehat_reservations';
    const DOCTOR_PASSWORD = 'dokter123';

    function getReservations() {
        try {
            const data = localStorage.getItem(STORAGE_KEY);
            return data ? JSON.parse(data) : [];
        } catch { return []; }
    }

    function saveReservations(list) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    }

    function generateId() {
        return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    }

    function getTodayStr() {
        const d = new Date();
        return d.getFullYear() + '-' +
            String(d.getMonth() + 1).padStart(2, '0') + '-' +
            String(d.getDate()).padStart(2, '0');
    }

    function getTodayReservations() {
        const today = getTodayStr();
        return getReservations().filter(r => r.date === today);
    }

    function getNextQueueNumber() {
        const todayList = getTodayReservations();
        if (todayList.length === 0) return 1;
        const max = todayList.reduce((max, r) => Math.max(max, r.queueNumber), 0);
        return max + 1;
    }

    // ============================================================
    // TOAST
    // ============================================================
    function showToast(message, isError = false) {
        const container = document.getElementById('toastContainer');
        const el = document.createElement('div');
        el.className = 'toast-custom' + (isError ? ' error' : '');
        el.innerHTML = `
            <div class="d-flex align-items-center gap-2">
                <i class="bi ${isError ? 'bi-x-circle-fill text-danger' : 'bi-check-circle-fill text-accent'} fs-5"></i>
                <span class="fw-medium">${message}</span>
                <button type="button" class="btn-close ms-auto" style="font-size:0.7rem;" onclick="this.parentElement.parentElement.remove()"></button>
            </div>
        `;
        container.appendChild(el);
        setTimeout(() => { if (el.parentElement) el.remove(); }, 5000);
    }

    // ============================================================
    // RENDER QUEUE (PASIEN)
    // ============================================================
    function renderPatientQueue() {
        const todayList = getTodayReservations();
        todayList.sort((a, b) => a.queueNumber - b.queueNumber);

        const tbody = document.getElementById('queueBody');
        const empty = document.getElementById('emptyQueue');
        const countDisplay = document.getElementById('queueCountDisplay');

        countDisplay.textContent = todayList.length + ' pasien';

        if (todayList.length === 0) {
            tbody.innerHTML = '';
            empty.style.display = 'block';
            return;
        }
        empty.style.display = 'none';

        const statusMap = {
            waiting: { label: 'Menunggu', cls: 'waiting' },
            called: { label: 'Dipanggil', cls: 'called' },
            consultation: { label: 'Konsultasi', cls: 'consultation' },
            done: { label: 'Selesai', cls: 'done' },
        };

        let html = '';
        todayList.forEach(r => {
            const st = statusMap[r.status] || statusMap.waiting;
            html += `
                <tr>
                    <td><strong>#${r.queueNumber}</strong></td>
                    <td>${escapeHtml(r.patientName)}</td>
                    <td>${r.time || '—'}</td>
                    <td><span class="badge-status ${st.cls}">${st.label}</span></td>
                </tr>
            `;
        });
        tbody.innerHTML = html;
    }

    // ============================================================
    // RENDER QUEUE (ADMIN)
    // ============================================================
    function renderAdminQueue() {
        const todayList = getTodayReservations();
        todayList.sort((a, b) => a.queueNumber - b.queueNumber);

        const tbody = document.getElementById('adminQueueBody');
        const empty = document.getElementById('adminEmptyQueue');

        if (todayList.length === 0) {
            tbody.innerHTML = '';
            empty.style.display = 'block';
            return;
        }
        empty.style.display = 'none';

        const statusMap = {
            waiting: { label: 'Menunggu', cls: 'waiting' },
            called: { label: 'Dipanggil', cls: 'called' },
            consultation: { label: 'Konsultasi', cls: 'consultation' },
            done: { label: 'Selesai', cls: 'done' },
        };

        let html = '';
        todayList.forEach(r => {
            const st = statusMap[r.status] || statusMap.waiting;
            const isDone = r.status === 'done';
            let actions = '';
            if (!isDone) {
                actions += `
                    <button class="btn btn-sm-outline update-status-btn" data-id="${r.id}" data-status="called" title="Panggil">📢</button>
                    <button class="btn btn-sm-outline update-status-btn" data-id="${r.id}" data-status="consultation" title="Konsultasi">🩺</button>
                `;
            }
            if (r.status !== 'done') {
                actions += `
                    <button class="btn btn-sm-success-outline update-status-btn" data-id="${r.id}" data-status="done" title="Selesai">✅</button>
                `;
            }
            if (r.status === 'waiting') {
                actions += `
                    <button class="btn btn-sm-outline text-danger border-danger update-status-btn" data-id="${r.id}" data-status="done" title="Batalkan">✖</button>
                `;
            }
            if (!actions) actions = '<span class="text-muted small">—</span>';

            html += `
                <tr>
                    <td><strong>#${r.queueNumber}</strong></td>
                    <td>${escapeHtml(r.patientName)}</td>
                    <td>${r.time || '—'}</td>
                    <td><span class="badge-status ${st.cls}">${st.label}</span></td>
                    <td class="action-cell">${actions}</td>
                </tr>
            `;
        });
        tbody.innerHTML = html;

        document.querySelectorAll('#adminQueueBody .update-status-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const id = this.dataset.id;
                const status = this.dataset.status;
                updateReservationStatus(id, status);
            });
        });
    }

    function escapeHtml(text) {
        if (!text) return '';
        return text.replace(/[&<>\"]/g, function(m) {
            if (m === '&') return '&amp;';
            if (m === '<') return '&lt;';
            if (m === '>') return '&gt;';
            if (m === '"') return '&quot;';
            return m;
        });
    }

    // ============================================================
    // UPDATE STATUS (digunakan admin)
    // ============================================================
    function updateReservationStatus(id, newStatus) {
        const list = getReservations();
        const idx = list.findIndex(r => r.id === id);
        if (idx === -1) {
            showToast('Data tidak ditemukan.', true);
            return;
        }
        list[idx].status = newStatus;
        saveReservations(list);
        renderPatientQueue();
        renderAdminQueue();
        updateQueueDisplay();
        showToast(`Status antrian #${list[idx].queueNumber} diperbarui.`);
    }

    // ============================================================
    // UPDATE QUEUE DISPLAY (untuk pasien)
    // ============================================================
    function updateQueueDisplay() {
        const todayList = getTodayReservations();
        const latest = todayList.length > 0 ? todayList[todayList.length - 1] : null;

        const numEl = document.getElementById('displayQueueNumber');
        const statusEl = document.getElementById('displayQueueStatus');
        const waitEl = document.getElementById('estWaitTime');

        if (todayList.length === 0) {
            numEl.textContent = '—';
            statusEl.textContent = 'Belum reservasi';
            waitEl.textContent = '~15-30 menit';
            return;
        }

        numEl.textContent = '#' + latest.queueNumber;
        const statusMap = {
            waiting: 'Menunggu',
            called: 'Dipanggil',
            consultation: 'Konsultasi',
            done: 'Selesai'
        };
        statusEl.textContent = 'Status: ' + (statusMap[latest.status] || 'Menunggu');

        const waitingCount = todayList.filter(r => r.status === 'waiting' || r.status === 'called').length;
        if (waitingCount === 0) {
            waitEl.textContent = 'Segera dilayani';
        } else if (waitingCount <= 2) {
            waitEl.textContent = '~15-30 menit';
        } else if (waitingCount <= 5) {
            waitEl.textContent = '~30-60 menit';
        } else {
            waitEl.textContent = '~60-90 menit';
        }
    }

    // ============================================================
    // RESERVATION FORM (PASIEN)
    // ============================================================
    const form = document.getElementById('reservationForm');
    const dateInput = document.getElementById('reservationDate');
    dateInput.value = getTodayStr();
    dateInput.min = getTodayStr();

    form.addEventListener('submit', function(e) {
        e.preventDefault();

        const name = document.getElementById('patientName').value.trim();
        const phone = document.getElementById('patientPhone').value.trim();
        const date = document.getElementById('reservationDate').value;
        const time = document.getElementById('reservationTime').value.trim();
        const complaint = document.getElementById('patientComplaint').value.trim();

        if (!name || !phone || !date || !time) {
            showToast('Harap isi semua data yang wajib.', true);
            return;
        }
        if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
            showToast('Masukkan waktu dengan format JJ:MM, misalnya 08:30.', true);
            return;
        }
        if (phone.length < 8) {
            showToast('Nomor WhatsApp tidak valid.', true);
            return;
        }
        if (date < getTodayStr()) {
            showToast('Tanggal tidak boleh kurang dari hari ini.', true);
            return;
        }

        const todayList = getTodayReservations();
        const existing = todayList.find(r => r.patientPhone === phone && r.date === date);
        if (existing) {
            showToast(`Anda sudah memiliki antrian #${existing.queueNumber} hari ini.`, true);
            return;
        }

        const queueNumber = getNextQueueNumber();
        const newRes = {
            id: generateId(),
            queueNumber: queueNumber,
            patientName: name,
            patientPhone: phone,
            date: date,
            time: time,
            complaint: complaint || '-',
            status: 'waiting',
            createdAt: new Date().toISOString(),
        };

        const list = getReservations();
        list.push(newRes);
        saveReservations(list);

        document.getElementById('patientName').value = '';
        document.getElementById('patientPhone').value = '';
        document.getElementById('patientComplaint').value = '';

        renderPatientQueue();
        renderAdminQueue();
        updateQueueDisplay();

        showToast(`✅ Reservasi berhasil! Nomor antrian Anda #${queueNumber}`);
        document.getElementById('antrian').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    // ============================================================
    // ADMIN AUTH & VIEW SWITCHING
    // ============================================================
    let isAdmin = false;

    function checkAdminMode() {
        const urlParams = new URLSearchParams(window.location.search);
        const adminParam = urlParams.get('admin');
        if (adminParam === 'true') {
            document.getElementById('patientView').style.display = 'none';
            document.getElementById('adminView').style.display = 'block';
            const stored = sessionStorage.getItem('adminLoggedIn');
            if (stored === 'true') {
                isAdmin = true;
                showAdminPanel();
            } else {
                showAdminLogin();
            }
        } else {
            document.getElementById('patientView').style.display = 'block';
            document.getElementById('adminView').style.display = 'none';
            sessionStorage.removeItem('adminLoggedIn');
        }
    }

    function showAdminLogin() {
        document.getElementById('adminLoginScreen').classList.add('active');
        document.getElementById('adminPanelWrapper').style.display = 'none';
    }

    function showAdminPanel() {
        document.getElementById('adminLoginScreen').classList.remove('active');
        document.getElementById('adminPanelWrapper').style.display = 'block';
        isAdmin = true;
        renderAdminQueue();
    }

    document.getElementById('adminLoginForm').addEventListener('submit', function(e) {
        e.preventDefault();
        const password = document.getElementById('adminPassword').value.trim();
        if (password === DOCTOR_PASSWORD) {
            isAdmin = true;
            sessionStorage.setItem('adminLoggedIn', 'true');
            showAdminPanel();
            showToast('✅ Login berhasil.');
            document.getElementById('adminPassword').value = '';
        } else {
            showToast('❌ Password salah.', true);
        }
    });

    document.getElementById('adminLogoutBtn').addEventListener('click', function() {
        sessionStorage.removeItem('adminLoggedIn');
        isAdmin = false;
        showAdminLogin();
        showToast('Anda telah logout.');
    });

    document.getElementById('resetQueueBtnAdmin').addEventListener('click', function() {
        if (!isAdmin) {
            showToast('Silakan login admin terlebih dahulu.', true);
            return;
        }
        if (!confirm('Hapus seluruh antrian? Data tidak dapat dikembalikan.')) return;

        // Kosongkan seluruh data antrian agar nomor berikutnya dimulai dari #1.
        saveReservations([]);
        renderPatientQueue();
        renderAdminQueue();
        updateQueueDisplay();
        showToast('Semua antrian telah dikosongkan.');
    });

    document.getElementById('backToPatientBtn').addEventListener('click', function(e) {
        e.preventDefault();
        const url = new URL(window.location);
        url.searchParams.delete('admin');
        window.location.href = url.toString();
    });

    document.getElementById('backToPatientFromAdmin').addEventListener('click', function(e) {
        e.preventDefault();
        const url = new URL(window.location);
        url.searchParams.delete('admin');
        window.location.href = url.toString();
    });

    // ============================================================
    // SCROLL ANIMATION (hanya untuk pasien)
    // ============================================================
    function initScrollAnimations() {
        const els = document.querySelectorAll('#patientView .fade-up');
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                }
            });
        }, { threshold: 0.15 });
        els.forEach(el => observer.observe(el));
    }

    // ============================================================
    // INIT
    // ============================================================
    checkAdminMode();
    renderPatientQueue();
    renderAdminQueue();
    updateQueueDisplay();
    initScrollAnimations();

    setInterval(() => {
        renderPatientQueue();
        renderAdminQueue();
        updateQueueDisplay();
    }, 30000);

    window.addEventListener('storage', function(e) {
        if (e.key === STORAGE_KEY) {
            renderPatientQueue();
            renderAdminQueue();
            updateQueueDisplay();
        }
    });

    window.addEventListener('popstate', function() {
        checkAdminMode();
        renderPatientQueue();
        renderAdminQueue();
        updateQueueDisplay();
    });

})();
