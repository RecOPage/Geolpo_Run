/**
 * 걸포 Run - 학생 화면 인터랙션 및 UX 로직
 * 1단계 (Main 화면: A 프로그램 타이틀, B 반별등수, 학년/반/번호 입력)
 * 2단계 (Second 화면: x 바퀴 입력 및 확인 저장 -끝-)
 */

document.addEventListener('DOMContentLoaded', () => {
  // DOM 요소 참조 - 화면 전환
  const screenMain = document.getElementById('screen-main');
  const screenSecond = document.getElementById('screen-second');

  // 메인 화면 요소
  const gradeInput = document.getElementById('student-grade');
  const classInput = document.getElementById('student-class');
  const numInput = document.getElementById('student-num');
  const btnGoSecond = document.getElementById('btn-go-second');
  const rankingContainer = document.getElementById('ranking-list-container');
  const rankingUpdatedTime = document.getElementById('ranking-updated-time');

  // 세컨드 화면 요소
  const btnBackToMain = document.getElementById('btn-back-to-main');
  const secondStudentBadge = document.getElementById('second-student-badge');
  const lapCountInput = document.getElementById('lap-count-input');
  const btnDecreaseLap = document.getElementById('btn-decrease-lap');
  const btnIncreaseLap = document.getElementById('btn-increase-lap');
  const chipBtns = document.querySelectorAll('.chip-btn');
  const distancePreviewEl = document.getElementById('distance-preview');
  const btnConfirmRecord = document.getElementById('btn-confirm-record');

  // 완료 모달 요소
  const resultModal = document.getElementById('modal-result');
  const resultCloseBtn = document.getElementById('btn-close-result');
  const resultSummaryEl = document.getElementById('result-summary-text');
  const resultTodayTotalEl = document.getElementById('result-today-total');
  const resultAlltimeTotalEl = document.getElementById('result-alltime-total');

  // 현재 입력 중인 학생 및 바퀴 수 상태
  let currentStudent = {
    grade: null,
    classNum: null,
    studentNum: null
  };
  let currentLaps = 1;

  // --- [화면 전환 함수] ---
  function showScreen(screenName) {
    if (screenName === 'main') {
      screenSecond.style.display = 'none';
      screenMain.style.display = 'block';
      renderRankingBoard();
      // 다음 입력을 위해 번호 입력란에 포커스 (학년/반은 유지)
      setTimeout(() => {
        if (numInput) numInput.focus();
      }, 100);
    } else if (screenName === 'second') {
      screenMain.style.display = 'none';
      screenSecond.style.display = 'block';
      secondStudentBadge.textContent = `${currentStudent.grade}학년 ${currentStudent.classNum}반 ${currentStudent.studentNum}번 학생`;
      currentLaps = 1;
      updateLapDisplay();
      setTimeout(() => {
        if (lapCountInput) {
          lapCountInput.focus();
          lapCountInput.select();
        }
      }, 100);
    }
  }

  // --- [순수 숫자 입력 방식 지원: 마우스 휠 스크롤 방지 및 포커스 전체선택] ---
  const allNumberInputs = document.querySelectorAll('input[type="number"]');
  allNumberInputs.forEach(input => {
    // 마우스 휠 스크롤로 숫자가 변경되는 현상 완전 방지
    input.addEventListener('wheel', (e) => {
      e.preventDefault();
    }, { passive: false });

    // 입력창 터치/클릭 시 기존 값이 바로 덮어써지도록 전체선택
    input.addEventListener('focus', () => {
      setTimeout(() => input.select(), 50);
    });
  });

  // 초기값은 비워두어 학생이 처음부터 직접 숫자를 타이핑하도록 함
  gradeInput.value = '';
  classInput.value = '';
  numInput.value = '';

  // 학년 입력 시: 1~6 숫자 입력 시 자동으로 '반' 입력칸으로 이동
  gradeInput.addEventListener('input', () => {
    const val = gradeInput.value.trim();
    if (val.length >= 1) {
      classInput.focus();
    }
  });

  // 반 입력 시: 엔터 누르면 '번호' 입력칸으로 이동
  classInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      numInput.focus();
    }
  });

  // 메인 화면 로드 시 '학년' 칸에 바로 포커스
  setTimeout(() => {
    if (gradeInput) gradeInput.focus();
  }, 150);

  // --- [B 영역: 실시간 반별 등수 렌더링] ---
  function renderRankingRecords(records) {
    if (!rankingContainer) return;
    try {
      const stats = window.db.calculateStats(records);

      if (rankingUpdatedTime) {
        const now = new Date();
        const timeStr = now.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
        rankingUpdatedTime.textContent = `오늘 참여: ${stats.todayStudents || 0}명 (${timeStr} 기준)`;
      }

      if (!stats.classRankings || stats.classRankings.length === 0) {
        rankingContainer.replaceChildren();
        const empty = document.createElement('div');
        empty.className = 'ranking-empty-box';
        const emptyTitle = document.createElement('strong');
        emptyTitle.textContent = '아직 등록된 달리기 기록이 없습니다.';
        const emptyGuide = document.createElement('span');
        emptyGuide.textContent = '아래에서 우리 반의 첫 기록을 남겨보세요.';
        empty.append(emptyTitle, emptyGuide);
        rankingContainer.appendChild(empty);
        return;
      }

      const fragment = document.createDocumentFragment();
      stats.classRankings.forEach((cls, idx) => {
        const rank = idx + 1;
        let rankClass = '';
        const badgeText = String(rank);

        if (rank === 1) {
          rankClass = 'rank-1';
        } else if (rank === 2) {
          rankClass = 'rank-2';
        } else if (rank === 3) {
          rankClass = 'rank-3';
        }

        const km = (cls.distance / 1000).toFixed(2);

        const item = document.createElement('div');
        item.className = `ranking-item ${rankClass}`.trim();
        const left = document.createElement('div');
        left.className = 'rank-left';
        const badge = document.createElement('span');
        badge.className = 'rank-badge';
        badge.textContent = badgeText;
        const name = document.createElement('span');
        name.className = 'rank-class-name';
        name.textContent = cls.name;
        left.append(badge, name);
        const right = document.createElement('div');
        right.className = 'rank-right';
        const laps = document.createElement('div');
        laps.className = 'rank-laps-num';
        laps.textContent = `${cls.laps}바퀴`;
        const distance = document.createElement('div');
        distance.className = 'rank-dist-info';
        distance.textContent = `${km}km (${cls.count}회 참여)`;
        right.append(laps, distance);
        item.append(left, right);
        fragment.appendChild(item);
      });
      rankingContainer.replaceChildren(fragment);
    } catch (err) {
      console.error('랭킹 보드 렌더링 오류:', err);
    }
  }

  async function renderRankingBoard() {
    try {
      renderRankingRecords(await window.db.getRecords());
    } catch (err) {
      console.error('랭킹 조회 오류:', err);
    }
  }

  // 관리자 모드 등 외부에서 랭킹을 새로고침할 수 있도록 노출
  window.refreshMainRankings = renderRankingBoard;

  // --- [메인 화면 -> [입력하기] 클릭] ---
  btnGoSecond.addEventListener('click', () => {
    const grade = gradeInput.value.trim();
    const classNum = classInput.value.trim();
    const studentNum = numInput.value.trim();

    // 유효성 검사
    if (!grade || parseInt(grade, 10) < 1 || parseInt(grade, 10) > 6) {
      showToast('학년(1~6학년)을 올바르게 입력해주세요.');
      gradeInput.focus();
      return;
    }
    if (!classNum || parseInt(classNum, 10) < 1 || parseInt(classNum, 10) > 20) {
      showToast('반(1~20반)을 올바르게 입력해주세요.');
      classInput.focus();
      return;
    }
    if (!studentNum || parseInt(studentNum, 10) < 1 || parseInt(studentNum, 10) > 60) {
      showToast('학생 번호(1~60번)를 올바르게 입력해주세요.');
      numInput.focus();
      return;
    }

    // 학생 정보 상태 저장
    currentStudent = {
      grade: parseInt(grade, 10),
      classNum: parseInt(classNum, 10),
      studentNum: parseInt(studentNum, 10)
    };

    // 다음 입력을 편하게 하도록 로컬에 저장
    localStorage.setItem('runday_last_student', JSON.stringify(currentStudent));

    // 세컨드 화면으로 전환
    showScreen('second');
  });

  // 메인 화면 번호 입력 후 엔터 누르면 바로 [입력하기] 동작
  numInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      btnGoSecond.click();
    }
  });

  // --- [세컨드 화면: 바퀴 수 컨트롤] ---
  function updateLapDisplay() {
    lapCountInput.value = currentLaps;
    const settings = window.db.settings;
    const lapMeters = settings.lapLengthMeters || 150;
    const distanceMeters = currentLaps * lapMeters;

    if (distanceMeters >= 1000) {
      const km = (distanceMeters / 1000).toFixed(2);
      distancePreviewEl.innerHTML = `예상 거리: <span class="distance-highlight">${km} km</span> (${distanceMeters}m 달리기)`;
    } else {
      distancePreviewEl.innerHTML = `예상 거리: <span class="distance-highlight">${distanceMeters} m</span> 달리기 (1바퀴 = ${lapMeters}m)`;
    }

    // 퀵 칩 버튼 활성화 상태
    chipBtns.forEach(btn => {
      const chipVal = parseInt(btn.dataset.laps, 10);
      if (chipVal === currentLaps) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }

  // 바퀴 수 직접 입력 시 반응
  lapCountInput.addEventListener('input', () => {
    let val = parseInt(lapCountInput.value, 10);
    const maxLaps = window.db.settings.maxLapsPerEntry || 50;
    if (isNaN(val) || val < 1) {
      val = 1;
    } else if (val > maxLaps) {
      val = maxLaps;
      showToast(`1회 최대 ${maxLaps}바퀴까지 입력 가능합니다.`);
    }
    currentLaps = val;
    updateLapDisplay();
  });

  // 바퀴 수 증감 버튼
  btnDecreaseLap.addEventListener('click', () => {
    if (currentLaps > 1) {
      currentLaps -= 1;
      updateLapDisplay();
    }
  });

  btnIncreaseLap.addEventListener('click', () => {
    const maxLaps = window.db.settings.maxLapsPerEntry || 50;
    if (currentLaps < maxLaps) {
      currentLaps += 1;
      updateLapDisplay();
    } else {
      showToast(`1회 최대 ${maxLaps}바퀴까지만 입력 가능합니다.`);
    }
  });

  // 퀵 바퀴 칩 클릭
  chipBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      currentLaps = parseInt(btn.dataset.laps, 10);
      updateLapDisplay();
    });
  });

  // 뒤로가기 버튼
  btnBackToMain.addEventListener('click', () => {
    showScreen('main');
  });

  // --- [세컨드 화면: [확인] 클릭 -> 저장 -> -끝-] ---
  btnConfirmRecord.addEventListener('click', async () => {
    let laps = parseInt(lapCountInput.value, 10);
    if (isNaN(laps) || laps < 1) {
      laps = 1;
    }

    btnConfirmRecord.disabled = true;
    btnConfirmRecord.innerHTML = `<span>저장 중...</span>`;

    try {
      // 1. DB에 기록 저장
      const record = await window.db.addRecord({
        grade: currentStudent.grade,
        classNum: currentStudent.classNum,
        studentNum: currentStudent.studentNum,
        laps: laps
      });

      // 2. Firebase 전체 기록 기준 학생의 오늘/전체 누적 집계
      const studentTotals = await window.db.getStudentTotals(
        currentStudent.grade,
        currentStudent.classNum,
        currentStudent.studentNum
      );

      // 3. 완료 팝업 내용 설정 및 표시
      resultSummaryEl.textContent = `${record.grade}학년 ${record.classNum}반 ${record.studentNum}번 학생, ${record.laps}바퀴(${record.distance}m)를 저장했습니다!`;
      resultTodayTotalEl.textContent = `${studentTotals.today.totalLaps}바퀴 · ${studentTotals.today.totalDistance}m`;
      resultAlltimeTotalEl.textContent = `${studentTotals.allTime.totalLaps}바퀴 · ${studentTotals.allTime.totalDistance}m`;
      if (!record.cloudSaved) {
        resultSummaryEl.textContent += ' 인터넷 연결 후 자동으로 클라우드에 전송됩니다.';
      }
      resultModal.classList.add('show');

      // 4. 메인 화면 번호 입력란 초기화 및 세컨드 바퀴 수 리셋
      if (numInput) numInput.value = '';
      currentLaps = 1;
      updateLapDisplay();

    } catch (err) {
      console.error('기록 저장 오류:', err);
      showToast('기록 저장 중 오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      btnConfirmRecord.disabled = false;
      btnConfirmRecord.innerHTML = `<span>확  인</span>`;
    }
  });

  // 세컨드 화면에서 엔터 누르면 [확인] 동작
  lapCountInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      btnConfirmRecord.click();
    }
  });

  // 결과 확인 팝업 닫기 -> 메인 화면으로 복귀!
  resultCloseBtn.addEventListener('click', () => {
    resultModal.classList.remove('show');
    showScreen('main');
  });

  // 팝업 바깥 클릭 시에도 닫고 메인으로 복귀
  resultModal.addEventListener('click', (e) => {
    if (e.target === resultModal) {
      resultModal.classList.remove('show');
      showScreen('main');
    }
  });

  // 다른 기기의 입력도 화면에 자동 반영하는 Firestore 실시간 구독
  window.db.subscribeRecords(renderRankingRecords, () => renderRankingBoard());
});

// 토스트 메시지 헬퍼
function showToast(message) {
  let toastContainer = document.getElementById('toast-container');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toast-container';
    toastContainer.className = 'toast-container';
    document.body.appendChild(toastContainer);
  }

  const toast = document.createElement('div');
  toast.className = 'toast';
  const text = document.createElement('span');
  text.textContent = String(message);
  toast.appendChild(text);
  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.2s ease';
    setTimeout(() => toast.remove(), 200);
  }, 2500);
}
