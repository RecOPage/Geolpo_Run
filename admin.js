/**
 * 관리자(교사) 모드 기능 및 대시보드 로직
 */

document.addEventListener('DOMContentLoaded', () => {
  // 모달 및 버튼 참조
  const adminOpenBtn = document.getElementById('btn-open-admin');
  const adminAuthModal = document.getElementById('modal-admin-auth');
  const adminAuthCloseBtn = document.getElementById('btn-close-admin-auth');
  const adminCodeInput = document.getElementById('admin-code-input');
  const adminSubmitBtn = document.getElementById('btn-submit-admin-code');
  const adminAuthError = document.getElementById('admin-auth-error');

  const adminDashboardModal = document.getElementById('modal-admin-dashboard');
  const adminDashboardCloseBtn = document.getElementById('btn-close-admin-dashboard');
  
  // 관리자 대시보드 내부 컨트롤
  const filterDate = document.getElementById('admin-filter-date');
  const filterGrade = document.getElementById('admin-filter-grade');
  const filterClass = document.getElementById('admin-filter-class');
  const btnExportCsv = document.getElementById('btn-export-csv');
  const recordsTbody = document.getElementById('admin-records-tbody');
  
  const adminTotalCountEl = document.getElementById('admin-total-records');
  const adminTotalLapsEl = document.getElementById('admin-total-laps');
  const adminTotalKmEl = document.getElementById('admin-total-km');

  // 설정 탭 / 모달
  const btnOpenSettings = document.getElementById('btn-open-settings');
  const modalSettings = document.getElementById('modal-admin-settings');
  const btnCloseSettings = document.getElementById('btn-close-settings');
  const inputLapMeters = document.getElementById('setting-lap-meters');
  const inputNewCode = document.getElementById('setting-new-code');
  const btnSaveSettings = document.getElementById('btn-save-settings');

  // 기록 수정 모달
  const modalEdit = document.getElementById('modal-edit-record');
  const btnCloseEdit = document.getElementById('btn-close-edit');
  const editStudentInfo = document.getElementById('edit-student-info');
  const editLapsInput = document.getElementById('edit-laps-input');
  const btnSaveEdit = document.getElementById('btn-save-edit');
  let currentEditingRecordId = null;

  // 관리자 로그인 상태
  let isAdminAuthenticated = false;

  // 오늘 날짜를 필터 기본값으로 설정
  const todayStr = window.db.getTodayDateString();
  if (filterDate) {
    filterDate.value = todayStr;
  }

  // 관리자 인증 모달 열기
  adminOpenBtn.addEventListener('click', () => {
    if (isAdminAuthenticated) {
      openAdminDashboard();
    } else {
      adminCodeInput.value = '';
      adminAuthError.style.display = 'none';
      adminAuthModal.classList.add('show');
      setTimeout(() => adminCodeInput.focus(), 150);
    }
  });

  adminAuthCloseBtn.addEventListener('click', () => {
    adminAuthModal.classList.remove('show');
  });

  // 관리자 코드 확인
  adminSubmitBtn.addEventListener('click', () => {
    const entered = adminCodeInput.value;
    if (window.db.verifyAdminCode(entered)) {
      isAdminAuthenticated = true;
      adminAuthModal.classList.remove('show');
      openAdminDashboard();
    } else {
      adminAuthError.textContent = '관리자 코드가 일치하지 않습니다.';
      adminAuthError.style.display = 'block';
      adminCodeInput.select();
    }
  });

  adminCodeInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      adminSubmitBtn.click();
    }
  });

  // 관리자 대시보드 열기
  function openAdminDashboard() {
    adminDashboardModal.classList.add('show');
    loadAdminRecords();
  }

  adminDashboardCloseBtn.addEventListener('click', () => {
    adminDashboardModal.classList.remove('show');
  });

  // 필터 변경 시 목록 갱신
  [filterDate, filterGrade, filterClass].forEach(el => {
    if (el) {
      el.addEventListener('change', () => loadAdminRecords());
    }
  });

  // 관리자 기록 목록 로드 및 렌더링
  async function loadAdminRecords() {
    recordsTbody.innerHTML = `<tr><td colspan="5" class="empty-state">기록을 불러오는 중...</td></tr>`;

    const filters = {
      date: filterDate.value || '',
      grade: filterGrade.value || '',
      classNum: filterClass.value || ''
    };

    const records = await window.db.getRecords(filters);

    // 상단 통계 수치 갱신
    let totalLaps = 0;
    let totalMeters = 0;
    records.forEach(r => {
      totalLaps += r.laps;
      totalMeters += r.distance;
    });

    adminTotalCountEl.textContent = `${records.length}건`;
    adminTotalLapsEl.textContent = `${totalLaps}바퀴`;
    adminTotalKmEl.textContent = `${(totalMeters / 1000).toFixed(2)} km`;

    if (records.length === 0) {
      recordsTbody.innerHTML = `<tr><td colspan="5" class="empty-state">해당 조건의 기록이 없습니다.</td></tr>`;
      return;
    }

    recordsTbody.innerHTML = '';
    records.forEach(r => {
      const tr = document.createElement('tr');
      const studentCell = document.createElement('td');
      const studentStrong = document.createElement('strong');
      const studentInfo = `${r.grade}학년 ${r.classNum}반 ${r.studentNum}번`;
      studentStrong.textContent = studentInfo;
      studentCell.appendChild(studentStrong);

      const recordCell = document.createElement('td');
      const lapSpan = document.createElement('span');
      lapSpan.style.color = 'var(--primary)';
      lapSpan.style.fontWeight = '700';
      lapSpan.textContent = `${r.laps}바퀴`;
      recordCell.append(lapSpan, document.createTextNode(` (${r.distance}m)`));

      const dateCell = document.createElement('td');
      dateCell.style.color = 'var(--text-muted)';
      dateCell.style.fontSize = '0.82rem';
      dateCell.textContent = `${r.date} ${r.displayTime || ''}`;

      const actionCell = document.createElement('td');
      actionCell.style.textAlign = 'right';
      const editButton = document.createElement('button');
      editButton.className = 'btn-edit';
      editButton.dataset.id = r.id;
      editButton.dataset.laps = r.laps;
      editButton.dataset.info = studentInfo;
      editButton.textContent = '수정';
      const deleteButton = document.createElement('button');
      deleteButton.className = 'btn-danger';
      deleteButton.dataset.id = r.id;
      deleteButton.textContent = '삭제';
      actionCell.append(editButton, deleteButton);
      tr.append(studentCell, recordCell, dateCell, actionCell);

      // 수정 버튼
      tr.querySelector('.btn-edit').addEventListener('click', (e) => {
        const btn = e.currentTarget;
        currentEditingRecordId = btn.dataset.id;
        editStudentInfo.textContent = btn.dataset.info;
        editLapsInput.value = btn.dataset.laps;
        modalEdit.classList.add('show');
      });

      // 삭제 버튼
      tr.querySelector('.btn-danger').addEventListener('click', async (e) => {
        const id = e.currentTarget.dataset.id;
        if (confirm('정말로 이 달리기 기록을 삭제하시겠습니까?')) {
          try {
            await window.db.deleteRecord(id);
            showToast('기록이 삭제되었습니다.');
            await loadAdminRecords();
            if (window.refreshMainRankings) window.refreshMainRankings();
          } catch (error) {
            console.error('기록 삭제 실패:', error);
            showToast('클라우드 기록을 삭제하지 못했습니다. 연결과 권한을 확인해주세요.');
          }
        }
      });

      recordsTbody.appendChild(tr);
    });
  }

  // 엑셀(CSV) 내보내기
  btnExportCsv.addEventListener('click', async () => {
    const filters = {
      date: filterDate.value || '',
      grade: filterGrade.value || '',
      classNum: filterClass.value || ''
    };
    const records = await window.db.getRecords(filters);
    window.db.exportToCSV(records);
  });

  // 기록 수정 저장
  btnSaveEdit.addEventListener('click', async () => {
    const newLaps = parseInt(editLapsInput.value, 10);
    const maxLaps = window.db.settings.maxLapsPerEntry || 30;
    if (isNaN(newLaps) || newLaps <= 0 || newLaps > maxLaps) {
      alert(`바퀴 수를 1~${maxLaps} 사이로 입력해주세요.`);
      return;
    }

    if (currentEditingRecordId) {
      try {
        await window.db.updateRecord(currentEditingRecordId, { laps: newLaps });
        modalEdit.classList.remove('show');
        showToast('기록이 성공적으로 수정되었습니다.');
        await loadAdminRecords();
        if (window.refreshMainRankings) window.refreshMainRankings();
      } catch (error) {
        console.error('기록 수정 실패:', error);
        showToast('클라우드 기록을 수정하지 못했습니다. 연결과 권한을 확인해주세요.');
      }
    }
  });

  btnCloseEdit.addEventListener('click', () => {
    modalEdit.classList.remove('show');
  });

  // 환경 설정 모달 제어
  btnOpenSettings.addEventListener('click', () => {
    inputLapMeters.value = window.db.settings.lapLengthMeters || 150;
    inputNewCode.value = window.db.settings.adminCode || '1378';
    
    modalSettings.classList.add('show');
  });

  btnCloseSettings.addEventListener('click', () => {
    modalSettings.classList.remove('show');
  });

  btnSaveSettings.addEventListener('click', () => {
    const lapMeters = parseInt(inputLapMeters.value, 10);
    const newCode = inputNewCode.value.trim();

    if (isNaN(lapMeters) || lapMeters <= 0) {
      alert('운동장 거리를 올바른 숫자로 입력해주세요.');
      return;
    }
    if (!newCode) {
      alert('관리자 코드를 입력해주세요.');
      return;
    }

    window.db.saveSettings({
      lapLengthMeters: lapMeters,
      adminCode: newCode
    });

    modalSettings.classList.remove('show');
    showToast('설정이 성공적으로 저장되었습니다.');
  });
});
