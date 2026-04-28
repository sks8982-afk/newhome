'use client';

import { useEffect, useState } from 'react';
import type { HousingType, UserFilter } from '@/types/announcement';
import { DEFAULT_FILTER } from '@/types/announcement';

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

  useEffect(() => {
    fetch('/api/filter')
      .then((r) => r.json())
      .then((d: UserFilter) => {
        setFilter(d);
        setCityInput(d.priorityCities.join(', '));
      })
      .catch(() => {});
  }, []);

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
      <h2 className="text-xl font-semibold">⚙️ 필터 설정</h2>

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h3 className="mb-3 font-semibold text-slate-800">주택 유형</h3>
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
        <h3 className="mb-1 font-semibold text-slate-800">우선 도시 (강조 표시)</h3>
        <p className="mb-3 text-xs text-slate-500">
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
