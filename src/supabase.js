import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://qqhnxjfajbwzhsuzspqs.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_uh8bxTeRx1xd26HDdRWcxw_N5L5P1zd';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export function todayDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export async function fetchEntriesForDay(day) {
  const { data, error } = await supabase
    .from('entries')
    .select('*')
    .eq('day', day)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function fetchHistory(excludeDay, limit = 7) {
  const { data, error } = await supabase
    .from('entries')
    .select('*')
    .neq('day', excludeDay)
    .order('day', { ascending: false });
  if (error) throw error;
  const byDay = {};
  for (const entry of data || []) {
    if (!byDay[entry.day]) byDay[entry.day] = [];
    byDay[entry.day].push(entry);
  }
  const days = Object.keys(byDay)
    .sort()
    .reverse()
    .slice(0, limit)
    .map(day => {
      const entries = byDay[day];
      return {
        day,
        kcal: entries.reduce((s, e) => s + e.kcal, 0),
        protein: entries.reduce((s, e) => s + e.protein, 0),
        count: entries.length,
      };
    });
  return days;
}

export async function addEntry(entry) {
  const { data, error } = await supabase
    .from('entries')
    .insert([entry])
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteEntry(id) {
  const { error } = await supabase.from('entries').delete().eq('id', id);
  if (error) throw error;
}
