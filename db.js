/**
 * 걸포 Run 데이터베이스 어댑터
 * LocalStorage에 먼저 저장하고 Firestore와 동기화합니다.
 */

const STORAGE_KEYS = {
  RECORDS: 'runday_records_v1',
  SETTINGS: 'runday_settings_v1'
};

const DEFAULT_SETTINGS = {
  adminCode: '1378',
  lapLengthMeters: 150,
  schoolName: '걸포 Run',
  maxLapsPerEntry: 30
};

const DEFAULT_CLOUD_CONFIG = {
  apiKey: 'AIzaSyCkWyFAAhYyq2L2WetWtoSZJ-elNiEG3wU',
  authDomain: 'geolporun.firebaseapp.com',
  projectId: 'geolporun',
  storageBucket: 'geolporun.firebasestorage.app',
  messagingSenderId: '858961671942',
  appId: '1:858961671942:web:66f134f6223cc6d0c85087'
};

class RunningDatabase {
  constructor() {
    this.settings = this.loadSettings();
    this.cloudDb = null;
    this.cloudApp = null;
    this.cloudAppName = 'geolpo-run-cloud';
    this.cloudReady = this.initCloud();
    window.addEventListener('online', () => {
      this.syncPendingRecords().catch(err => console.warn('재동기화 실패:', err));
    });
  }

  loadSettings() {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.adminCode === '1234') parsed.adminCode = '1378';
        const settings = { ...DEFAULT_SETTINGS, ...parsed };
        localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
        return settings;
      }
    } catch (e) {
      console.error('설정 로드 오류:', e);
    }
    return { ...DEFAULT_SETTINGS };
  }

  saveSettings(newSettings) {
    this.settings = { ...this.settings, ...newSettings };
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(this.settings));
    return this.settings;
  }

  verifyAdminCode(inputCode) {
    return String(inputCode).trim() === String(this.settings.adminCode).trim();
  }

  validateCloudConfig(config) {
    const required = ['apiKey', 'authDomain', 'projectId', 'appId'];
    return config && required.every(key => typeof config[key] === 'string' && config[key].trim());
  }

  async initCloud() {
    this.cloudDb = null;
    const config = { ...DEFAULT_CLOUD_CONFIG };
    if (!window.firebase || !this.validateCloudConfig(config)) return false;
    try {
      const existing = firebase.apps.find(app => app.name === this.cloudAppName);
      if (existing) await existing.delete();
      this.cloudApp = firebase.initializeApp(config, this.cloudAppName);
      this.cloudDb = this.cloudApp.firestore();
      this.syncPendingRecords().catch(err => console.warn('초기 재동기화 실패:', err));
      console.log('Firebase Firestore 연결 완료');
      return true;
    } catch (e) {
      this.cloudDb = null;
      console.warn('Firebase 초기화 실패 - 로컬 모드로 작동:', e.message);
      return false;
    }
  }

  getCloudConfig() {
    return { ...DEFAULT_CLOUD_CONFIG };
  }

  getAllRecordsLocal() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.RECORDS);
      const records = data ? JSON.parse(data) : [];
      return Array.isArray(records) ? records : [];
    } catch (e) {
      console.error('기록 불러오기 실패:', e);
      return [];
    }
  }

  saveAllRecordsLocal(records) {
    localStorage.setItem(STORAGE_KEYS.RECORDS, JSON.stringify(records));
  }

  updateLocalRecord(id, fields) {
    const records = this.getAllRecordsLocal();
    const index = records.findIndex(record => record.id === id);
    if (index < 0) return null;
    records[index] = { ...records[index], ...fields };
    this.saveAllRecordsLocal(records);
    return records[index];
  }

  getTodayDateString(d = new Date()) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  normalizeRecord(record) {
    return { ...record, grade: Number(record.grade), classNum: Number(record.classNum), studentNum: Number(record.studentNum), laps: Number(record.laps), distance: Number(record.distance) };
  }

  validateRecordInput({ grade, classNum, studentNum, laps }) {
    const values = { grade: Number(grade), classNum: Number(classNum), studentNum: Number(studentNum), laps: Number(laps) };
    if (!Number.isInteger(values.grade) || values.grade < 1 || values.grade > 6) throw new Error('학년 값이 올바르지 않습니다.');
    if (!Number.isInteger(values.classNum) || values.classNum < 1 || values.classNum > 20) throw new Error('반 값이 올바르지 않습니다.');
    if (!Number.isInteger(values.studentNum) || values.studentNum < 1 || values.studentNum > 60) throw new Error('번호 값이 올바르지 않습니다.');
    if (!Number.isInteger(values.laps) || values.laps < 1 || values.laps > this.settings.maxLapsPerEntry) throw new Error('바퀴 수가 올바르지 않습니다.');
    return values;
  }

  toCloudRecord(record) {
    const { syncStatus, cloudSaved, ...cloudRecord } = record;
    return cloudRecord;
  }

  async addRecord(input) {
    const values = this.validateRecordInput(input);
    const lapMeters = Number(this.settings.lapLengthMeters) || 150;
    const now = new Date();
    const newRecord = {
      id: `rec_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      ...values,
      lapLengthMeters: lapMeters,
      distance: values.laps * lapMeters,
      date: this.getTodayDateString(now),
      timestamp: now.toISOString(),
      displayTime: now.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
      syncStatus: 'pending'
    };
    const records = this.getAllRecordsLocal();
    records.unshift(newRecord);
    this.saveAllRecordsLocal(records);
    let cloudSaved = false;
    if (this.cloudReady) await this.cloudReady;
    if (this.cloudDb) {
      try {
        await this.cloudDb.collection('running_records').doc(newRecord.id).set(this.toCloudRecord(newRecord));
        this.updateLocalRecord(newRecord.id, { syncStatus: 'synced' });
        cloudSaved = true;
      } catch (err) {
        console.warn('클라우드 업로드 실패 - 재전송 대기:', err);
      }
    }
    return { ...newRecord, syncStatus: cloudSaved ? 'synced' : 'pending', cloudSaved };
  }

  async syncPendingRecords() {
    if (!this.cloudDb || !navigator.onLine) return 0;
    const records = this.getAllRecordsLocal();
    const pending = records.filter(record => record.syncStatus !== 'synced');
    let syncedCount = 0;
    for (const record of pending) {
      try {
        await this.cloudDb.collection('running_records').doc(record.id).set(this.toCloudRecord(record));
        record.syncStatus = 'synced';
        syncedCount += 1;
      } catch (err) {
        console.warn(`기록 ${record.id} 재전송 실패:`, err);
      }
    }
    if (syncedCount) this.saveAllRecordsLocal(records);
    return syncedCount;
  }

  mergeCloudAndPending(cloudRecords) {
    const map = new Map(cloudRecords.map(record => [record.id, this.normalizeRecord(record)]));
    this.getAllRecordsLocal().filter(record => record.syncStatus !== 'synced').forEach(record => map.set(record.id, this.normalizeRecord(record)));
    return [...map.values()].sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)));
  }

  filterRecords(records, filters = {}) {
    return records.filter(item => {
      if (filters.date && item.date !== filters.date) return false;
      if (filters.grade && item.grade !== Number(filters.grade)) return false;
      if (filters.classNum && item.classNum !== Number(filters.classNum)) return false;
      return true;
    });
  }

  async getRecords(filters = {}) {
    if (this.cloudReady) await this.cloudReady;
    let records;
    if (this.cloudDb) {
      try {
        this.syncPendingRecords().catch(err => console.warn('백그라운드 재동기화 실패:', err));
        const snapshot = await this.cloudDb.collection('running_records').orderBy('timestamp', 'desc').get();
        records = this.mergeCloudAndPending(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (e) {
        console.warn('클라우드 조회 실패 - 로컬 기록 사용:', e);
        records = this.getAllRecordsLocal().map(record => this.normalizeRecord(record));
      }
    } else {
      records = this.getAllRecordsLocal().map(record => this.normalizeRecord(record));
    }
    return this.filterRecords(records, filters);
  }

  subscribeRecords(onRecords, onError = () => {}) {
    let unsubscribe = () => {};
    this.cloudReady.then(() => {
      if (!this.cloudDb) {
        this.getRecords().then(onRecords).catch(onError);
        return;
      }
      unsubscribe = this.cloudDb.collection('running_records').orderBy('timestamp', 'desc').onSnapshot(
        snapshot => onRecords(this.mergeCloudAndPending(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })))),
        error => {
          console.warn('실시간 구독 실패:', error);
          this.getRecords().then(onRecords).catch(onError);
        }
      );
    }).catch(onError);
    return () => unsubscribe();
  }

  async updateRecord(id, updatedFields) {
    const localRecord = this.getAllRecordsLocal().find(record => record.id === id);
    const laps = Number(updatedFields.laps);
    if (!Number.isInteger(laps) || laps < 1 || laps > this.settings.maxLapsPerEntry) throw new Error('바퀴 수가 올바르지 않습니다.');
    const lapMeters = Number(localRecord?.lapLengthMeters) || Number(this.settings.lapLengthMeters) || 150;
    const changes = { laps, distance: laps * lapMeters, lapLengthMeters: lapMeters };
    if (this.cloudReady) await this.cloudReady;
    if (this.cloudDb) {
      await this.cloudDb.collection('running_records').doc(id).update(changes);
    } else if (!localRecord) {
      throw new Error('클라우드에 연결되지 않아 이 기록을 수정할 수 없습니다.');
    }
    return this.updateLocalRecord(id, { ...changes, syncStatus: this.cloudDb ? 'synced' : 'pending' }) || { id, ...changes };
  }

  async deleteRecord(id) {
    if (this.cloudReady) await this.cloudReady;
    if (this.cloudDb) await this.cloudDb.collection('running_records').doc(id).delete();
    this.saveAllRecordsLocal(this.getAllRecordsLocal().filter(record => record.id !== id));
    return true;
  }

  calculateStats(records, targetDate = null) {
    const safeRecords = records.filter(record => Number.isFinite(record.laps) && Number.isFinite(record.distance));
    const dateToFilter = targetDate || this.getTodayDateString();
    const targetRecords = safeRecords.filter(record => record.date === dateToFilter);
    const classStatsMap = {};
    safeRecords.forEach(record => {
      const key = `${record.grade}학년 ${record.classNum}반`;
      if (!classStatsMap[key]) classStatsMap[key] = { name: key, laps: 0, distance: 0, count: 0 };
      classStatsMap[key].laps += record.laps;
      classStatsMap[key].distance += record.distance;
      classStatsMap[key].count += 1;
    });
    return {
      date: dateToFilter,
      todayStudents: new Set(targetRecords.map(record => `${record.grade}-${record.classNum}-${record.studentNum}`)).size,
      todayLaps: targetRecords.reduce((sum, record) => sum + record.laps, 0),
      todayKm: (targetRecords.reduce((sum, record) => sum + record.distance, 0) / 1000).toFixed(2),
      classRankings: Object.values(classStatsMap).sort((a, b) => b.laps - a.laps)
    };
  }

  getStudentTodayTotal(grade, classNum, studentNum) {
    const today = this.getTodayDateString();
    const records = this.getAllRecordsLocal().filter(record => Number(record.grade) === Number(grade) && Number(record.classNum) === Number(classNum) && Number(record.studentNum) === Number(studentNum) && record.date === today);
    return {
      totalLaps: records.reduce((sum, record) => sum + Number(record.laps || 0), 0),
      totalDistance: records.reduce((sum, record) => sum + Number(record.distance || 0), 0)
    };
  }

  async getStudentTotals(grade, classNum, studentNum) {
    const today = this.getTodayDateString();
    const records = (await this.getRecords()).filter(record =>
      Number(record.grade) === Number(grade) &&
      Number(record.classNum) === Number(classNum) &&
      Number(record.studentNum) === Number(studentNum)
    );
    const todayRecords = records.filter(record => record.date === today);
    const sum = target => ({
      totalLaps: target.reduce((total, record) => total + Number(record.laps || 0), 0),
      totalDistance: target.reduce((total, record) => total + Number(record.distance || 0), 0)
    });
    return { today: sum(todayRecords), allTime: sum(records) };
  }

  exportToCSV(records) {
    if (!records?.length) {
      alert('다운로드할 기록이 없습니다.');
      return;
    }
    const escapeCsv = value => {
      const text = String(value ?? '').replace(/"/g, '""');
      const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
      return `"${safe}"`;
    };
    const headers = ['기록일자', '시간', '학년', '반', '번호', '달린바퀴(바퀴)', '거리(m)', '고유ID'];
    const rows = records.map(record => [record.date, record.displayTime || '', record.grade, record.classNum, record.studentNum, record.laps, record.distance, record.id]);
    const csvContent = '\uFEFF' + [headers, ...rows].map(row => row.map(escapeCsv).join(',')).join('\r\n') + '\r\n';
    const url = URL.createObjectURL(new Blob([csvContent], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `달리기기록_${this.getTodayDateString()}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }
}

window.db = new RunningDatabase();
