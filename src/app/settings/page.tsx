'use client';

import { useEffect, useState } from 'react';
import type { HousingType, UserFilter, UserProfile } from '@/types/announcement';
import { DEFAULT_FILTER, DEFAULT_PROFILE } from '@/types/announcement';
import { loadProfile, saveProfile } from '@/lib/profile';

const HOUSING_OPTIONS: HousingType[] = [
  '행복주택',
  '국민임대',
  '영구임대',
  '공공임대',
  '분양주택',
  '신혼희망타운',
];

const REGION_OPTIONS = [
  '서울', '경기', '인천', '강원', '충북', '충남', '대전', '세종',
  '전북', '전남', '광주', '경북', '경남', '대구', '울산', '부산', '제주',
];

export default function SettingsPage(): React.ReactElement {
  const [filter, setFilter] = useState<UserFilter>(DEFAULT_FILTER);
  const [cityInput, setCityInput] = useState<string>('');
  const [saved, setSaved] = useState<boolean>(false);
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [profileSaved, setProfileSaved] = useState<boolean>(false);

  useEffect(() => {
    fetch('/api/filter')
      .then((r) => r.json())
      .then((d: UserFilter) => {
        setFilter(d);
        setCityInput(d.priorityCities.join(', '));
      })
      .catch(() => {});
    setProfile(loadProfile());
  }, []);

  const saveProfileForm = (): void => {
    saveProfile(profile);
    setProfileSaved(true);
    setTimeout(() => setProfileSaved(false), 2000);
  };

  const toggle = <K extends keyof UserFilter>(key: K, value: string): void => {
    setFilter((prev) => {
      const arr = prev[key] as string[];
      const exists = arr.includes(value);
      const next = exists ? arr.filter((v) => v !== value) : [...arr, value];
      return { ...prev, [key]: next } as UserFilter;
    });
  };

  const save = async (): Promise<void> => {
    const priorityCities = cityInput
      .split(/[,\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const next: UserFilter = { ...filter, priorityCities };
    const res = await fetch('/api/filter', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(next),
    });
    if (res.ok) {
      setFilter(next);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">⚙️ 설정</h2>

      <section className="rounded-lg border border-priority-300 bg-priority-50 p-5">
        <h3 className="mb-1 font-semibold text-slate-800">🎯 내 조건 (맞춤 필터)</h3>
        <p className="mb-3 text-xs text-slate-500">
          아래 조건으로 대시보드의 <strong>🎯 내 조건 맞춤</strong> 목록이 채워집니다.
          이 정보는 서버가 아니라 <strong>이 브라우저에만</strong> 저장됩니다.<br />
          ※ 소득·자산 상한, 특별공급 자격, 정확한 1순위는 공고문 확인이 필요합니다(대략 분류).
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm text-slate-700">
            생년월일
            <input
              type="date"
              value={profile.birthDate}
              onChange={(e) => setProfile((p) => ({ ...p, birthDate: e.target.value }))}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-priority-500 focus:outline-none"
            />
          </label>
          <label className="text-sm text-slate-700">
            예산 상한 (분양·줍줍, 억)
            <input
              type="number"
              min={0}
              step={0.5}
              value={profile.budgetEok}
              onChange={(e) => setProfile((p) => ({ ...p, budgetEok: Number(e.target.value) || 0 }))}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-priority-500 focus:outline-none"
            />
          </label>
          <label className="text-sm text-slate-700">
            청약통장 납입 횟수
            <input
              type="number"
              min={0}
              value={profile.savingsCount}
              onChange={(e) => setProfile((p) => ({ ...p, savingsCount: Number(e.target.value) || 0 }))}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-priority-500 focus:outline-none"
            />
          </label>
          <div className="flex items-end gap-4 text-sm text-slate-700">
            <label className="flex cursor-pointer items-center gap-1.5">
              <input
                type="checkbox"
                checked={profile.isHomeless}
                onChange={(e) => setProfile((p) => ({ ...p, isHomeless: e.target.checked }))}
                className="h-4 w-4"
              />
              무주택
            </label>
            <label className="flex cursor-pointer items-center gap-1.5">
              <input
                type="checkbox"
                checked={profile.hasIncome}
                onChange={(e) => setProfile((p) => ({ ...p, hasIncome: e.target.checked }))}
                className="h-4 w-4"
              />
              소득 있음
            </label>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            onClick={saveProfileForm}
            className="rounded-md bg-priority-600 px-4 py-2 text-sm font-semibold text-white hover:bg-priority-700"
          >
            내 조건 저장
          </button>
          {profileSaved && <span className="text-sm text-priority-700">✓ 저장되었습니다</span>}
        </div>
      </section>

      <h2 className="pt-2 text-xl font-semibold">🔎 수집 필터</h2>

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h3 className="mb-1 font-semibold text-slate-800">주택 유형</h3>
        <p className="mb-3 text-xs text-slate-500">
          하나도 선택하지 않으면 <strong>전체 유형</strong>(공공임대 · 행복주택 · 영구임대 · 국민임대 · 분양 · 신혼희망타운)을 수집합니다.
        </p>
        <div className="flex flex-wrap gap-2">
          {HOUSING_OPTIONS.map((opt) => {
            const active = filter.housingTypes.includes(opt);
            return (
              <button
                key={opt}
                type="button"
                onClick={() => toggle('housingTypes', opt)}
                className={`rounded-full border px-3 py-1 text-sm ${
                  active
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                {opt}
              </button>
            );
          })}
        </div>
        {filter.housingTypes.length === 0 && (
          <p className="mt-2 text-xs font-medium text-emerald-700">
            ✓ 전체 유형 수집 중
          </p>
        )}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h3 className="mb-3 font-semibold text-slate-800">지역 (시/도)</h3>
        <div className="flex flex-wrap gap-2">
          {REGION_OPTIONS.map((opt) => {
            const active = filter.regions.includes(opt);
            return (
              <button
                key={opt}
                type="button"
                onClick={() => toggle('regions', opt)}
                className={`rounded-full border px-3 py-1 text-sm ${
                  active
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                {opt}
              </button>
            );
          })}
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h3 className="mb-1 font-semibold text-slate-800">우선 도시 (텔레그램 알림 대상)</h3>
        <p className="mb-3 text-xs text-slate-500">
          여기 적힌 도시명이 공고 제목/지역에 포함된 경우에만 텔레그램 알림이 발송됩니다.<br />
          (대시보드/캘린더에는 모든 매칭 공고가 표시되고, ⭐ 강조 + 알림 대상이 됨)<br />
          쉼표 또는 공백으로 구분. 예: 수원, 화성, 오산
        </p>
        <input
          type="text"
          value={cityInput}
          onChange={(e) => setCityInput(e.target.value)}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-priority-500 focus:outline-none"
          placeholder="수원, 화성, 오산"
        />
      </section>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => { void save(); }}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
        >
          저장
        </button>
        {saved && <span className="text-sm text-emerald-600">✓ 저장되었습니다</span>}
      </div>
    </div>
  );
}
